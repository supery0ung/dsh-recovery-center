import { createShortcut, shortcutStatus } from './shortcut.js';
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { Recovery, atomicJson, exists, json } from './core.js';

export function identity(pid) {
  try { return execFileSync('ps', ['-p', String(pid), '-o', 'lstart=', '-o', 'command='], { encoding: 'utf8' }).trim(); } catch { return ''; }
}
export function locations(profile = 'web', home = process.env.DSH_HOME || path.join(homedir(), '.dsh')) {
  if (!/^[a-zA-Z0-9_-]+$/.test(profile)) throw new Error('Invalid profile name');
  home = path.resolve(home);
  return { profile: path.join(home, 'profiles', profile), store: path.join(home, 'recovery-center', profile) };
}
export async function installRescue(runtime) {
  await fs.mkdir(runtime.store, { recursive: true, mode: 0o700 });
  // Emergency code lives outside node_modules, so removing this plugin cannot remove rescue.
  const src = path.dirname(fileURLToPath(import.meta.url));
  const dest = path.join(runtime.store, 'rescue');
  await fs.mkdir(dest, { recursive: true, mode: 0o700 });
  await atomicJson(path.join(dest, 'package.json'), { type: 'module' });
  for (const file of ['core.js', 'runtime.js', 'worker.js', 'cli.js', 'http.js', 'ui.html', 'i18n.js', 'shortcut.js']) await fs.copyFile(path.join(src, file), path.join(dest, file));
  await atomicJson(path.join(runtime.store, 'runtime.json'), runtime);
  // Shortcut failure must not prevent DSH or the recovery HTTP route from loading.
  await createShortcut(runtime).catch(() => {});
}
export async function scheduleRestore(runtime, id) {
  if (!runtime.allowRestart) throw new Error('此启动方式未启用自动重启。请关闭 DSH 后使用 CLI 恢复。');
  if (await exists(path.join(runtime.store, 'operation.lock'))) throw new Error('已有备份/恢复操作进行中。');
  const jobPath = path.join(runtime.store, 'pending-job.json');
  // Exclusive creation blocks double clicks from separate browser windows.
  const f = await fs.open(jobPath, 'wx', 0o600).catch(e => { if (e.code === 'EEXIST') throw new Error('已有恢复任务，请查看进度。'); throw e; });
  await f.writeFile(JSON.stringify({ id })); await f.close();
  const log = await fs.open(path.join(runtime.store, 'worker.log'), 'a', 0o600);
  try {
    const worker = spawn(runtime.executable, [path.join(runtime.store, 'rescue/worker.js'), runtime.store], { detached: true, stdio: ['ignore', log.fd, log.fd], env: process.env });
    await new Promise((resolve, reject) => { worker.once('spawn', resolve); worker.once('error', reject); });
    await atomicJson(path.join(runtime.store, 'worker-owner.json'), { pid: worker.pid, identity: identity(worker.pid) });
    worker.unref();
    return { accepted: true };
  } catch (e) { await fs.rm(jobPath, { force: true }); throw e; }
  finally { await log.close(); }
}
export async function status(runtime) {
  const engine = new Recovery(runtime.profile, runtime.store, runtime.dshVersion);
  return { shortcut: await shortcutStatus(runtime), points: await engine.list(), dshVersion: runtime.dshVersion, allowRestart: runtime.allowRestart, busy: await exists(path.join(runtime.store, 'pending-job.json')) || await exists(path.join(runtime.store, 'operation.lock')), result: await json(path.join(runtime.store, 'result.json')).catch(() => null) };
}

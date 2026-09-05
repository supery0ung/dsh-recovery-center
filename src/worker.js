import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { Recovery, atomicJson, json, exists } from './core.js';
import { identity } from './runtime.js';

const store = process.argv[2];
const resultFile = path.join(store, 'result.json');
let stopped = false, runtime;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function listening() {
  const i = runtime.argv.indexOf('--port');
  const port = i < 0 ? 3080 : Number(runtime.argv[i + 1]);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return false;
  return new Promise(resolve => {
    const req = http.get({ host: '127.0.0.1', port, path: '/', timeout: 600 }, res => { res.resume(); resolve([200, 401, 303].includes(res.statusCode)); });
    req.on('timeout', () => req.destroy()); req.on('error', () => resolve(false));
  });
}
async function startHost() {
  const log = await fs.open(path.join(store, 'host.log'), 'a', 0o600);
  try {
    const child = spawn(runtime.executable, runtime.argv, { cwd: runtime.cwd, env: { ...process.env, ...runtime.env }, detached: true, stdio: ['ignore', log.fd, log.fd] });
    await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
    child.unref();
    // Plugin activation rewrites runtime.json with the new process identity.
    for (let i = 0; i < 80; i++) {
      const current = await json(path.join(store, 'runtime.json'));
      if (current.pid === child.pid) return child.pid;
      if (!identity(child.pid)) throw new Error('DSH 重启失败，请打开应急恢复入口查看日志。');
      // A valid older point may predate this plugin. Keep rescue able to restart it again.
      if (await listening()) {
        await atomicJson(path.join(store, 'runtime.json'), { ...runtime, pid: child.pid, identity: identity(child.pid) });
        return child.pid;
      }
      await sleep(250);
    }
    throw new Error('DSH 已启动，但恢复插件尚未就绪；请检查应急入口中的日志。');
  } finally { await log.close(); }
}
try {
  runtime = await json(path.join(store, 'runtime.json'));
  const { id } = await json(path.join(store, 'pending-job.json'));
  const engine = new Recovery(runtime.profile, store, runtime.dshVersion);
  await atomicJson(resultFile, { state: 'verifying', message: '正在验证恢复点…' });
  await engine.verify(id); // Never stop the host for an invalid point.
  if (!runtime.allowRestart) throw new Error('未授权此启动方式自动重启。');
  const current = identity(runtime.pid);
  if (current && current !== runtime.identity) throw new Error('DSH 进程已变化，拒绝停止其他进程。');
  await atomicJson(resultFile, { state: 'stopping', message: '正在停止 DSH…' });
  if (current) {
    process.kill(runtime.pid, 'SIGTERM');
    for (let i = 0; i < 80 && identity(runtime.pid) === runtime.identity; i++) await sleep(250);
    if (identity(runtime.pid) === runtime.identity) throw new Error('DSH 没有正常退出；没有强制终止，也没有修改文件。');
  }
  stopped = true;
  await atomicJson(resultFile, { state: 'restoring', message: '正在恢复插件；聊天记录保持原样…' });
  const restored = await engine.restore(id);
  await atomicJson(resultFile, { state: 'starting', message: '正在重新启动 DSH…', ...restored });
  const pid = await startHost(); stopped = false;
  await atomicJson(resultFile, { state: 'done', message: '恢复完成，DSH 已重新启动。请刷新页面。', ...restored, pid });
} catch (e) {
  let restartNote = '';
  if (stopped && !await exists(path.join(store, 'transaction.json'))) {
    try { await startHost(); restartNote = ' 已尝试重新启动 DSH。'; } catch (err) { restartNote = ' ' + err.message; }
  }
  await atomicJson(resultFile, { state: 'error', message: e.message + restartNote });
  console.error(e);
  process.exitCode = 1;
} finally { await fs.rm(path.join(store, 'pending-job.json'), { force: true }); }

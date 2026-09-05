import fs from 'node:fs/promises';
import path from 'node:path';
import { homedir } from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { exists, atomicJson, json } from './core.js';

export const quote = value => "'" + String(value).replaceAll("'", "'\\''") + "'";
export function launcher(runtime, platform = process.platform) {
  const fingerprint = createHash('sha256').update(path.resolve(runtime.store)).digest('hex').slice(0, 10);
  const marker = '# dsh-recovery-center:' + fingerprint;
  const cli = path.join(runtime.store, 'rescue/cli.js');
  return { marker, fingerprint, extension: platform === 'darwin' ? '.command' : '.sh', text: `#!/bin/sh\n${marker}\nNODE=${quote(runtime.executable)}\nif [ ! -x "$NODE" ]; then NODE=$(command -v node || true); fi\nif [ -z "$NODE" ]; then\n  printf '%s\\n' 'Node.js 22+ is required / 需要 Node.js 22 或更新版本'\n  read -r answer\n  exit 1\nfi\nexec "$NODE" ${quote(cli)} serve --store ${quote(runtime.store)} --open\n` };
}
async function writeOwned(file, text, marker, legacy) {
  if (await exists(file)) {
    const st = await fs.lstat(file);
    if (!st.isFile() || st.isSymbolicLink()) throw new Error('shortcut-conflict');
    const current = await fs.readFile(file, 'utf8');
    if (!current.split('\n').includes(marker) && current !== legacy) throw new Error('shortcut-conflict');
    if (current === text) { await fs.chmod(file, 0o700); return; }
  }
  const tmp = file + '.' + randomUUID() + '.tmp';
  await fs.writeFile(tmp, text, { flag: 'wx', mode: 0o700 });
  await fs.rename(tmp, file);
}
export async function createShortcut(runtime, options = {}) {
  const platform = options.platform || process.platform;
  const desktop = options.desktop || path.join(homedir(), 'Desktop');
  if (!['darwin', 'linux'].includes(platform)) return { state: 'unsupported', path: null, desktop: null };
  const spec = launcher(runtime, platform);
  const canonical = path.join(runtime.store, 'rescue/open-recovery' + spec.extension);
  await fs.mkdir(path.dirname(canonical), { recursive: true, mode: 0o700 });
  await writeOwned(canonical, spec.text, spec.marker);
  let state = 'saved', desktopPath = null;
  if (platform === 'darwin' && runtime.desktopShortcuts === true) {
    try {
      if (!await exists(desktop) || !(await fs.stat(desktop)).isDirectory()) throw new Error('desktop-missing');
      desktopPath = path.join(desktop, `DSH Emergency Recovery-${spec.fingerprint}${spec.extension}`);
      // Adopt only the exact legacy command created for this same installation.
      const legacyPath = path.join(desktop, 'DSH 应急恢复.command');
      const legacy = `#!/bin/zsh\n${quote(runtime.executable)} ${quote(path.join(runtime.store,'rescue/cli.js'))} serve --store ${quote(runtime.store)} --open\n`;
      if (await exists(legacyPath) && (await fs.lstat(legacyPath)).isFile()) {
        const text = await fs.readFile(legacyPath, 'utf8');
        if (text === legacy || text.split('\n').includes(spec.marker)) desktopPath = legacyPath;
      }
      await writeOwned(desktopPath, spec.text, spec.marker, legacy);
      state = 'desktop';
    } catch (e) { state = e.message === 'shortcut-conflict' ? 'conflict' : 'saved'; desktopPath = null; }
  }
  const result = { state, path: canonical, desktop: desktopPath, platform };
  await atomicJson(path.join(runtime.store, 'shortcut.json'), result);
  return result;
}
export async function shortcutStatus(runtime) {
  const record = await json(path.join(runtime.store, 'shortcut.json')).catch(() => null);
  if (!record) return { state: 'missing' };
  if (!await exists(record.path)) return { ...record, state: 'missing' };
  if (record.desktop && !await exists(record.desktop)) return { ...record, state: 'saved', desktop: null };
  return record;
}

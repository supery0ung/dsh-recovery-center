import fs from 'node:fs/promises';
import { constants, createReadStream } from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

export const TRACKED = ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'cordis.yml', 'cordis.patch.yml', 'node_modules', '.dsh-market/state.json'];
const ID = /^point-[0-9T-]+-[a-f0-9]{8}$/;
export async function exists(p) { try { await fs.lstat(p); return true; } catch (e) { if (e.code === 'ENOENT') return false; throw e; } }
export async function json(p) { return JSON.parse(await fs.readFile(p, 'utf8')); }
export async function atomicJson(p, value) {
  await fs.mkdir(path.dirname(p), { recursive: true, mode: 0o700 });
  const tmp = `${p}.${randomUUID()}.tmp`;
  const file = await fs.open(tmp, 'wx', 0o600);
  try { await file.writeFile(JSON.stringify(value, null, 2)); await file.sync(); } finally { await file.close(); }
  await fs.rename(tmp, p);
}
async function digest(p) {
  const h = createHash('sha256');
  for await (const chunk of createReadStream(p)) h.update(chunk);
  return h.digest('hex');
}
function inside(root, target) { const rel = path.relative(root, target); return rel === '' || (!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel)); }

// Symlinks must stay within this captured tree. Do not silently omit local plugins.
export async function inventory(root) {
  root = await fs.realpath(root);
  const rows = [];
  async function walk(p, rel) {
    const st = await fs.lstat(p);
    const mode = st.mode & 0o777;
    if (st.isSymbolicLink()) {
      const link = await fs.readlink(p);
      if (path.isAbsolute(link) || !inside(root, path.resolve(path.dirname(p), link))) throw new Error(`外部符号链接无法完整备份：${rel}`);
      // Preserve dangling in-tree links (e.g. leftover .bin shims) as bytes.
      // All existing link nodes are also visited, so indirect external links are rejected.
      try { if (!inside(root, await fs.realpath(p))) throw new Error(`符号链接越界：${rel}`); }
      catch (e) { if (e.code !== 'ENOENT') throw e; }
      rows.push([rel, 'link', link]);
    } else if (st.isDirectory()) {
      rows.push([rel, 'dir', mode]);
      for (const name of (await fs.readdir(p)).sort()) await walk(path.join(p, name), rel ? rel + '/' + name : name);
    } else if (st.isFile()) rows.push([rel, 'file', mode, st.size, await digest(p)]);
    else throw new Error(`不支持的文件类型：${rel}`);
  }
  await walk(root, '');
  return rows;
}
async function clone(src, dst) {
  await fs.cp(src, dst, { recursive: true, dereference: false, verbatimSymlinks: true, mode: constants.COPYFILE_FICLONE });
}
export class Recovery {
  constructor(profile, store, version = 'unknown') {
    this.profile = path.resolve(profile); this.store = path.resolve(store); this.version = version;
    if (inside(this.profile, this.store) || inside(this.store, this.profile)) throw new Error('恢复目录必须独立于 profile。');
  }
  async init() {
    if ((await fs.lstat(this.profile)).isSymbolicLink()) throw new Error('Profile 不能是符号链接。');
    await fs.mkdir(this.store, { recursive: true, mode: 0o700 });
    await fs.chmod(this.store, 0o700);
  }
  async lock(fn) {
    await this.init();
    const lock = path.join(this.store, 'operation.lock');
    try { await fs.mkdir(lock, { mode: 0o700 }); }
    catch (e) { if (e.code === 'EEXIST') throw new Error('已有恢复操作进行中；如果上次异常退出，请用应急入口解除过期锁。'); throw e; }
    try { await atomicJson(path.join(lock, 'owner.json'), { pid: process.pid }); return await fn(); }
    finally { await fs.rm(lock, { recursive: true, force: true }); }
  }
  async unlockStale() {
    const lock = path.join(this.store, 'operation.lock');
    if (!await exists(lock)) return;
    const owner = await json(path.join(lock, 'owner.json'));
    try { process.kill(owner.pid, 0); throw new Error('操作进程仍在运行，不能解除锁。'); }
    catch (e) { if (e.code !== 'ESRCH') throw e; }
    await fs.rm(lock, { recursive: true });
  }
  async safeTarget(name) {
    const p = path.join(this.profile, name);
    for (let parent = path.dirname(p); parent !== this.profile; parent = path.dirname(parent)) {
      if (await exists(parent) && (await fs.lstat(parent)).isSymbolicLink()) throw new Error('配置父目录不能是符号链接。');
    }
    if (await exists(p) && (await fs.lstat(p)).isSymbolicLink()) throw new Error(`不能备份或覆盖顶层符号链接：${name}`);
    return p;
  }
  async list() {
    await this.init();
    const out = [];
    for (const id of await fs.readdir(this.store)) if (ID.test(id)) {
      try { const m = await json(path.join(this.store, id, 'manifest.json')); if (m.id === id && m.format === 1 && m.profile === this.profile) out.push(m); } catch { /* Incomplete points are not offered. */ }
    }
    return out.sort((a, b) => b.created.localeCompare(a.created)).map(({ trees, ...m }) => m);
  }
  async capture(label = '手动保存', kind = 'manual') { return this.lock(() => this.captureUnlocked(label, kind)); }
  async captureUnlocked(label, kind) {
    if (await exists(path.join(this.store, 'transaction.json'))) throw new Error('发现未完成的恢复事务，请先使用应急入口修复。');
    const id = 'point-' + new Date().toISOString().replace(/[:.Z]/g, '-') + randomUUID().slice(0, 8);
    const temp = path.join(this.store, '.' + id); await fs.mkdir(temp, { mode: 0o700 });
    try {
      const trees = {}; let bytes = 0;
      for (const [i, name] of TRACKED.entries()) {
        const src = await this.safeTarget(name);
        if (!await exists(src)) { trees[name] = null; continue; }
        const before = await inventory(src);
        await clone(src, path.join(temp, String(i)));
        const copied = await inventory(path.join(temp, String(i)));
        const after = await inventory(src);
        if (JSON.stringify(before) !== JSON.stringify(copied) || JSON.stringify(before) !== JSON.stringify(after)) throw new Error('备份期间插件发生变化，请停止安装操作后重试。');
        trees[name] = copied;
        bytes += copied.reduce((sum, row) => sum + (row[1] === 'file' ? row[3] : 0), 0);
      }
      const pkg = await json(path.join(temp, '0'));
      const m = { format: 1, id, created: new Date().toISOString(), label: String(label).trim().slice(0, 100) || '手动保存', kind, profile: this.profile, dshVersion: this.version, bytes, plugins: pkg.dependencies || {}, trees };
      await atomicJson(path.join(temp, 'manifest.json'), m);
      await fs.rename(temp, path.join(this.store, id));
      return { id, label: m.label };
    } catch (e) { await fs.rm(temp, { recursive: true, force: true }); throw e; }
  }
  async verify(id) {
    if (typeof id !== 'string' || !ID.test(id)) throw new Error('恢复点编号无效。');
    const dir = path.join(this.store, id);
    if ((await fs.lstat(dir)).isSymbolicLink()) throw new Error('恢复点不能是符号链接。');
    const m = await json(path.join(dir, 'manifest.json'));
    if (m.format !== 1 || m.id !== id || m.profile !== this.profile || !m.trees || Object.keys(m.trees).sort().join() !== [...TRACKED].sort().join()) throw new Error('恢复点格式或所属环境不匹配。');
    if (m.dshVersion !== this.version) throw new Error(`DSH 版本不同（恢复点 ${m.dshVersion}，当前 ${this.version}），不能直接恢复插件。`);
    for (const [i, name] of TRACKED.entries()) {
      const p = path.join(dir, String(i));
      if (m.trees[name] === null) { if (await exists(p)) throw new Error('恢复点内容不匹配。'); continue; }
      if (JSON.stringify(await inventory(p)) !== JSON.stringify(m.trees[name])) throw new Error(`恢复点文件校验失败：${name}`);
    }
    return m;
  }
  // Caller must stop the DSH host before calling restore. The detached worker enforces this.
  async restore(id) {
    return this.lock(async () => {
      await this.recoverTransaction();
      const m = await this.verify(id);
      const backup = await this.captureUnlocked('回滚前自动保存', 'before-restore');
      const stage = path.join(this.store, 'transaction-' + randomUUID());
      await fs.mkdir(stage, { mode: 0o700 });
      const entries = [];
      try {
        for (const [i, name] of TRACKED.entries()) {
          const target = await this.safeTarget(name);
          entries.push({ name, i, existed: await exists(target) });
          if (m.trees[name] !== null) await clone(path.join(this.store, id, String(i)), path.join(stage, `new-${i}`));
        }
        await atomicJson(path.join(this.store, 'transaction.json'), { stage: path.basename(stage), entries });
        for (const { name, i, existed } of entries) {
          const target = await this.safeTarget(name);
          await fs.mkdir(path.dirname(target), { recursive: true });
          if (existed) await fs.rename(target, path.join(stage, `old-${i}`));
          if (await exists(path.join(stage, `new-${i}`))) await fs.rename(path.join(stage, `new-${i}`), target);
        }
        await fs.rm(path.join(this.store, 'transaction.json'));
        await fs.rm(stage, { recursive: true });
        return { restored: id, backup: backup.id };
      } catch (e) { await this.recoverTransaction(); throw e; }
    });
  }
  async recoverTransaction() {
    const journal = path.join(this.store, 'transaction.json');
    if (!await exists(journal)) return false;
    const j = await json(journal);
    if (!/^transaction-[a-f0-9-]{36}$/.test(j.stage) || !Array.isArray(j.entries) || j.entries.length !== TRACKED.length || j.entries.some((x, i) => x.i !== i || x.name !== TRACKED[i] || typeof x.existed !== 'boolean')) throw new Error('恢复事务记录损坏；保留原文件等待人工处理。');
    const stage = path.join(this.store, j.stage);
    for (const { name, i, existed } of [...j.entries].reverse()) {
      const target = await this.safeTarget(name), old = path.join(stage, `old-${i}`);
      if (await exists(old)) { await fs.rm(target, { recursive: true, force: true }); await fs.rename(old, target); }
      else if (!existed && !await exists(path.join(stage, `new-${i}`))) await fs.rm(target, { recursive: true, force: true });
    }
    await fs.rm(journal); await fs.rm(stage, { recursive: true, force: true }); return true;
  }
}

#!/usr/bin/env node
import { dictionaries, language, translateDiagnostic } from './i18n.js';
import http from 'node:http';
import path from 'node:path';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import { json, Recovery, exists } from './core.js';
import { locations, identity } from './runtime.js';
import { page, route, send } from './http.js';

const args = process.argv.slice(2);
function opt(name, fallback) { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; }
const store = path.resolve(opt('--store', locations(opt('--profile', 'web')).store));
const cmd = args[0] || 'serve';
const lang = language(opt('--lang', process.env.LC_ALL || process.env.LC_MESSAGES || process.env.LANG));
const t = key => dictionaries[lang][key];
try {
  const runtime = await json(path.join(store, 'runtime.json'));
  const engine = new Recovery(runtime.profile, store, runtime.dshVersion);
  if (cmd === 'list') console.log(JSON.stringify(await engine.list(), null, 2));
  else if (cmd === 'capture') console.log(await engine.capture(opt('--label', t('emergency'))));
  else if (cmd === 'repair') {
    if (identity(runtime.pid)) throw new Error('请先关闭 DSH，再修复未完成事务。');
    const pending = path.join(store, 'pending-job.json');
    if (await exists(pending)) {
      const owner = await json(path.join(store, 'worker-owner.json')).catch(() => null);
      if (!owner || identity(owner.pid) === owner.identity) throw new Error('恢复 worker 仍在运行或归属不明，请保留任务记录。');
      await fs.rm(pending);
    }
    await engine.unlockStale();
    console.log(await engine.lock(() => engine.recoverTransaction()) ? t('repaired') : t('noTransaction'));
  } else if (cmd === 'restore') {
    if (identity(runtime.pid)) throw new Error('请先关闭 DSH，或使用 serve 界面的自动重启恢复。');
    if (!args.includes('--yes')) throw new Error('确认恢复时加 --yes；聊天数据不会回滚。');
    console.log(await engine.restore(args[1]));
  } else if (cmd === 'serve') {
    const token = randomBytes(32).toString('hex');
    const server = http.createServer(async (req, res) => {
      const authority = `127.0.0.1:${server.address().port}`;
      if (req.headers.host !== authority) return send(res, 403, { error: '无效主机地址。' });
      const pathname = new URL(req.url, 'http://' + authority).pathname;
      if (req.method === 'GET' && pathname === '/dsh-recovery/') return page(res);
      const candidate = String(req.headers['x-recovery-token'] || '');
      const authorized = /^[a-f0-9]{64}$/.test(candidate) && timingSafeEqual(Buffer.from(candidate), Buffer.from(token));
      return route(req, res, await json(path.join(store, 'runtime.json')), pathname.slice('/dsh-recovery/'.length), authorized);
    });
    server.listen(0, '127.0.0.1', () => {
      const url = `http://127.0.0.1:${server.address().port}/dsh-recovery/${args.includes('--lang') ? '?lang=' + lang : ''}#${token}`;
      console.log(t('cliReady') + '\n' + url);
      if (args.includes('--open')) spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], { stdio: 'ignore' }).unref();
    });
  } else throw new Error('用法：dsh-recovery serve|list|capture|restore <id> --yes|repair [--store <目录>]');
} catch (e) { console.error(translateDiagnostic(e.message, lang)); process.exitCode = 1; }

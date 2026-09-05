import { createShortcut } from './shortcut.js';
import { dictionaries, diagnostics } from './i18n.js';
import fs from 'node:fs/promises';
import { Recovery } from './core.js';
import { status, scheduleRestore } from './runtime.js';

export function send(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(obj));
}
export function sameOrigin(req) {
  try { return new URL(req.headers.origin).host === req.headers.host && ['http:', 'https:'].includes(new URL(req.headers.origin).protocol) && req.headers['sec-fetch-site'] !== 'cross-site'; } catch { return false; }
}
export async function body(req) {
  let text = '';
  if (!String(req.headers['content-type']).startsWith('application/json')) throw new Error('请求必须使用 JSON。');
  for await (const chunk of req) { text += chunk; if (text.length > 4096) throw new Error('请求过大。'); }
  return JSON.parse(text || '{}');
}
export async function route(req, res, runtime, pathname, authorized) {
  if (!authorized) return send(res, 401, { error: '请从已登录的 DSH 打开恢复中心。' });
  try {
    if (req.method === 'GET' && pathname === 'status') return send(res, 200, await status(runtime));
    if (req.method !== 'POST' || !sameOrigin(req)) return send(res, 403, { error: '只接受本页面发出的操作。' });
    const data = await body(req);
    const engine = new Recovery(runtime.profile, runtime.store, runtime.dshVersion);
    if (pathname === 'shortcut') return send(res, 200, await createShortcut(runtime));
    if (pathname === 'capture') {
      if ((await status(runtime)).busy) throw new Error('已有操作进行中。');
      return send(res, 200, await engine.capture(data.label));
    }
    if (pathname === 'restore') {
      if (data.confirm !== 'restore-and-restart') throw new Error('请先确认恢复并重启。');
      return send(res, 202, await scheduleRestore(runtime, data.id));
    }
    return send(res, 404, { error: '没有此操作。' });
  } catch (e) { return send(res, 400, { error: e.message }); }
}
export async function page(res) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'", 'Referrer-Policy': 'no-referrer' });
  const html = await fs.readFile(new URL('./ui.html', import.meta.url), 'utf8');
  res.end(html.replace('/*I18N_DATA*/', 'const I18N = ' + JSON.stringify({dictionaries, diagnostics}).replaceAll('<', '\\u003c') + ';'));
}

import fs from 'node:fs/promises';
import path from 'node:path';
import { locations, installRescue, identity } from './runtime.js';
import { route, page, send } from './http.js';

export const name = 'dsh-recovery-center';
export function apply(ctx, config = {}) {
  ctx.inject(['webServer', 'connection'], async host => {
    try {
      if (process.platform === 'win32') { host.logger?.warn('Recovery Center 0.1 supports macOS/Linux only.'); return; }
      const flag = process.argv.indexOf('--profile');
      const profile = flag >= 0 ? process.argv[flag + 1] : 'web';
      const loc = locations(profile);
      let dshVersion = 'unknown';
      try { dshVersion = JSON.parse(await fs.readFile(path.resolve(process.argv[1], '../../package.json'), 'utf8')).version; } catch {}
      const argv = process.argv.slice(1);
      const controlled = process.env.INVOCATION_ID || process.env.pm_id || process.env.XPC_SERVICE_NAME?.startsWith('application.') || ctx.get('desktopProfiles');
      const runtime = { ...loc, desktopShortcuts: config.desktopShortcut !== false && !process.env.SSH_CONNECTION && !process.env.SSH_TTY, dshVersion, executable: process.execPath, argv, cwd: process.cwd(), pid: process.pid, identity: identity(process.pid), allowRestart: config.allowRestart === true || (!controlled && config.allowRestart !== false), env: Object.fromEntries(['DSH_HOME', 'PATH', 'HOME'].filter(k => process.env[k]).map(k => [k, process.env[k]])) };
      await installRescue(runtime);
      host.effect(() => host.webServer.register({ kind: 'prefix', path: '/dsh-recovery', handler: async (req, res) => {
        if (req.url === '/dsh-recovery') { res.writeHead(302, { location: '/dsh-recovery/' }); res.end(); return; }
        const pathname = new URL(req.url, 'http://localhost').pathname.slice('/dsh-recovery/'.length);
        if (req.method === 'GET' && pathname === '') {
          if (!host.connection.authorizeIndex(req, res)) return;
          return page(res);
        }
        const rejection = host.connection.requestRejection(req);
        if (rejection) return send(res, rejection, { error: '请先登录 DSH。' });
        return route(req, res, runtime, pathname, true);
      }}), 'dsh-recovery-center: routes');
    } catch (e) { host.logger?.warn(`Recovery Center 未启动：${e.message}`); }
  });
}

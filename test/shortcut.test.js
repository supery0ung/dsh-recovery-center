import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createShortcut, launcher, shortcutStatus } from '../src/shortcut.js';
const exec = promisify(execFile);
async function setup(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'recovery-launcher-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const desktop=path.join(root,'Desktop');await fs.mkdir(desktop);
 const runtime={store:path.join(root,"my ' profile $(printf BAD)"),executable:path.join(root,"my ' node"),desktopShortcuts:true};
 await fs.writeFile(runtime.executable,'#!/bin/sh\nprintf "%s\\n" "$@"\n',{mode:0o700});
 return {root,desktop,runtime};
}
test('macOS creates executable launcher with safely quoted per-installation paths',async t=>{
 const {desktop,runtime}=await setup(t);const result=await createShortcut(runtime,{platform:'darwin',desktop});
 assert.equal(result.state,'desktop');assert.ok(result.desktop.endsWith('.command'));assert.equal((await fs.stat(result.desktop)).mode&0o777,0o700);
 const {stdout}=await exec('/bin/sh',[result.desktop]);assert.deepEqual(stdout.trim().split('\n'),[path.join(runtime.store,'rescue/cli.js'),'serve','--store',runtime.store,'--open']);
 await fs.unlink(result.desktop);assert.equal((await shortcutStatus(runtime)).state,'saved');
 assert.equal((await createShortcut(runtime,{platform:'darwin',desktop})).state,'desktop');
});
test('existing unowned file is not overwritten; canonical rescue remains available',async t=>{
 const {desktop,runtime}=await setup(t);const s=launcher(runtime,'darwin');const dest=path.join(desktop,`DSH Emergency Recovery-${s.fingerprint}.command`);
 await fs.writeFile(dest,'user file');const result=await createShortcut(runtime,{platform:'darwin',desktop});
 assert.equal(result.state,'conflict');assert.equal(await fs.readFile(dest,'utf8'),'user file');assert.ok(await fs.stat(result.path));
});
test('SSH/server installs and missing desktops retain standalone launch file',async t=>{
 const {runtime,desktop}=await setup(t);runtime.desktopShortcuts=false;
 const result=await createShortcut(runtime,{platform:'darwin',desktop});assert.equal(result.state,'saved');assert.deepEqual(await fs.readdir(desktop),[]);
 const linux=await createShortcut(runtime,{platform:'linux',desktop});assert.ok(linux.path.endsWith('.sh'));
});

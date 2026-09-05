import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { route } from '../src/http.js';

test('HTTP rejects unauthenticated, cross-origin and non-JSON mutations without creating backups',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'recovery-http-'));
  const runtime={profile:path.join(root,'profile'),store:path.join(root,'store'),dshVersion:'test'};
  await fs.mkdir(runtime.profile);await fs.writeFile(path.join(runtime.profile,'package.json'),'{"dependencies":{}}');
  const server=http.createServer((req,res)=>route(req,res,runtime,req.url.slice(1),req.headers.authorization==='test'));
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  t.after(async()=>{await new Promise(r=>server.close(r));await fs.rm(root,{recursive:true,force:true})});
  const origin=`http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(origin+'/status')).status,401);
  assert.equal((await fetch(origin+'/capture',{method:'POST',headers:{Authorization:'test',Origin:'https://evil.example','Content-Type':'application/json'},body:'{}'})).status,403);
  assert.equal((await fetch(origin+'/capture',{method:'POST',headers:{Authorization:'test',Origin:origin,'Content-Type':'text/plain'},body:'{}'})).status,400);
  assert.equal((await fs.readdir(root)).includes('store'),false);
  const capture=await fetch(origin+'/capture',{method:'POST',headers:{Authorization:'test',Origin:origin,'Content-Type':'application/json'},body:'{"label":"safe"}'});
  assert.equal(capture.status,200);assert.match((await capture.json()).id,/^point-/);
});

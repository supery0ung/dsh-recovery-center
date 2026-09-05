import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {Recovery,atomicJson,json,exists} from '../src/core.js';
import {identity,installRescue,scheduleRestore} from '../src/runtime.js';

test('detached worker restores and relaunches a host even when restored profile has no recovery plugin', {timeout:20000},async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'recovery-worker-'));
  const profile=path.join(root,'profile'),store=path.join(root,'store');
  await fs.mkdir(path.join(profile,'node_modules/example'),{recursive:true});
  await atomicJson(path.join(profile,'package.json'),{dependencies:{example:'1'}});
  await fs.writeFile(path.join(profile,'node_modules/example/index.js'),'good');
  const reserve=http.createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));
  const port=reserve.address().port;await new Promise(r=>reserve.close(r));
  const fake=path.join(root,'fake-host.mjs');
  await fs.writeFile(fake,`import http from 'node:http';http.createServer((q,s)=>{s.writeHead(401);s.end()}).listen(Number(process.argv[3]),'127.0.0.1');`);
  const host=spawn(process.execPath,[fake,'--port',String(port)],{stdio:'ignore'});
  await new Promise(r=>host.once('spawn',r));
  const runtime={profile,store,dshVersion:'test',pid:host.pid,identity:identity(host.pid),executable:process.execPath,argv:[fake,'--port',String(port)],cwd:root,env:{},allowRestart:true};
  t.after(async()=>{try{const r=await json(path.join(store,'runtime.json'));if(identity(r.pid)===r.identity)process.kill(r.pid,'SIGTERM')}catch{}try{host.kill()}catch{}await fs.rm(root,{recursive:true,force:true})});
  await installRescue(runtime);const engine=new Recovery(profile,store,'test');const point=await engine.capture('before');
  await fs.writeFile(path.join(profile,'node_modules/example/index.js'),'bad');
  await fs.writeFile(path.join(profile,'chat.txt'),'latest');
  await scheduleRestore(runtime,point.id);
  let result;
  for(let i=0;i<100;i++){
    result=await json(path.join(store,'result.json')).catch(()=>null);
    if(['done','error'].includes(result?.state))break;
    await new Promise(r=>setTimeout(r,100));
  }
  assert.equal(result?.state,'done',JSON.stringify(result));
  assert.equal(await fs.readFile(path.join(profile,'node_modules/example/index.js'),'utf8'),'good');
  assert.equal(await fs.readFile(path.join(profile,'chat.txt'),'utf8'),'latest');
  assert.notEqual((await json(path.join(store,'runtime.json'))).pid,host.pid);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { Recovery, TRACKED, atomicJson, exists } from '../src/core.js';
import { sameOrigin } from '../src/http.js';

async function fixture(t) {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'dsh-recovery-test-'));
  t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const profile=path.join(root,'profile');await fs.mkdir(path.join(profile,'node_modules/plugin'),{recursive:true});
  await atomicJson(path.join(profile,'package.json'),{dependencies:{plugin:'1.0.0'}});
  await fs.writeFile(path.join(profile,'node_modules/plugin/index.js'),'working');
  await fs.writeFile(path.join(profile,'chats.json'),'keep latest chat');
  const engine=new Recovery(profile,path.join(root,'store'),'0.1.2-rc.1');
  return {root,profile,engine};
}
test('restores offline plugin bytes, deletes later optional config, preserves chats, creates undo point',async t=>{
  const {profile,engine}=await fixture(t);const point=await engine.capture('good');
  await fs.writeFile(path.join(profile,'node_modules/plugin/index.js'),'broken');
  await fs.writeFile(path.join(profile,'cordis.patch.yml'),'bad patch');
  await fs.writeFile(path.join(profile,'chats.json'),'newer chat');
  const result=await engine.restore(point.id);
  assert.equal(await fs.readFile(path.join(profile,'node_modules/plugin/index.js'),'utf8'),'working');
  assert.equal(await exists(path.join(profile,'cordis.patch.yml')),false);
  assert.equal(await fs.readFile(path.join(profile,'chats.json'),'utf8'),'newer chat');
  await engine.restore(result.backup);
  assert.equal(await fs.readFile(path.join(profile,'node_modules/plugin/index.js'),'utf8'),'broken');
});
test('corrupt snapshot is rejected before live files change',async t=>{
  const {profile,engine}=await fixture(t);const p=await engine.capture('good');
  await fs.writeFile(path.join(engine.store,p.id,'5/plugin/index.js'),'tampered');
  await assert.rejects(engine.restore(p.id),/校验失败/);
  assert.equal(await fs.readFile(path.join(profile,'node_modules/plugin/index.js'),'utf8'),'working');
});
test('path traversal and version drift cannot restore',async t=>{
  const {engine}=await fixture(t);const p=await engine.capture('good');
  await assert.rejects(engine.verify('../escape'),/编号无效/);
  engine.version='future';await assert.rejects(engine.verify(p.id),/版本不同/);
});
test('in-tree symlinks survive; external links are refused',async t=>{
  const {profile,engine,root}=await fixture(t);
  await fs.symlink('plugin',path.join(profile,'node_modules/alias'));
  await fs.symlink('missing-file',path.join(profile,'node_modules/dangling'));
  const p=await engine.capture('links');await engine.restore(p.id);
  assert.equal(await fs.readlink(path.join(profile,'node_modules/alias')),'plugin');
  assert.equal(await fs.readlink(path.join(profile,'node_modules/dangling')),'missing-file');
  await fs.writeFile(path.join(root,'secret'),'private');
  await fs.symlink('../../secret',path.join(profile,'node_modules/escape'));
  await assert.rejects(engine.capture('invalid'),/符号链接/);
});
test('crash journal restores originals from a half-completed transaction',async t=>{
  const {engine,profile}=await fixture(t);await engine.init();
  const stage='transaction-12345678-1234-1234-1234-123456789abc';await fs.mkdir(path.join(engine.store,stage));
  const entries=[];
  for(const [i,name] of TRACKED.entries())entries.push({i,name,existed:await exists(path.join(profile,name))});
  await fs.rename(path.join(profile,'package.json'),path.join(engine.store,stage,'old-0'));
  await atomicJson(path.join(profile,'package.json'),{dependencies:{bad:'2'}});
  await atomicJson(path.join(engine.store,'transaction.json'),{stage,entries});
  await engine.recoverTransaction();
  assert.equal(JSON.parse(await fs.readFile(path.join(profile,'package.json'),'utf8')).dependencies.plugin,'1.0.0');
});
test('concurrent operations are refused',async t=>{
  const {engine}=await fixture(t);
  await engine.lock(async()=>{await assert.rejects(engine.capture('race'),/已有恢复操作/)});
});
test('cross-origin and missing origin writes are rejected',()=>{
  assert.equal(sameOrigin({headers:{host:'dsh.local:8443',origin:'https://evil.example'}}),false);
  assert.equal(sameOrigin({headers:{host:'dsh.local:8443'}}),false);
  assert.equal(sameOrigin({headers:{host:'dsh.local:8443',origin:'https://dsh.local:8443'}}),true);
});

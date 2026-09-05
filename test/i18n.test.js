import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {dictionaries,language,translateDiagnostic} from '../src/i18n.js';
import {page} from '../src/http.js';
test('both languages cover static UI, progress, and confirmations',async()=>{
 assert.deepEqual(Object.keys(dictionaries.zh).sort(),Object.keys(dictionaries.en).sort());
 const html=await fs.readFile(new URL('../src/ui.html',import.meta.url),'utf8');
 for(const [,key] of html.matchAll(/data-key="([^"]+)"/g))assert.ok(dictionaries.en[key]&&dictionaries.zh[key],key);
 for(const state of ['verifying','stopping','restoring','starting','done'])assert.ok(dictionaries.en[state]);
 assert.equal(language('zh-CN'),'zh');assert.equal(language('en_US.UTF-8'),'en');assert.equal(language('ja'),'en');
});
test('existing saved backend errors translate without changing filenames or versions',()=>{
 assert.equal(translateDiagnostic('恢复点文件校验失败：node_modules','en'),'Recovery point integrity check failed: node_modules');
 assert.equal(translateDiagnostic('DSH 版本不同（恢复点 0.1，当前 0.2），不能直接恢复插件。','en'),'DSH version mismatch (saved: 0.1, current: 0.2). Plugin restore is blocked.');
 assert.equal(translateDiagnostic('已有操作进行中。','zh'),'已有操作进行中。');
});
test('served page contains complete dictionaries and valid inline JavaScript',async()=>{
 let html='';await page({writeHead(){},end(value){html=value}});
 assert.ok(!html.includes('/*I18N_DATA*/'));assert.ok(html.includes('Recovery Center'));
 const script=html.split('<script>')[1].split('</script>')[0];assert.doesNotThrow(()=>new Function(script));
});

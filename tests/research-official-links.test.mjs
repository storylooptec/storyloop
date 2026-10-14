import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const competition = new URL('../src/brand/competition.ts', import.meta.url).href;
let addresses = [];
let calls = 0;
let status = 200;
globalThis.__officialLinksFixture = {
  lookup: async () => addresses,
  request: (url, options, callback) => {
    calls++;
    assert.equal(url.hostname, 'brand.example');
    assert.equal(options.family, 4);
    options.lookup(url.hostname, {}, (error, address, family) => {
      assert.equal(error, null); assert.equal(address, addresses[0].address); assert.equal(family, 4);
    });
    assert.equal(options.headers.Authorization, undefined);
    const request = new EventEmitter();
    request.destroy = () => request.emit('close');
    request.end = () => queueMicrotask(() => {
      const response = new EventEmitter();
      response.statusCode = status; response.headers = {'content-type':'text/html'};
      response.destroy = () => {};
      callback(response);
      response.emit('data', Buffer.from('<a href="https://www.instagram.com/officialbrand/">Instagram</a><a href="https://attacker.example/">other</a><a href="http://127.0.0.1/">private</a>'));
      response.emit('end'); request.emit('close');
    });
    return request;
  },
};
const source = (await readFile(new URL('../src/lib/research/official-links.ts', import.meta.url),'utf8'))
  .replace('import "server-only";', '')
  .replace('import { lookup } from "node:dns/promises";', 'const {lookup}=globalThis.__officialLinksFixture;')
  .replace('import { request } from "node:https";', 'const {request}=globalThis.__officialLinksFixture;')
  .replace('from "@/brand/competition"', `from ${JSON.stringify(competition)}`);
const code = ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {officialSocialLinks} = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

test('official link reads reject private/mixed DNS and non-HTTPS sources',async()=>{
  for(const address of ['127.0.0.1','10.0.0.1','169.254.169.254','172.16.1.1','192.168.1.1','100.64.0.1','::1']){
    addresses=[{address,family:4}]; assert.deepEqual(await officialSocialLinks('https://brand.example/'),[]);
  }
  addresses=[{address:'93.184.216.34',family:4},{address:'10.0.0.1',family:4}];
  assert.deepEqual(await officialSocialLinks('https://brand.example/'),[]);
  assert.deepEqual(await officialSocialLinks('http://brand.example/'),[]);
  assert.equal(calls,0);
});
test('public link reads pin checked DNS and retain only social profile URLs',async()=>{
  addresses=[{address:'93.184.216.34',family:4}];
  assert.deepEqual(await officialSocialLinks('https://brand.example/'),['https://www.instagram.com/officialbrand/']);
  assert.equal(calls,1);
  status=302;
  assert.deepEqual(await officialSocialLinks('https://brand.example/'),[]);
  assert.equal(calls,2,'redirects must not trigger another network request');
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const compile = source => 'data:text/javascript;base64,' + Buffer.from(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText).toString('base64');
const importUrl = compile(readFileSync(new URL('../src/discover/import.ts',import.meta.url),'utf8'));
const validation = await import(importUrl);
const model = await import(compile(readFileSync(new URL('../src/discover/model.ts',import.meta.url),'utf8').replace("'./import'",JSON.stringify(importUrl))));
const files = await import(compile(readFileSync(new URL('../src/discover/files.ts',import.meta.url),'utf8').replace("'./import'",JSON.stringify(importUrl)).replace("'read-excel-file/node'",JSON.stringify(import.meta.resolve('read-excel-file/node'))).replace("'csv-parse/sync'",JSON.stringify(import.meta.resolve('csv-parse/sync')))));
const {previewRows,suggestMapping,instagramHandle,emptyFields}=validation;
const doc = rows => ({filename:'test.csv',sheet:'CSV',headers:['NAME','INSTAGRAM URL','ER','INSTAGRAM FOLLOWERS','REEL POST','E-MAIL','FACEBOOK URL','LOCATION','Category'],rows});
const preview = d => previewRows(d,suggestMapping(d.headers));
test('normalizes Instagram identities without accepting posts or misleading hosts',()=>{
 for(const v of ['@Hello.World','HELLO.WORLD','https://www.instagram.com/Hello.World/?igsh=xyz'])assert.equal(instagramHandle(v),'hello.world');
 for(const v of ['https://evil.test/hello','https://instagram.com.evil.test/hello','https://instagram.com/p/123','https://instagram.com/hello/extra','hello..world','https://user@instagram.com/hello'])assert.equal(instagramHandle(v),null);
});
test('fraction ER, explicit percentages, zero, missing values and raw source preservation',()=>{
 const d=doc([[' Test ','@Tester',.0404,0,150000,null,null,null,'BOLD'],['Other','other','4.04%',null,null,null,null,null,null]]);
 const rows=preview(d);assert.equal(rows[0].fields.er,.0404);assert.equal(model.display(rows[0].fields.er,true),'4.04%');assert.equal(rows[1].fields.er,.0404);assert.equal(rows[0].fields.followers,0);assert.equal(rows[1].fields.followers,null);assert.equal(rows[0].raw[0],' Test ');assert.equal(rows[0].row,2);assert.equal(rows[0].fields.location,null);
});
test('rejects ambiguous numbers, URLs, email, unmapped required fields and duplicate mapping',()=>{
 const rows=preview(doc([['Test','tester',4.04,'84K',-1,'broken','javascript:alert(1)',null,null]]));assert.equal(rows[0].status,'invalid');assert.ok(rows[0].errors.length>=4);
 assert.throws(()=>previewRows(doc([['x']]),{}),/Map NAME/);
 assert.throws(()=>previewRows(doc([['x']]),{name:0,instagram:0}),/only be mapped once/);
});
test('flags ALL in-file duplicates, existing duplicates, and empty rows without dropping any row',()=>{
 const d=doc([['A','@same'],['B','https://instagram.com/SAME/?x=y'],['C','already'],[null,null]]);
 const rows=previewRows(d,suggestMapping(d.headers),new Map([['already','Already saved']]));
 assert.deepEqual(rows.map(r=>r.status),['duplicate','duplicate','duplicate','empty']);assert.equal(rows.length,4);
});
test('filters all supported fields, sorts with missing last in both directions, preserves zero',()=>{
 const make=(id,name,followers,location,category)=>({id,primaryHandle:id,fields:{...emptyFields(),name,followers,location,category,instagram:`https://instagram.com/${id}/`},handle:id,socials:[],updatedAt:'2026-01-01'});
 const data=[make('a','Alpha',100,'Mumbai','Fashion'),make('b','Beta',null,null,'Food'),make('c','Gamma',0,'Delhi','Fashion')];
 assert.deepEqual(model.filterCreators(data,{...model.initialFilters,sort:'followers'}).map(r=>r.id),['a','c','b']);
 assert.deepEqual(model.filterCreators(data,{...model.initialFilters,sort:'followers',direction:'asc'}).map(r=>r.id),['c','a','b']);
 assert.equal(model.filterCreators(data,{...model.initialFilters,search:'@b'}).length,1);
 assert.equal(model.filterCreators(data,{...model.initialFilters,location:'Mumbai',category:'Fashion',platform:'Instagram',completeness:'missing'}).length,1);
 assert.equal(model.filterCreators(data,{...model.initialFilters,search:'absent'}).length,0);
});
test('CSV handles quoted newlines, BOM, trailing blanks and surplus cells without loss',async()=>{
 const {document}=await files.readImport(Buffer.from('\ufeffNAME,INSTAGRAM URL,LOCATION\r\n"A, B",tester,"New\nDelhi"\r\nOther,other,,extra\r\n'),'test.csv');
 assert.equal(document.rows[0][0],'A, B');assert.equal(document.rows[0][2],'New\nDelhi');assert.equal(document.rows[1][3],'extra');assert.equal(document.headers.length,4);
});
test('oversized sheets and malformed files fail explicitly',async()=>{
 await assert.rejects(files.readImport(Buffer.from('NAME,INSTAGRAM URL\n'+Array.from({length:501},()=> 'A,a').join('\n')),'too-many.csv'),/exceeds 500/);
 await assert.rejects(files.readImport(Buffer.from('"unterminated'),'broken.csv'));
});
if(process.env.DISCOVER_SAMPLE_PATH)test('supplied XLSX is read and validated without importing it',async()=>{
 const {document}=await files.readImport(readFileSync(process.env.DISCOVER_SAMPLE_PATH),'discover creators.xlsx');
 const rows=preview(document);assert.equal(rows.length,20);assert.equal(rows[0].fields.er,.0404);assert.equal(rows[0].fields.reel,150000);assert.equal(rows[0].fields.location,null);assert.equal(rows[0].serial,1);console.log('Sample validation errors:',rows.filter(r=>r.errors.length).map(r=>({row:r.row,serial:r.serial,errors:r.errors})));console.log('Sample row statuses:',rows.reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{}));
});

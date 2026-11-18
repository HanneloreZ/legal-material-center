import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import JSZip from 'jszip';
import sharp from 'sharp';
import {DOMParser} from '@xmldom/xmldom';
import {indexedDB} from 'fake-indexeddb';
import {domains,documentTemplates,imageTemplates} from '../online/materials/catalog.js';
import {exampleDocument,documentWord,cleanDocument,documentBlocks} from '../online/materials/documents.js';
import {documentPages} from '../online/materials/pages.js';
import {exampleImage,cleanImage,imagePages,imageTranscript} from '../online/materials/images.js';
import {originalFromFile,prepareOriginal} from '../online/materials/originals.js';
import {materialsRequest} from '../online/materials/render.js';
import {materialsDemo} from '../online/materials/demo.js';
import {MaterialsStore} from '../online/materials/store.js';
import {renderMaterial,validateDocument,validateRequest} from '../online/shared/adapters.js';
import {BatchRunner,MemoryStore,digest,validateBatch} from '../online/shared/batch.js';
import {svgTextRuns} from '../online/shared/pdf.js';
const root=fileURLToPath(new URL('../',import.meta.url)),out=path.join(root,'work/materials-qa');
await fs.mkdir(out,{recursive:true});
const font=(await fs.readFile(path.join(root,'online/public/fonts/NotoSansSC-Regular.ttf'))).toString('base64');
const deps={Parser:DOMParser,fontLoader:async()=>font,rasterize:async p=>'data:image/png;base64,'+(await sharp(Buffer.from(p.svg)).png().toBuffer()).toString('base64')};
function pass(s){console.log('PASS',s);}
function checkGeometry(pages){for(const p of pages)for(const r of svgTextRuns(p.svg,DOMParser)){assert(r.x>=0&&r.x<=p.width);assert(r.y>0&&r.y<p.height,JSON.stringify(r));}}
const norm=s=>s.replace(/\s/g,'');
assert.equal(new Set(documentTemplates.map(t=>t.id)).size,documentTemplates.length);
for(const d of domains)assert(documentTemplates.some(t=>t.domain===d.id));
for(const t of documentTemplates){
  const d=exampleDocument(t.id);assert.deepEqual(cleanDocument(d),d);
  const blob=await documentWord(d),z=await JSZip.loadAsync(await blob.arrayBuffer()),xml=await z.file('word/document.xml').async('string');
  for(const s of d.sections)assert(xml.includes(s.heading.replace(/&/g,'&amp;')));
  assert((await z.file('word/header1.xml').async('string')).includes('合成案例材料'));
  const pages=documentPages(d);checkGeometry(pages);
  assert(norm(pages.flatMap(p=>svgTextRuns(p.svg,DOMParser).map(r=>r.text)).join('')).includes(norm(d.sections.at(-1).body)));
}
pass(`${documentTemplates.length}类文书覆盖7门类；真实DOCX、合成标识与末节正文完整`);
const memo=exampleDocument('legal-research-memo');
assert(documentTemplates.find(t=>t.id===memo.template_id).common);
assert.equal(memo.fields.date,'{{备忘录日期}}');assert.equal(memo.fields.factCutoff,'{{事实资料截止日}}');assert.equal(memo.fields.researchCutoff,'{{法律研究截止日}}');
const sourceSections=JSON.stringify(memo.sections);memo.fields.date='2030-03-04';memo.fields.factCutoff='2030-02-28';memo.fields.researchCutoff='2030-03-01';memo.fields.reviewStatus='初步研究，尚待负责人复核';
const memoText=documentBlocks(memo).map(b=>b.text).join('\n');
for(const value of ['2030-03-04','2030-02-28','2030-03-01','初步研究，尚待负责人复核'])assert(memoText.includes(value));
assert(!/\{\{(?:备忘录日期|事实资料截止日|法律研究截止日)\}\}/.test(memoText));assert.equal(JSON.stringify(memo.sections),sourceSections);
pass('通用法律备忘录保留研究阶段；三个日期独立替换且不改写模板原文');
const escaped=exampleDocument('term-sheet');escaped.sections[0].body='<script>not executed</script> & "data"';
assert(!documentPages(escaped)[0].svg.includes('<script>'));assert(documentPages(escaped)[0].svg.includes('&lt;script&gt;'));
assert.throws(()=>cleanDocument({...escaped,private_gold:'secret'}),/不支持/);
const long=exampleDocument('statement-claim');long.sections=[{heading:'完整长文',body:'【段落序号】仅为合成输入，日期、金额和限定语保持。'.repeat(700)+'结尾标记END'}];
const longPages=documentPages(long);assert(longPages.length>3);checkGeometry(longPages);
assert(norm(longPages.flatMap(p=>svgTextRuns(p.svg,DOMParser).filter(r=>r.size===16).map(r=>r.text)).join('')).includes(norm(long.sections[0].body)));
pass('长文多页无截断，最后一段与XML转义保留，额外私有字段被拒绝');

for(const t of imageTemplates){
  const d=exampleImage(t.id);assert.deepEqual(cleanImage(d),d);checkGeometry(imagePages(d));
  const request=await materialsRequest('images',d);request.documents[0].formats=['pdf','png','svg','docx'];
  const files=await renderMaterial(request.documents[0],deps);
  for(const f of files){const suffix=f.path.match(/_p\d+/)?.[0]||'';const target=path.join(out,t.id+suffix+'.'+f.format);await fs.writeFile(target,Buffer.from(await f.blob.arrayBuffer()));}
  const pdf=files.find(f=>f.format==='pdf');await fs.writeFile(path.join(out,t.id+'.pdf'),Buffer.from(await pdf.blob.arrayBuffer()));
  const extracted=execFileSync('pdftotext',[path.join(out,t.id+'.pdf'),'-'],{encoding:'utf8'});
  assert(extracted.includes('合成案例材料'));if(t.id==='chat')assert(norm(extracted).includes(norm(d.data.messages.at(-1).body)));
  const docx=await JSZip.loadAsync(await files.find(f=>f.format==='docx').blob.arrayBuffer());assert((await docx.file('word/document.xml').async('string')).includes('内容转录'));
}
const manyChat=exampleImage('chat');manyChat.title='长标题'.repeat(25);manyChat.data.messages=[{side:'right',time:'2026-09-18',body:'消息内容'.repeat(1200)+'消息结束END'}];
const chatPages=imagePages(manyChat);assert(chatPages.length>2);checkGeometry(chatPages);assert.equal(norm(chatPages.flatMap(p=>svgTextRuns(p.svg,DOMParser).filter(r=>r.size===18).map(r=>r.text)).join('')),norm(manyChat.data.messages[0].body));
const fullDiagram=exampleImage('diagram');fullDiagram.data.nodes=Array.from({length:12},(_,i)=>({id:'N'+i,label:'长节点名称'.repeat(15)}));fullDiagram.data.edges=[{from:'N0',to:'N11',label:'长路径说明'}];fullDiagram.data.note='图示说明'.repeat(250);checkGeometry(imagePages(fullDiagram));
const bad=exampleImage('diagram');bad.data.edges[0].to='not-a-node';assert.throws(()=>cleanImage(bad),/已有节点/);
const attendance=exampleImage('attendance');attendance.data.system='很长的系统名称'.repeat(8);attendance.data.events[0].place='多层详细地点'.repeat(15);checkGeometry(imagePages(attendance));
pass('4类图片真实PDF/PNG/SVG/转录DOCX；长消息续页、12节点与长说明不裁切');

for(const domain of domains){
  const t=documentTemplates.find(t=>t.domain===domain.id),d=exampleDocument(t.id),request=await materialsRequest('documents',d),doc=request.documents[0];
  const files=await renderMaterial(doc,deps);
  for(const f of files)await fs.writeFile(path.join(out,t.id+'.'+f.format),Buffer.from(await f.blob.arrayBuffer()));
  const pdfPath=path.join(out,t.id+'.pdf'),info=execFileSync('pdfinfo',[pdfPath],{encoding:'utf8'});assert(info.includes('595.28 x 841.89'));
  const extracted=execFileSync('pdftotext',[pdfPath,'-'],{encoding:'utf8'});assert(norm(extracted).includes(norm(d.title)));assert(norm(extracted).includes(norm(d.sections.at(-1).body)));
}
pass('7门类代表文书DOCX与A4可检索PDF实际导出和文字核对通过');

const base=await documentWord(exampleDocument('employee-confidentiality')),z=await JSZip.loadAsync(await base.arrayBuffer());
const xml=await z.file('word/document.xml').async('string');z.file('word/document.xml',xml.replace('</w:body>','<w:p><w:ins w:id="1"><w:r><w:t>新增修订</w:t></w:r></w:ins><w:del w:id="2"><w:r><w:delText>删除修订</w:delText></w:r></w:del></w:p></w:body>'));
z.file('word/comments.xml','<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>');
z.file('word/_rels/document.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="hyperlink1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.invalid/source" TargetMode="External"/></Relationships>');
const revised=await z.generateAsync({type:'uint8array'}),original=await originalFromFile(new File([revised],'带修订_合成测试.docx'));
const prepared=await prepareOriginal(original);assert.equal(prepared.inspection.tracked_insertions,1);assert.equal(prepared.inspection.tracked_deletions,1);assert(prepared.inspection.has_comments);assert.equal(prepared.inspection.external_hyperlinks,1);
assert.equal(await digest(prepared.blob),original.file.sha256);assert.equal(prepared.source.redaction_verified_by_workbench,false);
await fs.writeFile(path.join(out,'带修订_合成测试.docx'),revised);
await assert.rejects(()=>prepareOriginal({...original,file:{...original.file,sha256:'0'.repeat(64)}}),/SHA256/);
const altered=z;altered.file('word/_rels/document.xml.rels','<Relationships><Relationship Type="http://example/attachedTemplate" Target="file:///private/file" TargetMode="External"/></Relationships>');
await assert.rejects(async()=>originalFromFile(new File([await altered.generateAsync({type:'uint8array'})],'bad.docx')),/外部/);
const png=await sharp({create:{width:10,height:10,channels:3,background:'white'}}).png().toBuffer(),jpeg=await sharp(png).jpeg().toBuffer();
const originalModels=[original];
for(const [name,data] of [['image.png',png],['image.jpg',jpeg],['image.jpeg',jpeg],['日志.txt',Buffer.from([0xc4,0xe3,0xba,0xc3])],['记录.md',Buffer.from('# 原始记录\n')],['原PDF.pdf',await fs.readFile(path.join(out,'employment-contract.pdf'))]]){
  const m=await originalFromFile(new File([data],name));assert.equal(await digest((await prepareOriginal(m)).blob),m.file.sha256);originalModels.push(m);
}
pass('DOCX修订、批注、公开超链接与7种原件格式保留原字节；旧编码文本不转码；哈希冲突被拒绝');

const demo=await materialsDemo();assert.deepEqual(await validateRequest(demo),[]);
const requests=await Promise.all(originalModels.map(m=>materialsRequest('original',m))),request={schema_version:'material-batch/1',batch_id:'qa-originals',name:'原件保真验收',documents:requests.flatMap(r=>r.documents)};
assert.deepEqual(validateBatch(request),[]);
const store=new MemoryStore(),runner=new BatchRunner({store,render:renderMaterial,validate:validateDocument});
await runner.stage(request);assert.equal((await runner.run(request.batch_id)).status,'succeeded');
const business=await runner.package(request.batch_id,'candidate'),authoring=await runner.package(request.batch_id,'authoring');
await fs.writeFile(path.join(out,'original-business.zip'),Buffer.from(await business.blob.arrayBuffer()));await fs.writeFile(path.join(out,'original-authoring.zip'),Buffer.from(await authoring.blob.arrayBuffer()));
const recovery=await fs.mkdtemp(path.join(out,'recovered-'));const recovered=JSON.parse(execFileSync('python3',['tools/collect_workbench.py','--business-package',path.join(out,'original-business.zip'),'--authoring-package',path.join(out,'original-authoring.zip'),'--output',recovery],{cwd:root,encoding:'utf8'}));assert.equal(recovered.files,7);
const mapping=JSON.parse(await (await JSZip.loadAsync(await authoring.blob.arrayBuffer())).file('文件映射.json').async('string'));
for(const a of mapping.artifacts){const model=originalModels.find(m=>m.file.sha256===a.sha256&&m.file.format===a.format);assert(model);assert.deepEqual(a.source_record.filename,model.file.name);assert.equal(a.producer,'original');}
assert((await runner.status(request.batch_id)).documents.every(d=>d.attempts===1));await runner.run(request.batch_id);assert((await runner.status(request.batch_id)).documents.every(d=>d.attempts===1));
pass('原件批量保存、双包下载、Python真实回收、来源记录及重复制作复用通过');

const drafts=new MaterialsStore(indexedDB),workspace={schema_version:'materials-workspace/1',items:[{engine:'original',model:original,formats:['docx']}]};await drafts.put(workspace);assert.deepEqual(await new MaterialsStore(indexedDB).get(),workspace);
pass('IndexedDB草稿恢复保留原件数据和格式选择');
await fs.writeFile(path.join(out,'results.json'),JSON.stringify({document_templates:documentTemplates.length,image_templates:imageTemplates.length,domains:domains.length,original_formats:7,checks:'passed'},null,2));

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import sharp from 'sharp';
import JSZip from 'jszip';
import {BatchRunner,MemoryStore,validateBatch} from '../online/shared/batch.js';
import {editorRequest,assignRevisions,validateDocument,renderMaterial,templateExample,batchInputSchema} from '../online/shared/adapters.js';
import {screenshotExample} from '../online/screenshots/batch.js';

const out=new URL('../work/screenshots-qa/',import.meta.url);await fs.mkdir(out,{recursive:true});
const project=screenshotExample('group'),request=await editorRequest('screenshots',project);
assert.deepEqual(validateBatch(request),[]);
assert.deepEqual(await validateDocument(request.documents[0]),[]);
assert(batchInputSchema.properties.documents.items.properties.engine.enum.includes('screenshots'));
assert.equal((await templateExample('screenshots','loan')).project.messages[4].type,'transfer');
await assert.rejects(templateExample('screenshots','unknown'),/未找到/);
await assert.rejects(editorRequest('screenshots',{cases:[]}),/1至100/);
await assert.rejects(editorRequest('screenshots',{...project,messages:[]}),/一条/);
const doc=request.documents[0];
assert((await validateDocument({...doc,appearance:'scan'})).length);
assert((await validateDocument({...doc,formats:['pdf']})).length);
assert(validateBatch({...request,documents:[{...doc,formats:['docx']}]}).length);

// A deterministic canvas double exercises the adapter and real PNG/ZIP contracts.
// Actual browser pixels, fonts and image decoding are checked separately.
let overlays=0;
const png=await sharp({create:{width:1206,height:2622,channels:3,background:'#ededed'}}).png().toBuffer();
const ctx=new Proxy({measureText:t=>({width:Array.from(t).length*16}),strokeRect:()=>{overlays++;}},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
const dependencies={createCanvas:()=>({getContext:()=>ctx,toBlob:cb=>cb(new Blob([png],{type:'image/png'}))}),loadScreenshotAssets:async()=>({})};
const store=new MemoryStore(),runner=new BatchRunner({store,validate:validateDocument,render:d=>renderMaterial(d,dependencies)});
await runner.stage(request);assert.equal((await runner.run(request.batch_id)).status,'succeeded');
const saved=await store.get(request.batch_id),artifact=saved.documents[0].artifacts[0];
assert.equal(overlays,0);assert.equal(artifact.producer,'screenshots');
assert.equal(artifact.screenshot_annotation.image.width,1206);assert.equal(artifact.screenshot_annotation.image.height,2622);
for(const rect of artifact.screenshot_annotation.rect_attrs){assert(rect.x>=0&&rect.y>=0);assert(rect.x+rect.width<=1206);assert(rect.y+rect.height<=2622);}
const candidate=await runner.package(request.batch_id,'candidate'),authoring=await runner.package(request.batch_id,'authoring');
const candidateZip=await JSZip.loadAsync(await candidate.blob.arrayBuffer()),authoringZip=await JSZip.loadAsync(await authoring.blob.arrayBuffer());
const files=Object.values(candidateZip.files).filter(f=>!f.dir);assert.equal(files.length,1);assert(files[0].name.endsWith('.png'));
const annotationFile=Object.values(authoringZip.files).find(f=>!f.dir&&f.name.startsWith('截图标注/'));
const annotation=JSON.parse(await annotationFile.async('string'));assert.equal(annotation.image.filename,files[0].name);
assert.equal(annotation.project.messages.length,project.messages.length);assert(annotation.rect_attrs.length>0);
for(const [name,blob] of [['business.zip',candidate.blob],['authoring.zip',authoring.blob]])await fs.writeFile(new URL(name,out),Buffer.from(await blob.arrayBuffer()));
execFileSync('python3',['tools/collect_workbench.py','--business-package',fileURLToPath(new URL('business.zip',out)),'--authoring-package',fileURLToPath(new URL('authoring.zip',out)),'--output',await fs.mkdtemp(fileURLToPath(new URL('recovered-',out)))]);

const changed=structuredClone(project);changed.messages[1].content='修改后的结算消息';
const revised=await editorRequest('screenshots',changed);assert.equal(revised.batch_id,request.batch_id);assert.equal(revised.documents[0].document_id,doc.document_id);
await assignRevisions(revised,saved);assert.equal(revised.documents[0].revision,2);
const dataset=await editorRequest('screenshots',{cases:[project,project]});assert.equal(dataset.documents.length,2);assert.notEqual(dataset.documents[0].document_id,dataset.documents[1].document_id);
assert.deepEqual(await editorRequest('screenshots',{project}),request);
const failing=new BatchRunner({store:new MemoryStore(),validate:validateDocument,render:d=>renderMaterial(d,{...dependencies,loadScreenshotAssets:async()=>{throw Error('图片解码失败');}})});
await failing.stage(request);assert.equal((await failing.run(request.batch_id)).failed,1);
console.log('PASS: screenshot capability/schema, project and dataset imports, input validation, clipped annotations, PNG-only business package, private annotations, real collector, stable revisions and failure isolation');

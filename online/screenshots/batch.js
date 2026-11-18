import {validate,template,render} from './engine.js';
import {BATCH_SCHEMA,digest} from '../shared/batch.js';

export function screenshotExample(id='reference') {
  if(!['reference','loan','labor','sale','group'].includes(id))throw Error('未找到微信截图场景');
  return {...template(id),reference_id:'demo-screenshot-'+id};
}

export function prepareScreenshot(doc) {
  if(!Array.isArray(doc.formats)||doc.formats.length!==1||doc.formats[0]!=='png')throw Error('微信截图统一批次仅支持PNG；标注另存制作记录');
  if(doc.appearance==='scan')throw Error('微信截图不支持扫描件外观');
  const project=validate(doc.payload?.project);
  if(!project.messages.length)throw Error('请至少添加一条聊天消息');
  return {project};
}

export async function screenshotRequest(input,{batch_id}={}) {
  const raw=Array.isArray(input)?input:Array.isArray(input?.cases)?input.cases:[input?.project||input];
  if(raw.length<1||raw.length>100)throw Error('每批微信截图需包含1至100个项目');
  const projects=raw.map(validate),identities=[];
  const documents=[];
  for(const [i,project] of projects.entries()) {
    const identity=await digest(project.reference_id||project);
    identities.push(identity);
    const document_id='chat-'+identity.slice(0,20)+(projects.length>1?'-'+(i+1):'');
    const doc={document_id,revision:1,title:(project.title.trim()||'微信聊天')+'_聊天截图'+(projects.length>1?'_'+(i+1):''),engine:'screenshots',formats:['png'],payload:{project}};
    prepareScreenshot(doc);documents.push(doc);
  }
  return {schema_version:BATCH_SCHEMA,batch_id:batch_id||'screenshots-'+(await digest(identities)).slice(0,20),name:projects.length===1?documents[0].title:'微信截图批次',documents};
}

async function loadAssets(project) {
  const entries=await Promise.all(Object.entries(project.assets).map(async([key,url])=>{
    const image=new Image();
    await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('聊天图片无法解码，请重新上传素材'));image.src=url;});
    return [key,image];
  }));
  return Object.fromEntries(entries);
}

export async function renderScreenshot(doc,dependencies={}) {
  const {project}=prepareScreenshot(doc);
  if(!dependencies.createCanvas)await document.fonts.ready;
  const images=await (dependencies.loadScreenshotAssets||loadAssets)(project);
  const canvas=dependencies.createCanvas?dependencies.createCanvas():document.createElement('canvas');
  // An independent canvas keeps selection and annotation overlays out of the PNG.
  const annotation=render(canvas,project,images,false);
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(Error('截图PNG导出失败')),'image/png'));
  const stem=doc.title.replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_').slice(0,85)||'微信聊天截图';
  const path=`Reference/${doc.document_id}/r${doc.revision}/${stem}.png`;
  annotation.image.filename=path;
  for(const rect of annotation.rect_attrs)rect.image_tail=path.split('/').at(-1);
  return [{format:'png',path,blob,page_count:1,text_layer:'none',template_id:'wechat-screenshot-v2',template_version:'2.0.0',screenshot_annotation:annotation}];
}

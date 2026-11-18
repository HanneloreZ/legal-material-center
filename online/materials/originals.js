import {digest} from '../shared/batch.js';
import {text} from './documents.js';
export const ORIGINAL_SCHEMA='original-document/1';
export const ORIGINAL_FORMATS=['pdf','docx','png','jpg','jpeg','txt','md'];
export const ORIGINAL_LIMIT=12*1024*1024;
export const originalMimes={pdf:'application/pdf',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',txt:'text/plain;charset=utf-8',md:'text/markdown;charset=utf-8'};
const keys=(o,allowed)=>{if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).some(k=>!allowed.includes(k)))throw Error('原件输入含不支持字段');};
function toBase64(bytes){let s='';for(let i=0;i<bytes.length;i+=32768)s+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(s);}
export async function originalFromFile(file,source={kind:'unknown',label:'',redaction:'not_checked',notes:''}){
  const format=file.name.split('.').at(-1).toLowerCase();
  if(!ORIGINAL_FORMATS.includes(format))throw Error('原件支持PDF、DOCX、PNG、JPEG、TXT和MD');
  if(!file.size||file.size>ORIGINAL_LIMIT)throw Error('原件需为非空文件，每份最多12MB；整批JSON最多20MB');
  const bytes=new Uint8Array(await file.arrayBuffer()),blob=new Blob([bytes],{type:originalMimes[format]});
  const input={schema_version:ORIGINAL_SCHEMA,id:crypto.randomUUID(),title:file.name.replace(/\.[^.]+$/,'').slice(0,150),file:{name:file.name,format,bytes:bytes.length,sha256:await digest(blob),data_base64:toBase64(bytes)},source};
  await prepareOriginal(input);return input;
}
export async function prepareOriginal(input){
  keys(input,['schema_version','id','title','file','source']);
  if(input.schema_version!==ORIGINAL_SCHEMA)throw Error('原件版本无效');
  if(!text(input.id,'文档编号',100)||!text(input.title,'原件标题',150).trim())throw Error('请填写原件编号和标题');
  const f=input.file,s=input.source;keys(f,['name','format','bytes','sha256','data_base64']);keys(s,['kind','label','redaction','notes']);
  if(!ORIGINAL_FORMATS.includes(f.format)||!text(f.name,'原始文件名',240)||f.name.split('.').at(-1).toLowerCase()!==f.format)throw Error('原件文件名与格式不一致');
  if(!['unknown','expert','public','client'].includes(s.kind)||!['not_checked','user_declared','reviewed'].includes(s.redaction))throw Error('请选择来源类型与脱敏核对状态');
  text(s.label,'来源记载',2000);text(s.notes,'原件备注',3000);
  if(!Number.isSafeInteger(f.bytes)||f.bytes<1||f.bytes>ORIGINAL_LIMIT||typeof f.data_base64!=='string'||f.data_base64.length>Math.ceil(ORIGINAL_LIMIT/3)*4||(f.data_base64.length%4!==0||/[^A-Za-z0-9+/=]/.test(f.data_base64)||/=[^=]/.test(f.data_base64)||f.data_base64.endsWith('===')))throw Error('原件数据无效或超过12MB');
  const bytes=Uint8Array.from(atob(f.data_base64),c=>c.charCodeAt(0)),blob=new Blob([bytes],{type:originalMimes[f.format]});
  if(bytes.length!==f.bytes||! /^[a-f0-9]{64}$/.test(f.sha256)||await digest(blob)!==f.sha256)throw Error('原件大小或SHA256不一致，请重新导入');
  const prefix=new TextDecoder().decode(bytes.subarray(0,10));
  if(f.format==='pdf'&&(!prefix.startsWith('%PDF-')||!(await blob.slice(-2048).text()).includes('%%EOF')))throw Error('原件PDF缺少有效文件头或结束标记');
  if(f.format==='png'&&![137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n))throw Error('原件PNG文件头不正确');
  if(['jpg','jpeg'].includes(f.format)&&!(bytes[0]===255&&bytes[1]===216&&bytes[2]===255))throw Error('原件JPEG文件头不正确');
  const inspection={page_count:null,text:'',tracked_insertions:0,tracked_deletions:0,has_comments:false,images:0,external_hyperlinks:0};
  if(f.format==='docx'){
    const {default:JSZip}=await import('jszip'),z=await JSZip.loadAsync(bytes),entries=Object.values(z.files);
    if(entries.length>10000||entries.reduce((sum,e)=>sum+(e._data?.uncompressedSize||0),0)>100*1024*1024)throw Error('原件DOCX解压体积超过100MB');
    for(const e of entries){
      if(/(^|\/)\.\.(\/|$)|\\|^\//.test(e.name)||/vbaProject|\.bin$/i.test(e.name))throw Error('原件DOCX含不支持的嵌入对象或路径');
      if(e.name.startsWith('word/media/')&&!e.dir)inspection.images++;
    }
    const entry=z.file('word/document.xml');if(!entry||!z.file('[Content_Types].xml'))throw Error('原件不是有效DOCX');
    const xml=await entry.async('string'),Parser=globalThis.DOMParser||(await import('@xmldom/xmldom')).DOMParser,W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
    if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw Error('原件DOCX含不支持的XML实体声明');
    const document=new Parser().parseFromString(xml,'application/xml');if(document.getElementsByTagName('parsererror').length||document.documentElement.localName!=='document'||document.documentElement.namespaceURI!==W)throw Error('原件DOCX正文XML无效');
    inspection.tracked_insertions=document.getElementsByTagNameNS(W,'ins').length;inspection.tracked_deletions=document.getElementsByTagNameNS(W,'del').length;inspection.has_comments=!!z.file('word/comments.xml');
    // This is a non-authoritative text preview, never a replacement of the uploaded bytes.
    inspection.text=Array.from(document.getElementsByTagNameNS(W,'p')).map(p=>p.textContent).join('\n').slice(0,25000);
    for(const entry of entries.filter(e=>e.name.endsWith('.rels'))){
      const rels=await entry.async('string');if(/<!DOCTYPE|<!ENTITY/i.test(rels))throw Error('原件DOCX关系XML含实体声明');
      const relationships=new Parser().parseFromString(rels,'application/xml');if(relationships.getElementsByTagName('parsererror').length)throw Error('原件DOCX关系XML无效');
      for(const rel of Array.from(relationships.getElementsByTagName('Relationship'))){
        if(rel.getAttribute('TargetMode')!=='External')continue;
        if(!rel.getAttribute('Type').endsWith('/hyperlink')||! /^(https?:|mailto:)/.test(rel.getAttribute('Target')))throw Error('原件DOCX含外部模板或非网页外部链接，当前不支持接收');
        inspection.external_hyperlinks++;
      }
    }
  }
  if(['txt','md'].includes(f.format)){
    // Preserve legacy text encodings as bytes; no transcoding during delivery.
    inspection.text=new TextDecoder('utf-8').decode(bytes).slice(0,25000);
  }
  return {input:structuredClone(input),blob,inspection,source:{...s,filename:f.name,sha256:f.sha256,bytes:f.bytes,redaction_verified_by_workbench:false}};
}

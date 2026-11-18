import assert from 'node:assert/strict';
import fs from 'node:fs';
import {template,validate,variants,render,zip} from '../../online/screenshots/engine.js';
const ctx=new Proxy({measureText:t=>({width:Array.from(t).reduce((a,c)=>a+(c.charCodeAt(0)>255?17:9),0)}),font:''},{get(o,k){return o[k]??(()=>{});},set(o,k,v){o[k]=v;return true;}});
for(const k of ['loan','labor','sale','group']){const p=validate({...template(k),viewportHeight:'auto'});for(const scale of [1,2,3]){p.scale=scale;const c={getContext:()=>ctx};const meta=render(c,p);assert.equal(meta.image.width,p.width*scale);assert(meta.rect_attrs.length>p.messages.length);for(const r of meta.rect_attrs){assert(r.x>=0&&r.y>=0&&r.width>0&&r.height>0);assert(r.x+r.width<=meta.image.width,JSON.stringify(r));assert(r.y+r.height<=meta.image.height);}assert.equal(meta.structured_info.messages.length,p.messages.length);}}
const g=validate({...template('group'),viewportHeight:'auto'});const gm=render({getContext:()=>ctx},g);assert.equal(gm.structured_info.participants.length,4);assert(gm.structured_info.messages.some(x=>x.quote?.message_id===g.messages[2].id));assert(gm.rect_attrs.some(x=>x.label==='file_status'&&x.answer==='已下载'));assert(gm.rect_attrs.some(x=>x.label==='quoted_message'));assert.equal(gm.structured_info.messages[2].sender_id,'finance');
const p=template();assert.deepEqual(variants(p,3,42).map(x=>x.generation),variants(p,3,42).map(x=>x.generation));const vs=variants(p,10,42);for(const v of vs){assert.equal(v.messages.find(x=>x.type==='transfer').amount,v.messages.find(x=>x.type==='receipt').amount);}
assert.throws(()=>validate({messages:[{type:'unknown'}]}));assert.throws(()=>validate({...p,width:900}));assert.throws(()=>validate({...p,messages:[{type:'transfer',amount:-5}]}));
fs.writeFileSync('/tmp/screenshot-studio-test.zip',Buffer.from(await zip([{name:'sample.txt',data:new TextEncoder().encode('合成测试')}]).arrayBuffer()));
console.log('PASS: template validation, all export scales, bounding boxes, deterministic batch, paired transfer amounts, malformed input rejection, ZIP generation');
const ref=validate({...template('group'),width:402,scale:3,viewportHeight:'874',fontSize:16,lineHeight:22,avatarSize:40});
ref.messages=[...ref.messages,...ref.messages.map((m,i)=>({...m,id:'extra-'+i}))];
const cropped=render({getContext:()=>ctx},ref);assert.equal(cropped.image.width,1206);assert.equal(cropped.image.height,2622);for(const r of cropped.rect_attrs){assert(r.y>=98*3);assert(r.y+r.height<=(874-90)*3);}
const {commonsItems}=await import('../../online/screenshots/avatar-library.js');
const parsed=commonsItems({query:{pages:{1:{pageid:1,title:'File:CC0.jpg',imageinfo:[{thumburl:'https://upload.wikimedia.org/cc0.jpg',descriptionurl:'https://commons.wikimedia.org/wiki/File:CC0.jpg',extmetadata:{LicenseShortName:{value:'CC0'},Artist:{value:'<b>Artist</b>'}}}]},2:{pageid:2,title:'File:BY.jpg',imageinfo:[{thumburl:'https://example.com/by.jpg',extmetadata:{LicenseShortName:{value:'CC BY-SA 4.0'}}}]}}}});
assert.equal(parsed.length,1);assert.equal(parsed[0].creator,'Artist');
const catalog=JSON.parse(fs.readFileSync(new URL('../../online/public/screenshots-assets/avatar-catalog.json',import.meta.url)));assert.equal(catalog.items.length,30);for(const a of catalog.items){assert.equal(a.license,'CC0 1.0');assert(fs.existsSync(new URL('../../online/public/screenshots-assets/'+a.url,import.meta.url)));}
console.log('PASS: reference dimensions, viewport clipping, CC0-only metadata filter, 30 cached avatar assets');

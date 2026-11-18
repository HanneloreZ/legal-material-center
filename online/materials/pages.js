import {documentBlocks,cleanDocument} from './documents.js';
export const escapeXML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const weight=c=>/[\u0000-\u00ff]/.test(c)?0.61:1.05;
export function wrapText(value,width,size){
  const lines=[];
  for(const paragraph of String(value).split('\n')){
    let line='',used=0;
    for(const c of paragraph){const w=weight(c)*size;if(line&&used+w>width){if(/[，。；：！？、）】》”’.,;:!?)]/.test(c)){lines.push(line+c);line='';used=0;continue;}lines.push(line);line='';used=0;}line+=c;used+=w;}
    lines.push(line);
  }
  return lines;
}
export const svgText=(value,x,y,size=16,extra='')=>`<text x="${x}" y="${y}" font-size="${size}" ${extra}>${escapeXML(value)}</text>`;
export function svgPage(width,height,body,label,page,total){return {width,height,svg:`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#fff"/><g font-family="sans-serif" fill="#25312b">${body}${svgText('合成案例材料 · '+label,28,height-27,12,'fill="#68756d"')}${svgText(`${page} / ${total}`,width-28,height-27,12,'text-anchor="end" fill="#68756d"')}</g></svg>`};}
export function documentPages(input){
  const d=cleanDocument(input),width=794,height=1123,parts=[];let body='',y=75;
  function next(){if(parts.length>=200)throw Error('文书超过200页，请拆分');parts.push(body);body='';y=75;}
  function lines(text,size,lineHeight,extra='',gap=10){
    for(const line of wrapText(text,width-120,size)){
      if(y+lineHeight>height-80)next();
      body+=svgText(line,60,y,size,extra);y+=lineHeight;
    }
    y+=gap;
  }
  lines(d.title,25,35,'font-weight="bold"',22);
  for(const b of documentBlocks(d)){
    if(b.type==='heading'&&y+75>height-80)next();
    lines(b.text,b.type==='heading'?18:16,b.type==='heading'?29:26,b.type==='heading'?'font-weight="bold"':'',b.type==='heading'?5:12);
  }
  if(body)next();
  return parts.map((part,i)=>svgPage(width,height,part,'文书示例',i+1,parts.length));
}

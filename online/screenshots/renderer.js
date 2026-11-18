import {people,sender,displayName,quoteOf,callText,recallText,FILE_STATES,TYPES,clone,wechatEmoji} from './engine.js';

// Shared layout drives both the preview and every exported PNG/annotation.
// Measurements were compared with the supplied 402 × 874 iOS reference.
const textOf=s=>String(s??'').replace(/\[[^\]]+\]/g,t=>wechatEmoji[t]||t);
const round=(c,x,y,w,h,r,fill)=>{c.beginPath();c.roundRect(x,y,w,h,r);c.fillStyle=fill;c.fill();};
const setFont=(c,size=16,weight)=>{c.font=`${weight??c.chatWeight??400} ${size}px ${c.chatFamily}`;};
const segmenter=typeof Intl.Segmenter==='function'?new Intl.Segmenter('zh',{granularity:'grapheme'}):null;
const characters=s=>segmenter?Array.from(segmenter.segment(String(s)),x=>x.segment):Array.from(String(s));
function wrap(c,text,max){
 const lines=[];
 for(const paragraph of String(text).split('\n')){
  let line='';
  for(const ch of characters(paragraph)){
   if(line&&c.measureText(line+ch).width>max){lines.push(line);line=ch;}else line+=ch;
  }
  lines.push(line);
 }
 return lines;
}
function ellipsis(c,text,max){let s=String(text);if(c.measureText(s).width<=max)return s;while(s&&c.measureText(s+'…').width>max)s=characters(s).slice(0,-1).join('');return s+'…';}
function drawLines(c,lines,x,y,lineHeight,size){
 // Center the actual CJK glyph, keeping Latin and emoji on the same baseline.
 const metric=c.measureText('国'),a=metric.actualBoundingBoxAscent||size*.86,d=metric.actualBoundingBoxDescent||size*.12;
 const baseline=(lineHeight-a-d)/2+a;
 lines.forEach((line,i)=>c.fillText(line,x,y+baseline+i*lineHeight));
}
function stroke(c,points,color='#191919',width=1.6){c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();}
function voiceGlyph(c,x,y,mirror=false){
 c.save();c.translate(x,y);if(mirror)c.scale(-1,1);c.strokeStyle='#252525';c.lineWidth=1.6;c.lineCap='round';
 for(const r of [4,8,12]){c.beginPath();c.arc(-6,0,r,-.68,.68);c.stroke();}c.restore();
}
function phoneGlyph(c,x,y){
 c.save();c.translate(x,y);c.rotate(-.55);c.strokeStyle='#252525';c.lineWidth=1.6;c.lineJoin='round';c.beginPath();
 c.moveTo(-8,-10);c.lineTo(-3,-10);c.lineTo(-2,-4);c.lineTo(-5,-2);c.quadraticCurveTo(-4,4,2,6);c.lineTo(4,3);c.lineTo(10,5);c.lineTo(10,10);c.quadraticCurveTo(-9,13,-8,-10);c.stroke();c.restore();
}
function transferGlyph(c,x,y,state){
 c.strokeStyle='#fff';c.lineWidth=1.5;c.beginPath();c.arc(x,y,15,0,Math.PI*2);c.stroke();
 if(state==='received')stroke(c,[[x-7,y],[x-2,y+5],[x+8,y-6]],'#fff',1.8);
 else if(state==='refunded')stroke(c,[[x+6,y+6],[x+6,y-3],[x-6,y-3],[x-2,y-7],[x-6,y-3],[x-2,y+1]],'#fff',1.5);
 else{stroke(c,[[x-8,y-4],[x+7,y-4],[x+3,y-8]],'#fff',1.5);stroke(c,[[x+8,y+4],[x-7,y+4],[x-3,y+8]],'#fff',1.5);}
}
function header(c,p,W,H){
 c.fillStyle='#ededed';c.fillRect(0,0,W,H);c.fillStyle='#080808';
 setFont(c,p.device==='ios'?17:14,600);c.fillText(p.clock,p.device==='ios'?50:24,38.5);
 for(let k=0;k<4;k++){if(p.device==='ios'){round(c,W-114+k*5.3,34-(4+k*2.5),3.2,4+k*2.5,1.1,k<2?'#080808':'#bcbcbc');round(c,W-114+k*5.3,36,3.2,3,1,k<3?'#080808':'#bcbcbc');}else round(c,W-114+k*5,39-(7+k*2.4),3.2,7+k*2.4,1.1,k<3?'#080808':'#bcbcbc');}
 c.strokeStyle='#080808';c.lineWidth=2;c.lineCap='round';
 for(const r of [10,6.5]){c.beginPath();c.arc(W-78,39,r,Math.PI*1.23,Math.PI*1.77);c.stroke();}
 c.fillStyle='#080808';c.beginPath();c.moveTo(W-80,35);c.lineTo(W-76,35);c.lineTo(W-78,38);c.fill();
 round(c,W-61,26,26,14,4.5,'#bcbcbc');c.save();c.beginPath();c.roundRect(W-61,26,26,14,4.5);c.clip();c.fillStyle='#080808';c.fillRect(W-61,26,26*Number(p.battery??49)/100,14);c.restore();
 round(c,W-34,30,1.4,5,1,'#bcbcbc');setFont(c,11,600);c.fillStyle='#fff';const battery=String(p.battery??49);c.fillText(battery,W-48-c.measureText(battery).width/2,37.1);
 stroke(c,[[25,68.5],[17.5,76],[25,83.5]],'#151515',1.65);setFont(c,17,500);const title=ellipsis(c,p.title,W-112);c.fillStyle='#111';c.fillText(title,(W-c.measureText(title).width)/2,81.5);
 for(let i=0;i<3;i++){c.beginPath();c.arc(W-35+i*7,76,1.8,0,Math.PI*2);c.fill();}
 c.fillStyle='#d5d5d5';c.fillRect(0,H-1/3,W,1/3);
}
function footer(c,p,W,H,fy){
 c.fillStyle='#f7f7f7';c.fillRect(0,fy,W,H-fy);c.fillStyle='#dcdcdc';c.fillRect(0,fy,W,1/3);
 c.strokeStyle='#171717';c.lineWidth=1.6;c.beginPath();c.arc(24,fy+28,12.5,0,Math.PI*2);c.stroke();voiceGlyph(c,24,fy+28);
 round(c,48,fy+8,W-136,40,8,'#fff');c.strokeStyle='#e9e9e9';c.lineWidth=.4;c.stroke();
 if(p.inputMode!=='text'){setFont(c,13,300);c.fillStyle='#c4c4c4';const t='可按住 转文字';c.fillText(t,48+(W-136-c.measureText(t).width)/2,fy+33.5);}
 const sx=W-63;c.strokeStyle='#111';c.lineWidth=1.6;c.beginPath();c.arc(sx,fy+28,12.5,0,Math.PI*2);c.stroke();c.fillStyle='#111';
 for(const dx of [-5,5]){c.beginPath();c.arc(sx+dx,fy+24,1.8,0,Math.PI*2);c.fill();}
 stroke(c,[[sx-8,fy+29],[sx+8,fy+29]],'#111',1.5);c.beginPath();c.arc(sx,fy+28,8,.12,Math.PI-.12);c.stroke();
 c.beginPath();c.arc(W-24,fy+28,12.5,0,Math.PI*2);c.stroke();stroke(c,[[W-31,fy+28],[W-17,fy+28]],'#111',1.5);stroke(c,[[W-24,fy+21],[W-24,fy+35]],'#111',1.5);
 if(p.watermark){setFont(c,9);c.fillStyle='#aaa';const t='合成样本 · Screenshot Legal Studio';c.fillText(t,(W-c.measureText(t).width)/2,H-9);}
}
export function render(canvas,p,images={},overlay=false){
 const c=canvas.getContext('2d'),W=Number(p.width),S=Number(p.scale),F=Number(p.fontSize||16),LH=Math.max(Number(p.lineHeight||22),F+3),G=Number(p.messageGap||17),A=Number(p.avatarSize||41),B=12+A+12,HEADER=98,FOOTER=90,max=W-2*B,rows=[],rects=[];
 const family=p.fontFamily==='system'?'-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif':'"PingFang SC", -apple-system, "Helvetica Neue", Arial, sans-serif';c.chatFamily=family;c.chatWeight=Number(p.fontWeight||300);
 let y=HEADER+13;
 for(let i=0;i<p.messages.length;i++){
  const author=sender(p,p.messages[i]),m={...p.messages[i],side:author.self?'right':'left',senderId:author.id};
  if(m.type==='recall')m.content=recallText(p,m);if(m.type==='call')m.content=callText(m);
  const neutral=['timestamp','recall'].includes(m.type),nick=p.group&&!neutral&&!author.self?18:0,quote=m.type==='text'?quoteOf(p,m):null;
  let h=41,w=41,lines=[],qw=0,qh=0,quoteLines=[];setFont(c,F);
  if(neutral){setFont(c,13);lines=wrap(c,m.content,W-64);w=W-64;h=lines.length*18+12;}
  else if(m.type==='text'){lines=wrap(c,textOf(m.content),max-24);w=Math.min(max,Math.max(16,...lines.map(l=>c.measureText(l).width))+24);h=Math.max(41,lines.length*LH+19);}
  else if(['transfer','receipt'].includes(m.type)){w=Math.min(240,max);h=88;}
  else if(m.type==='file'){w=Math.min(240,max);setFont(c,15);lines=wrap(c,m.content,w-84);if(lines.length>2){lines=lines.slice(0,2);lines[1]=ellipsis(c,lines[1]+'…',w-84);}h=94;}
  else if(m.type==='call'){setFont(c,15);w=Math.min(max,Math.max(170,c.measureText(m.content).width+50));h=43;}
  else if(m.type==='voice'){w=Math.min(max,74+Number(m.duration||8)*2);h=41;}
  else{const img=images[m.asset];w=m.type==='image'?Math.min(200,max):Math.min(134,max);h=img?Math.max(1,w*img.height/img.width):134;if(img&&h>(m.type==='image'?250:180)){h=m.type==='image'?250:180;w=Math.max(1,h*img.width/img.height);}}
  if(quote){setFont(c,12);quoteLines=wrap(c,`${quote.author}：${quote.type==='file'?'[文件] ':quote.type==='image'?'[图片] ':''}${textOf(quote.content||TYPES[quote.type]||'')}`,max-18);if(quoteLines.length>3){quoteLines=quoteLines.slice(0,3);quoteLines[2]=ellipsis(c,quoteLines[2]+'…',max-18);}qw=Math.min(max,Math.max(30,...quoteLines.map(l=>c.measureText(l).width))+18);qh=quoteLines.length*17+12;}
  const totalW=Math.max(w,qw),totalH=h+(qh?6+qh:0),x=neutral?32:m.side==='right'?W-B-totalW:B;
  const bx=m.side==='right'?x+totalW-w:x,qx=m.side==='right'?x+totalW-qw:x;
  rows.push({m,i,author,neutral,nick,x,y:y+nick,w:totalW,h:totalH,bx,bw:w,bh:h,lines,quote,quoteLines,qw,qh,qx});
  y+=Math.max(totalH+nick,neutral?totalH:A)+(neutral?14:G);
 }
 if(rows.length)y-=rows.at(-1).neutral?14:G;
 const fixed=p.viewportHeight&&p.viewportHeight!=='auto',H=fixed?Number(p.viewportHeight):Math.max(650,y+FOOTER+12),fy=H-FOOTER,maxScroll=Math.max(0,y-(fy-12)),distance=fixed?Math.min(maxScroll,Math.max(0,Number(p.captureOffset)||0)):0,shift=fixed?maxScroll-distance:0;
 for(const r of rows)r.y-=shift;
 if(H*S>32000||W*H*S*S>80000000)throw Error('截图过长，请拆分对话或降低导出倍率');
 canvas.width=W*S;canvas.height=H*S;c.chatFamily=family;c.chatWeight=Number(p.fontWeight||300);c.scale(S,S);c.textBaseline='alphabetic';c.fillStyle='#ededed';c.fillRect(0,0,W,H);
 const box=(x,yy,w,h)=>{const top=Math.max(HEADER,yy),bottom=Math.min(fy,yy+h);return{x:Math.round(x*S),y:Math.round(top*S),width:Math.round(w*S),height:Math.max(0,Math.round((bottom-top)*S))};};
 const add=(row,label,answer,x,yy,w,h)=>{const b=box(x,yy,w,h);if(b.height>0)rects.push({image_number:1,image_tail:'sample_001.png',tool:'rectTool',label,answer,...b,order:row.i+1,message_id:row.m.id});};
 header(c,p,W,HEADER);c.save();c.beginPath();c.rect(0,HEADER,W,fy-HEADER);c.clip();
 for(const r of rows){
  const {m,author,x,y,w,h,bx,bw,bh,lines,neutral}=r;if(y+h<HEADER||y-r.nick>fy)continue;
  if(neutral){setFont(c,13);c.fillStyle='#aaa';lines.forEach((t,j)=>c.fillText(t,(W-c.measureText(t).width)/2,y+22+j*18));add(r,m.type,m.content,32,y,W-64,h);continue;}
  const name=author.remark||author.name,ax=m.side==='left'?12:W-12-A,ay=y-r.nick,img=images[author.avatar];
  round(c,ax,ay,A,A,4,author.self?'#d9e6d2':'#dce3e8');
  if(img){c.save();c.beginPath();c.roundRect(ax,ay,A,A,4);c.clip();const z=Math.min(img.width,img.height);c.drawImage(img,(img.width-z)/2,(img.height-z)/2,z,z,ax,ay,A,A);c.restore();}
  else{setFont(c,17,500);c.fillStyle=author.self?'#6b8760':'#73869a';const initial=Array.from(name)[0]||'人';c.fillText(initial,ax+(A-c.measureText(initial).width)/2,ay+A/2+6);}
  add(r,'nickname',name,ax,ay,A,A);
  if(r.nick){setFont(c,11);c.fillStyle='#929292';c.fillText(ellipsis(c,name,max),x,y-5);}
  const isTransfer=['transfer','receipt'].includes(m.type),state=m.type==='receipt'?'received':m.status||'pending',fill=isTransfer?(state==='pending'?'#f79c46':'#facd9a'):m.type==='file'?'#fff':author.self?'#95ec69':'#fff';
  if(!['sticker','image'].includes(m.type)){
   round(c,bx,y,bw,bh,5,fill);c.fillStyle=fill;c.beginPath();
   if(author.self){c.moveTo(bx+bw,y+13);c.lineTo(bx+bw+5.5,y+18.5);c.lineTo(bx+bw,y+24);}else{c.moveTo(bx,y+13);c.lineTo(bx-5.5,y+18.5);c.lineTo(bx,y+24);}c.fill();
  }
  if(m.type==='text'){
   setFont(c,F);c.fillStyle='#111';drawLines(c,lines,bx+12,y+(bh-lines.length*LH)/2,LH,F);add(r,'text',m.content,bx,y,bw,bh);
   if(r.quote){const qy=y+bh+6;round(c,r.qx,qy,r.qw,r.qh,4,'#e1e1e1');setFont(c,12);c.fillStyle='#777';drawLines(c,r.quoteLines,r.qx+9,qy+6,17,12);add(r,'quoted_message',JSON.stringify(r.quote),r.qx,qy,r.qw,r.qh);}
  }
  if(isTransfer){
   transferGlyph(c,bx+29,y+31,state);setFont(c,19);c.fillStyle='#fff';c.fillText(`¥${Number(m.amount||0).toFixed(2)}`,bx+53,y+28);
   const status={pending:'待收款',received:'已收款',refunded:'已退还'}[state];setFont(c,12);c.fillText(ellipsis(c,state==='pending'?(m.content||'转账给你'):status,bw-66),bx+53,y+47);
   c.fillStyle='#ffffff32';c.fillRect(bx,y+64,bw,1/3);setFont(c,11);c.fillStyle='#fff8ee';c.fillText('微信转账',bx+12,y+80);
   add(r,'amount',Number(m.amount||0).toFixed(2),bx+50,y+8,bw-55,25);add(r,'action_analysis',`${m.type==='receipt'?'收款确认':'转账'}；${status}；${m.content}`,bx,y,bw,bh);
   if(m.type==='receipt'){add(r,'recipt_amount',Number(m.amount||0).toFixed(2),bx+50,y+8,bw-55,25);add(r,'receipt_transfer_action_analysis',status,bx,y,bw,bh);}
  }
  if(m.type==='file'){
   const ext=(m.content.match(/\.([a-z0-9]{1,8})$/i)?.[1]||'FILE').toUpperCase(),color=/DOC/.test(ext)?'#4285d6':/XLS|CSV/.test(ext)?'#35a36e':ext==='PDF'?'#e66b5f':'#e9a03e';
   const ix=bx+bw-55,iy=y+14;round(c,ix,iy,42,48,3,color);c.fillStyle='#ffffff55';c.beginPath();c.moveTo(ix+30,iy);c.lineTo(ix+42,iy+12);c.lineTo(ix+30,iy+12);c.fill();setFont(c,10,600);c.fillStyle='#fff';const label=ext.slice(0,5);c.fillText(label,ix+(42-c.measureText(label).width)/2,iy+34);
   setFont(c,15);c.fillStyle='#191919';drawLines(c,lines,bx+12,y+12,21,15);setFont(c,11);c.fillStyle='#999';c.fillText(m.size||'238 KB',bx+12,y+61);
   c.fillStyle='#eee';c.fillRect(bx,y+72,bw,1/3);const state=m.fileStatus||'sent';setFont(c,10);c.fillStyle=state==='failed'?'#e05b51':'#999';c.fillText((FILE_STATES[state]||'已发送')+(['sending','downloading'].includes(state)?` ${m.progress??50}%`:''),bx+12,y+86);
   if(['sending','downloading'].includes(state)){c.fillStyle='#e8e8e8';c.fillRect(bx+90,y+82,bw-104,2);c.fillStyle='#07c160';c.fillRect(bx+90,y+82,(bw-104)*(Number(m.progress??50)/100),2);}
   add(r,'file_name',m.content,bx,y,bw,bh);add(r,'file_status',FILE_STATES[state]||'已发送',bx+10,y+74,bw-20,18);
  }
  if(m.type==='voice'){voiceGlyph(c,author.self?bx+bw-19:bx+22,y+bh/2,author.self);setFont(c,13);c.fillStyle='#777';c.fillText(`${m.duration||8}″`,author.self?bx-27:bx+bw+8,y+27);add(r,'voice',m.content||`语音 ${m.duration||8} 秒`,bx,y,bw,bh);}
  if(m.type==='call'){phoneGlyph(c,author.self?bx+bw-24:bx+23,y+22);setFont(c,15);c.fillStyle='#252525';c.fillText(m.content,author.self?bx+12:bx+44,y+27);add(r,'voice_call',m.content,bx,y,bw,bh);}
  if(['sticker','image'].includes(m.type)){
   const image=images[m.asset];if(image){c.save();c.beginPath();c.roundRect(bx,y,bw,bh,m.type==='image'?5:0);c.clip();c.drawImage(image,bx,y,bw,bh);c.restore();}
   else if(m.type==='image'){round(c,bx,y,bw,bh,5,'#dfe4df');setFont(c,13);c.fillStyle='#8c998c';c.fillText('点击编辑并上传图片',bx+20,y+bh/2+5);}
   else{setFont(c,68);c.fillStyle='#333';c.fillText(m.emoji||'😊',bx+23,y+76);setFont(c,16,500);c.fillText(ellipsis(c,m.content||'好',bw-16),bx+8,y+113);}
   add(r,m.type,m.content,bx,y,bw,bh);if(m.attitude)add(r,'attitude',m.attitude,bx,y,bw,bh);
  }
  for(const label of ['legal_intent','legal_relationship','legal_analysis'])if(m[label])add(r,label,m[label],x,y,w,h);
  add(r,'speaker',name,x,y,w,h);
 }
 c.restore();footer(c,p,W,H,fy);
 if(overlay){c.lineWidth=.65;for(const b of rects.filter(b=>!['speaker','legal_analysis','legal_intent','legal_relationship'].includes(b.label))){c.strokeStyle=b.label==='nickname'?'#a58be1':'#4b85d9';c.strokeRect(b.x/S,b.y/S,b.width/S,b.height/S);}}
 const messages=rows.filter(r=>r.y+r.h>HEADER&&r.y<fy).map(r=>({id:r.m.id,type:r.m.type,speaker:r.neutral?null:displayName(p,r.m),sender_id:r.neutral?null:r.author.id,content:r.m.content,bbox:box(r.x,r.y,r.w,r.h),...(r.m.amount?{amount:r.m.amount,status:r.m.status}:{}),...(r.m.asset?{asset:r.m.asset}:{}),...(r.m.attitude?{attitude:r.m.attitude}:{}),...(r.m.type==='file'?{file_status:r.m.fileStatus||'sent',file_size:r.m.size||'238 KB',progress:r.m.progress??null}:{}),...(r.quote?{quote:r.quote}:{}),...(r.m.type==='call'?{call_status:r.m.callStatus||'completed',call_duration:r.m.callDuration||null}:{}),...(r.m.type==='recall'?{recall_mode:r.m.recallMode||'custom'}:{})}));
 return{schema_version:'1.0',synthetic:true,source:'Screenshot Legal Studio v2',image:{filename:'sample_001.png',width:W*S,height:H*S,coordinate_unit:'pixel'},view:{header_height:HEADER,footer_height:FOOTER,max_scroll:maxScroll,capture_offset:distance,visible_messages:messages.length,total_messages:p.messages.length},structured_info:{dialog_name:p.title,group_chat:p.group,participants:people(p).map(a=>({id:a.id,name:a.name,remark:a.remark,display_name:a.remark||a.name,self:a.self,avatar:a.avatar||null})),messages},rect_attrs:rects,asset_credits:clone(p.assetCredits||{}),project:clone(p)};
}

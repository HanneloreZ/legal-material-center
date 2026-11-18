export const TYPES={text:'文字消息',image:'图片消息',timestamp:'时间分隔',transfer:'微信转账',receipt:'收款确认',sticker:'表情包',file:'文件消息',voice:'语音消息',call:'语音通话记录',recall:'撤回提示'};
export const clone=x=>JSON.parse(JSON.stringify(x));
export const wechatEmoji={'[微笑]':'🙂','[抱拳]':'🙏','[捂脸]':'🤦','[破涕为笑]':'😂','[流泪]':'😢','[呲牙]':'😁','[强]':'👍','[爱心]':'❤️','[握手]':'🤝','[害羞]':'😊'};
const base={schema_version:'1.0',fontFamily:'pingfang',fontSize:16,fontWeight:300,lineHeight:22,messageGap:17,avatarSize:41,viewportHeight:'874',captureOffset:0,inputMode:'voice',battery:49,title:'林晓',clock:'09:41',device:'ios',width:402,scale:3,group:false,watermark:true,leftName:'林晓',rightName:'陈予',assets:{},messages:[]};
export function people(p){return p.participants?.length?p.participants:[{id:'left',name:p.leftName,remark:'',avatar:'',self:false},{id:'right',name:p.rightName,remark:'',avatar:'',self:true}];}
export function sender(p,m){return people(p).find(x=>x.id===m.senderId)||people(p).find(x=>!!x.self===(m.side==='right'))||people(p)[0];}
export function quoteOf(p,m){if(!m.quoteId&&!m.quote)return null;const source=p.messages.find(x=>x.id===m.quoteId);return source?{message_id:source.id,author:displayName(p,source),type:source.type,content:source.content,...(source.amount?{amount:source.amount}:{})}:m.quote||null;}
export const CALL_STATES={completed:'已接通',cancelled:'已取消',unanswered:'对方未接听',rejected:'已拒绝',busy:'对方忙线'};
export const callText=m=>m.callStatus==='completed'||!m.callStatus?`通话时长 ${m.callDuration||'02:36'}`:(CALL_STATES[m.callStatus]||'已取消');
export function recallText(p,m){return m.recallMode==='self'?'你撤回了一条消息':m.recallMode==='sender'?`“${displayName(p,m)}”撤回了一条消息`:m.content;}
export const FILE_STATES={sending:'发送中',sent:'已发送',downloading:'下载中',downloaded:'已下载',failed:'发送失败',expired:'文件已过期'};
export function displayName(p,m){const a=sender(p,m);return a.remark||a.name;}
export function template(key='loan'){
 const p=clone(base),m=(type,side,content,extra={})=>({id:crypto.randomUUID(),type,side,content,legal_intent:'',legal_relationship:'',legal_analysis:'',...extra});
 if(key==='labor'){p.title=p.leftName='项目负责人';p.messages=[m('timestamp','left','2025年9月15日 10:30'),m('text','left','这周的安排我发你了，你看下。'),m('file','left','项目排期_示例.pdf',{size:'238 KB'}),m('text','right','看了，周五前能做完。',{legal_intent:'确认工作安排'}),m('recall','left','对方撤回了一条消息'),m('text','left','刚才时间写错了，周五交就行。'),m('sticker','right','收到',{emoji:'👌',attitude:'positive'})];}
 else if(key==='sale'){p.title=p.leftName='方小禾';p.messages=[m('timestamp','left','2025年10月20日 14:20'),m('text','right','12 件一共 600 元，对吧？',{legal_intent:'请求确认数量和总价',legal_relationship:'买卖关系'}),m('voice','left','对，600 元。',{duration:3}),m('transfer','right','样品款',{amount:'600.00',status:'received'}),m('text','left','收到了，明天给你寄。'),m('sticker','right','好',{emoji:'😊',attitude:'positive'})];}
 else p.messages=[
  m('timestamp','left','2025年9月18日 09:41'),
  m('text','right','上次借的 3,000 元，今天能还吗？',{legal_intent:'催还借款',legal_relationship:'借贷关系'}),
  m('text','left','老板，这两天家里临时有点事，手头有点紧。今天先转 1,000 元给你，剩下的能不能缓到月底？',{legal_intent:'请求延期归还余款',legal_relationship:'借贷关系'}),
  m('text','right','行，剩下 2,000 元月底给我吧。',{legal_intent:'同意余款延期至月底'}),
  m('transfer','left','先还一部分',{amount:'1000.00',status:'received'}),
  m('receipt','right','已收款',{amount:'1000.00',status:'received'}),
  m('text','right','收到了。月底记得啊。',{legal_intent:'确认收款并提醒余款期限'}),
  m('sticker','left','好',{emoji:'🙏',attitude:'positive'})
 ];
 p.participants=[{id:'left',name:p.leftName,remark:'',avatar:'',self:false},{id:'right',name:p.rightName,remark:'',avatar:'',self:true}];if(key==='group'){p.group=true;p.title='项目结算对接群（4）';p.participants[0].remark='林工-A项目';p.participants[1].remark='c.y｜月底结算';p.participants.push({id:'finance',name:'Mia',remark:'Mia_财务02',avatar:'',self:false},{id:'manager',name:'老周',remark:'周经理【周末休息】',avatar:'',self:false});p.messages=[m('timestamp','left','2025年9月18日 14:30'),m('text','left','这版清单大家再看一下。',{senderId:'left'}),m('file','left','A项目_结算清单_v3.pdf',{senderId:'finance',size:'1.8 MB',fileStatus:'downloaded'}),m('text','right','我先核下，没问题就让周总转。',{senderId:'right',quoteId:''}),m('transfer','left','项目结算款',{senderId:'manager',amount:'3000.00',status:'received'}),m('text','right','项目编号你再帮我看一眼[抱拳]',{senderId:'right'}),m('sticker','left','好',{senderId:'finance',emoji:'👌',attitude:'positive'})];p.messages[3].quoteId=p.messages[2].id;p.messages.splice(5,0,m('call','left','',{senderId:'manager',callStatus:'completed',callDuration:'02:36'}),m('recall','left','',{senderId:'finance',recallMode:'sender'}));}if(key==='reference'){p.title='阿禾 04.28.';p.clock='20:48';p.leftName='阿禾';p.participants[0].name='阿禾';p.messages=[m('text','left','我刚看完'),m('text','left','感觉放在后面会比较合适'),m('text','right','哈哈哈哈哈'),m('timestamp','left','13:42'),m('text','left','嗯嗯，我也这么想'),m('text','left','那就先这样吧'),m('text','left','你晚上有空再帮我看下'),m('text','right','行，吃完饭我看看'),m('timestamp','left','18:39'),m('text','left','文件我发你了'),m('text','left','就是刚才说的那个版本'),m('timestamp','left','18:44'),m('text','right','好嘞[微笑]')];}p.dialogue_context={reference:'熟人之间的日常对话，用于比较 iOS 截图排版。',loan:'熟人借贷：借款人请求缓还，出借人回应后同意将余款延至月底。',labor:'工作对接：项目负责人安排任务，执行人回应能否按时交付。',sale:'买卖沟通：买方询价确认后付款，卖方回应并安排寄出。',group:'结算群：林工和 Mia 发清单；陈予负责核对，周经理负责转账。'}[key]||'熟人借贷：借款人请求缓还，出借人决定是否同意。';return p;
}
export function validate(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('项目必须是 JSON 对象');
 if(!Array.isArray(raw.messages)||raw.messages.length>100)throw Error('每个项目需包含 messages 数组，最多 100 条消息');
 const p={...clone(base),...raw};p.width=Number(p.width);p.scale=Number(p.scale);
 if(![375,390,402,430].includes(p.width)||![1,2,3].includes(p.scale))throw Error('width 仅支持 375/390/402/430，scale 仅支持 1/2/3');
 for(const k of ['title','clock','leftName','rightName']){if(typeof p[k]!=='string'||p[k].length>120)throw Error(`${k} 必须是 120 字以内的文字`);}
 for(const [key,lo,hi] of [['fontSize',13,22],['lineHeight',19,32],['messageGap',8,28],['avatarSize',32,46],['battery',0,100]]){p[key]=Number(p[key]);if(!Number.isFinite(p[key])||p[key]<lo||p[key]>hi)throw Error(`${key} 超出允许范围`);}
 p.fontWeight=[300,400,500].includes(Number(p.fontWeight))?Number(p.fontWeight):400;p.lineHeight=Math.max(p.lineHeight,p.fontSize+3);p.fontFamily=p.fontFamily==='system'?'system':'pingfang';p.viewportHeight=['auto','844','874','932'].includes(String(p.viewportHeight))?String(p.viewportHeight):'auto';p.inputMode=p.inputMode==='text'?'text':'voice';p.captureOffset=Math.max(0,Math.min(100000,Number(p.captureOffset)||0));
 p.assetCredits=raw.assetCredits&&typeof raw.assetCredits==='object'&&!Array.isArray(raw.assetCredits)?clone(raw.assetCredits):{};
 p.device=p.device==='android'?'android':'ios';p.group=!!p.group;p.watermark=p.watermark!==false;
 if(!p.assets||typeof p.assets!=='object'||Array.isArray(p.assets))throw Error('assets 必须是对象');
 for(const [k,v] of Object.entries(p.assets)){if(typeof v!=='string'||!/^data:image\/(png|jpeg|webp);base64,/.test(v)||v.length>4500000)throw Error('表情包素材需为 PNG/JPG/WebP 的 data URL，最大 3 MB');}
 p.participants=people(p).map((a,i)=>({id:String(a.id||`person_${i}`),name:String(a.name||'群成员').slice(0,60),remark:String(a.remark||'').slice(0,60),avatar:String(a.avatar||''),self:!!a.self}));
 if(p.participants.length>20||p.participants.filter(a=>a.self).length!==1||new Set(p.participants.map(a=>a.id)).size!==p.participants.length)throw Error('参与人最多 20 名，且必须有一名己方成员及唯一 ID');
 if(p.participants.some(a=>a.avatar&&!p.assets[a.avatar]))throw Error('头像缺少素材');
 p.messages=p.messages.map((m,i)=>{
  if(!m||!TYPES[m.type])throw Error(`第 ${i+1} 条消息的 type 不支持`);
  if(m.senderId&&!p.participants.some(a=>a.id===m.senderId))throw Error(`第 ${i+1} 条消息的发送人不存在`);
  const out={...m,id:typeof m.id==='string'&&m.id.length<=80?m.id:crypto.randomUUID(),side:m.side==='right'?'right':'left',content:String(m.content??''),legal_intent:String(m.legal_intent??''),legal_analysis:String(m.legal_analysis??''),legal_relationship:String(m.legal_relationship??'')};
  for(const k of ['content','legal_intent','legal_analysis','legal_relationship'])if(out[k].length>1500)throw Error(`第 ${i+1} 条消息的 ${k} 过长（上限 1500 字）`);
  if(['transfer','receipt'].includes(out.type)){const num=Number(out.amount);if(!Number.isFinite(num)||num<0||num>1e9)throw Error(`第 ${i+1} 条消息金额无效`);out.amount=num.toFixed(2);out.status=['pending','received','refunded'].includes(m.status)?m.status:'pending';}
  if(out.type==='file'){out.fileStatus=FILE_STATES[m.fileStatus]?m.fileStatus:'sent';out.progress=Math.max(0,Math.min(100,Number(m.progress??50)));}
  if(out.type==='call'){out.callStatus=CALL_STATES[m.callStatus]?m.callStatus:'completed';out.callDuration=String(m.callDuration||'02:36');if(!/^\d{1,3}:[0-5]\d$/.test(out.callDuration))throw Error('通话时长格式应为 mm:ss');}
  if(out.type==='voice')out.duration=Math.max(1,Math.min(60,Math.round(Number(m.duration)||8)));
  if(out.asset&&!p.assets[out.asset])throw Error(`第 ${i+1} 条表情包缺少素材`);
  return out;
 });if(new Set(p.messages.map(m=>m.id)).size!==p.messages.length)throw Error('消息 ID 不可重复');return p;
}
export function variants(project,n,seed){
 let s=seed>>>0;const rand=()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);
 const names=['林晓','陈予','许可','方禾','周宁','沈知','叶然','苏青'];
 return Array.from({length:n},(_,i)=>{const p=clone(project);const l=names[Math.floor(rand()*names.length)],r=names[(names.indexOf(l)+1+Math.floor(rand()*7))%8];const oldL=p.leftName,oldR=p.rightName; const replace=t=>typeof t==='string'?t.split(oldL).join(l).split(oldR).join(r):t;
 p.leftName=l;p.rightName=r;p.title=replace(p.title);p.participants=people(p).map(a=>({...a,name:replace(a.name),remark:replace(a.remark)}));
 const factor=[.5,1,1.5,2][Math.floor(rand()*4)];const change=t=>{t=replace(t);if(typeof t!=='string')return t;return t.replace(/\d[\d,]*(?:\.\d+)?(?=\s*元)/g,x=>{const v=Number(x.replaceAll(',',''));return(v*factor).toLocaleString('en-US',{maximumFractionDigits:2});});};
 for(const m of p.messages){for(const k of ['content','legal_intent','legal_analysis','legal_relationship'])m[k]=change(m[k]);if(['transfer','receipt'].includes(m.type))m.amount=(Number(m.amount)*factor).toFixed(2);}
 p.sample_id=`variant_${String(i+1).padStart(3,'0')}`;p.generation={seed,index:i,name_pair:[l,r],amount_factor:factor};return p;});
}
export {render} from './renderer.js';
export function crc32(bytes){let crc=0xffffffff;for(const b of bytes){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return(crc^0xffffffff)>>>0;}
export function zip(files){const parts=[],central=[];let offset=0;const enc=new TextEncoder();const head=(size)=>{const a=new Uint8Array(size);return[a,new DataView(a.buffer)];};for(const {name,data}of files){const n=enc.encode(name),crc=crc32(data),[h,v]=head(30);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint16(12,0x21,true);v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,n.length,true);parts.push(h,n,data);const[c,d]=head(46);d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x800,true);d.setUint16(14,0x21,true);d.setUint32(16,crc,true);d.setUint32(20,data.length,true);d.setUint32(24,data.length,true);d.setUint16(28,n.length,true);d.setUint32(42,offset,true);central.push(c,n);offset+=30+n.length+data.length;}const size=central.reduce((a,b)=>a+b.length,0),[e,v]=head(22);v.setUint32(0,0x06054b50,true);v.setUint16(8,files.length,true);v.setUint16(10,files.length,true);v.setUint32(12,size,true);v.setUint32(16,offset,true);return new Blob([...parts,...central,e],{type:'application/zip'});}

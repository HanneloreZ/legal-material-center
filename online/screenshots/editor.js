import {clone,people,validate,FILE_STATES,CALL_STATES} from './engine.js';

export function createHistory(initial,limit=30){
 let entries=[JSON.stringify(initial)],index=0;
 return{
  record(value){const next=JSON.stringify(value);if(entries[index]===next)return;entries=entries.slice(0,index+1);entries.push(next);index++;while(entries.length>limit||entries.length>2&&entries.reduce((n,s)=>n+s.length,0)>24e6){entries.shift();index--; }},
  undo(){if(index>0)return JSON.parse(entries[--index]);return null;},
  redo(){if(index<entries.length-1)return JSON.parse(entries[++index]);return null;},
  get canUndo(){return index>0;},get canRedo(){return index<entries.length-1;},
  differs(value){return entries[index]!==JSON.stringify(value);}
 };
}

// One line per message; a preview is returned before the editor is changed.
export function parseScript(text,base,{replace=false}={}){
 const p=clone(base),messages=[],errors=[];p.participants=people(p);
 const id=()=>crypto.randomUUID(),blank={legal_intent:'',legal_relationship:'',legal_analysis:''};
 const resolve=(name,line)=>{
  if(['我','自己','己方'].includes(name))return p.participants.find(a=>a.self);
  const found=p.participants.filter(a=>a.name===name||a.remark===name);
  if(found.length>1){errors.push(`第 ${line} 行：昵称重复，请用唯一备注区分。`);return null;}
  if(found.length)return found[0];
  if(p.participants.length>=20){errors.push(`第 ${line} 行：参与人超过 20 名。`);return null;}
  const a={id:id(),name,remark:'',avatar:'',self:false};p.participants.push(a);return a;
 };
 for(const [i,raw]of String(text).split(/\r?\n/).entries()){
  const line=raw.trim();if(!line||line.startsWith('#'))continue;
  const time=line.match(/^(?:\[时间\s+(.+)\]|(\d{1,2}:\d{2}))$/);
  if(time){messages.push({id:id(),type:'timestamp',side:'left',content:time[1]||time[2],...blank});continue;}
  const parsed=line.match(/^([^：:]{1,60})[：:]\s*(.*)$/);
  if(!parsed){errors.push(`第 ${i+1} 行：请写成「姓名：消息」，时间单独一行。`);continue;}
  const person=resolve(parsed[1].trim(),i+1);if(!person)continue;
  const value=parsed[2],m={id:id(),type:'text',side:person.self?'right':'left',senderId:person.id,content:value,...blank};
  let match;
  if((match=value.match(/^\[(转账|收款)\s+([\d,.]+)(?:\s+(待收款|已收款|已退还))?\]\s*(.*)$/))){m.type=match[1]==='转账'?'transfer':'receipt';m.amount=match[2].replaceAll(',','');m.status=match[1]==='收款'?'received':({'已收款':'received','已退还':'refunded'}[match[3]]||'pending');m.content=match[4];}
  else if((match=value.match(/^\[语音\s*(\d{1,2})(?:秒|s)?\]\s*(.*)$/))){m.type='voice';m.duration=Number(match[1]);m.content=match[2];}
  else if((match=value.match(/^\[文件\s+([^\]]+)\]$/))){const [name,size='238 KB',status='已发送']=match[1].split('|').map(s=>s.trim());m.type='file';m.content=name;m.size=size;m.fileStatus=Object.keys(FILE_STATES).find(k=>FILE_STATES[k]===status)||'sent';}
  else if((match=value.match(/^\[通话\s+([^\]]+)\]$/))){const [state,duration]=match[1].split(/\s+/);const key=Object.keys(CALL_STATES).find(k=>CALL_STATES[k]===state);if(!key){errors.push(`第 ${i+1} 行：通话状态不支持。`);continue;}m.type='call';m.callStatus=key;m.callDuration=duration||'02:36';m.content='';}
  else if(value==='[撤回]'){m.type='recall';m.recallMode=person.self?'self':'sender';m.content='';}
  else if(/^\[(转账|收款|语音|文件|通话)/.test(value)){errors.push(`第 ${i+1} 行：消息格式有误，请参照输入框下方示例。`);continue;}
  messages.push(m);
 }
 if(errors.length)throw Error(errors.slice(0,4).join('\n'));
 if(!messages.length)throw Error('先写几条对话吧。');
 p.messages=replace?messages:[...p.messages,...messages];p.captureOffset=0;
 if(p.participants.length>2)p.group=true;
 return{project:validate(p),count:messages.length,newParticipants:p.participants.length-people(base).length};
}

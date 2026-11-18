import assert from 'node:assert/strict';
import {template,render,validate} from '../../online/screenshots/engine.js';
import {createHistory,parseScript} from '../../online/screenshots/editor.js';

const base=template('group'),original=JSON.stringify(base);
const parsed=parseScript('13:42\n我：今天先转 1000 给你。\n老板：行，月底记得啊。\n我：[转账 1000 已收款] 先还一部分\n老板：[文件 结算清单.pdf|1.8 MB|已下载]\n老板：[通话 已接通 02:36]\n我：[撤回]',base,{replace:true});
assert.equal(parsed.count,7);assert.equal(parsed.newParticipants,1);assert.equal(parsed.project.messages[1].senderId,'right');
assert.equal(parsed.project.messages[3].amount,'1000.00');assert.equal(parsed.project.messages[4].fileStatus,'downloaded');
assert.equal(parsed.project.messages[5].callStatus,'completed');assert.equal(parsed.project.messages[6].recallMode,'self');
assert.equal(JSON.stringify(base),original,'Script preview must not mutate the current draft');
assert.throws(()=>parseScript('我：[转账 不是金额]',base),/格式有误/);
assert.throws(()=>parseScript('没有冒号的内容',base),/姓名/);
assert.throws(()=>parseScript('我：[通话 接不通]',base),/状态/);
const appended=parseScript('我：补一句',base);assert.equal(appended.project.messages.length,base.messages.length+1);

const history=createHistory({text:'a'});history.record({text:'b'});history.record({text:'b'});history.record({text:'c'});
assert.deepEqual(history.undo(),{text:'b'});assert.deepEqual(history.redo(),{text:'c'});history.undo();history.record({text:'d'});assert.equal(history.canRedo,false);assert.deepEqual(history.undo(),{text:'b'});assert.deepEqual(history.undo(),{text:'a'});assert.equal(history.undo(),null);

const ctx=new Proxy({measureText:t=>({width:Array.from(t).length*16})},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
const p=validate({...template('reference'),messages:Array.from({length:35},(_,i)=>({id:String(i),type:'text',side:i%2?'right':'left',content:`消息 ${i}`}))});
const latest=render({getContext:()=>ctx},p);const earlier=render({getContext:()=>ctx},{...p,captureOffset:latest.view.max_scroll});
assert(latest.view.max_scroll>0);assert(latest.structured_info.messages.some(m=>m.id==='34'));assert(!latest.structured_info.messages.some(m=>m.id==='0'));
assert(earlier.structured_info.messages.some(m=>m.id==='0'));assert(!earlier.structured_info.messages.some(m=>m.id==='34'));
for(const meta of [latest,earlier])for(const b of meta.rect_attrs){assert(b.y>=98*3);assert(b.y+b.height<=(874-90)*3);}
console.log('PASS: script grammar, role mapping, non-mutating preview, error handling, undo/redo branching, capture position and clipped coordinates');

import {MaterialsStore} from '../materials/store.js';
export class ScanStore extends MaterialsStore{
  async open(){
    if(!this.promise)this.promise=new Promise((resolve,reject)=>{
      if(!this.factory)return reject(Error('当前浏览器无法保存扫描方案'));
      const r=this.factory.open('material-center-scans-v1',1);
      r.onupgradeneeded=()=>r.result.createObjectStore('workspace');
      r.onsuccess=()=>{r.result.onversionchange=()=>r.result.close();resolve(r.result);};
      r.onerror=()=>reject(Error('扫描草稿无法保存'));r.onblocked=()=>reject(Error('请关闭旧扫描页面后重试'));
    }).catch(e=>{this.promise=null;throw e;});
    return this.promise;
  }
}

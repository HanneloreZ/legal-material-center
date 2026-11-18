export class MaterialsStore {
  constructor(factory=globalThis.indexedDB){this.factory=factory;}
  async open(){
    if(!this.promise)this.promise=new Promise((resolve,reject)=>{
      if(!this.factory)return reject(Error('当前浏览器无法保存文档与图片草稿'));
      const r=this.factory.open('material-center-materials-v1',1);
      r.onupgradeneeded=()=>r.result.createObjectStore('workspace');
      r.onsuccess=()=>{r.result.onversionchange=()=>r.result.close();resolve(r.result);};
      r.onerror=()=>reject(Error('草稿存储无法打开：'+r.error?.message));
      r.onblocked=()=>reject(Error('请关闭旧页面后重试草稿存储'));
    }).catch(e=>{this.promise=null;throw e;});
    return this.promise;
  }
  async transaction(mode,fn){const db=await this.open();return new Promise((resolve,reject)=>{
    const t=db.transaction('workspace',mode),r=fn(t.objectStore('workspace'));let result;
    r.onsuccess=()=>{result=r.result;};t.oncomplete=()=>resolve(result);t.onerror=t.onabort=()=>reject(Error('草稿未能保存，请导出方案备份：'+(t.error?.message||'存储空间不足')));
  });}
  get(){return this.transaction('readonly',s=>s.get('current'));}
  put(value){return this.transaction('readwrite',s=>s.put(value,'current'));}
}

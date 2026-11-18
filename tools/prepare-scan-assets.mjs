import {cp,mkdir} from 'node:fs/promises';
const root=new URL('../node_modules/pdfjs-dist/',import.meta.url),out=new URL('../online/public/scan-assets/pdfjs/',import.meta.url);
await mkdir(out,{recursive:true});
for(const name of ['cmaps','standard_fonts','wasm','iccs'])await cp(new URL(name,root),new URL(name,out),{recursive:true});

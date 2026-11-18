const MAX_PAGES=30,MAX_PIXELS=16000000;
function canvas(w,h){if(w*h>MAX_PIXELS||w<1||h<1)throw Error('单页像素过大，请降低分辨率');const c=document.createElement('canvas');c.width=Math.ceil(w);c.height=Math.ceil(h);return c;}

export async function openSource(model,blob){
  const format=model.source.file.format;
  if(format==='pdf'){
    const pdfjs=await import('pdfjs-dist');
    const {default:worker}=await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
    pdfjs.GlobalWorkerOptions.workerSrc=worker;
    const assets=import.meta.env.BASE_URL+'scan-assets/pdfjs/';
    const task=pdfjs.getDocument({data:new Uint8Array(await blob.arrayBuffer()),cMapUrl:assets+'cmaps/',cMapPacked:true,standardFontDataUrl:assets+'standard_fonts/',wasmUrl:assets+'wasm/',iccUrl:assets+'iccs/',isEvalSupported:false,enableXfa:false});
    let pdf;
    try{pdf=await task.promise;}catch(error){await task.destroy();throw Error(error.name==='PasswordException'?'PDF已加密，请先导出可打开的PDF':'PDF无法读取：'+error.message);}
    if(pdf.numPages>MAX_PAGES){await task.destroy();throw Error('每份最多30页，请拆分PDF后再导入');}
    return {count:pdf.numPages,note:'PDF原页面',async page(index,dpi){
      const p=await pdf.getPage(index+1),original=p.getViewport({scale:1}),viewport=p.getViewport({scale:dpi/72}),c=canvas(viewport.width,viewport.height);
      await p.render({canvasContext:c.getContext('2d'),viewport,background:'#ffffff'}).promise;p.cleanup();
      return {canvas:c,widthPt:original.width,heightPt:original.height};
    },close:()=>task.destroy()};
  }
  if(format==='docx')return openWord(blob);
  const bitmap=await createImageBitmap(blob);
  if(bitmap.width*bitmap.height>MAX_PIXELS){bitmap.close();throw Error('来源图片超过1600万像素，请先缩小');}
  return {count:1,note:'图片以150 DPI记载物理尺寸',async page(index,dpi){const widthPt=bitmap.width*72/150,heightPt=bitmap.height*72/150,c=canvas(widthPt*dpi/72,heightPt*dpi/72);c.getContext('2d').fillStyle='#fff';c.getContext('2d').fillRect(0,0,c.width,c.height);c.getContext('2d').drawImage(bitmap,0,0,c.width,c.height);return {canvas:c,widthPt,heightPt};},close:()=>bitmap.close()};
}

// DOCX's explicit page breaks are honored. Overflowing body blocks are moved to
// continuation pages instead of rasterizing a clipped fixed-height section.
export function paginateWord(doc){
  const originals=[...doc.querySelectorAll('section.docx')],pages=[];
  for(const original of originals){
    const css=doc.defaultView.getComputedStyle(original),height=parseFloat(css.minHeight)||1122.52;
    const articles=[...original.querySelectorAll(':scope > article')];
    if(articles.some(a=>Number(doc.defaultView.getComputedStyle(a).columnCount)>1))throw Error('多栏Word请先从Word导出PDF，以保留原分页');
    const blocks=articles.flatMap(a=>[...a.children]);
    // Footnotes have page-specific anchors; avoid silently moving them.
    if([...original.children].some(node=>!['HEADER','ARTICLE','FOOTER'].includes(node.tagName)))throw Error('含复杂脚注的Word请先导出PDF');
    let page,body,available;
    function next(){
      page=original.cloneNode(false);page.style.height=height+'px';page.style.minHeight=height+'px';page.style.overflow='visible';
      const header=original.querySelector(':scope > header')?.cloneNode(true),footer=original.querySelector(':scope > footer')?.cloneNode(true);
      if(header)page.append(header);body=(articles[0]||doc.createElement('article')).cloneNode(false);body.style.flexShrink='0';page.append(body);if(footer)page.append(footer);
      original.parentNode.insertBefore(page,original);pages.push(page);
      available=height-parseFloat(css.paddingTop)-parseFloat(css.paddingBottom)-(header?.getBoundingClientRect().height||0)-(footer?.getBoundingClientRect().height||0);
      if(available<50)throw Error('Word正文区域过小，请先导出PDF');
      if(pages.length>MAX_PAGES)throw Error('Word重排后超过30页，请拆分文档');
    }
    function carryHeadings(){
      const carry=[];
      while(body.lastElementChild&&(/heading|title|标题/i.test(body.lastElementChild.className)||/^H[1-6]$/.test(body.lastElementChild.tagName))){const heading=body.lastElementChild;carry.unshift(heading);heading.remove();}
      return carry;
    }
    function put(node){
      body.append(node);
      if(body.getBoundingClientRect().height>available+1){
        node.remove();
        if(!body.children.length)throw Error('Word单段、图片或表格行超过一页，请先从Word导出PDF');
        const carry=carryHeadings();next();body.append(...carry,node);
        if(body.getBoundingClientRect().height>available+1)throw Error('Word单段、图片或表格行超过一页，请先从Word导出PDF');
      }
    }
    next();
    for(const block of blocks){
      if(block.tagName==='TABLE'){
        const rows=[...block.querySelectorAll(':scope > tr, :scope > tbody > tr, :scope > thead > tr, :scope > tfoot > tr')];
        if(rows.some(row=>[...row.cells].some(cell=>cell.rowSpan>1))&&block.getBoundingClientRect().height>available)throw Error('跨页合并单元格表格请先从Word导出PDF');
        let table=block.cloneNode(false);const col=block.querySelector(':scope > colgroup');if(col)table.append(col.cloneNode(true));body.append(table);
        for(const row of rows){
          const copy=row.cloneNode(true);table.append(copy);
          if(body.getBoundingClientRect().height>available+1){copy.remove();if(!table.querySelector('tr'))table.remove();const carry=carryHeadings();next();body.append(...carry);table=block.cloneNode(false);if(col)table.append(col.cloneNode(true));body.append(table);table.append(copy);if(body.getBoundingClientRect().height>available+1)throw Error('Word表格行超过单页，请先导出PDF');}
        }
      }else put(block.cloneNode(true));
    }
    original.remove();
  }
  return pages;
}

async function openWord(blob){
  const frame=document.createElement('iframe');frame.title='Word排版转换区';frame.setAttribute('sandbox','allow-same-origin');frame.setAttribute('aria-hidden','true');frame.style.cssText='position:fixed;left:-20000px;top:0;width:1400px;height:1200px;border:0;pointer-events:none';document.body.append(frame);
  const doc=frame.contentDocument;
  try{
    doc.open();doc.write('<!doctype html><html><head></head><body></body></html>');doc.close();
    const {renderAsync}=await import('docx-preview');
    await renderAsync(await blob.arrayBuffer(),doc.body,doc.head,{inWrapper:false,ignoreLastRenderedPageBreak:false,useBase64URL:true,renderChanges:false,renderAltChunks:false,renderComments:false});
    const style=doc.createElement('style');style.textContent=`@font-face{font-family:ScanFallback;src:url('${new URL(import.meta.env.BASE_URL+'fonts/NotoSansSC-Regular.ttf',location.origin)}')}body{margin:0;background:white;font-family:"Times New Roman","Songti SC",ScanFallback,serif}section.docx{box-shadow:none!important;margin:0!important;background:white}section.docx>article{flex-shrink:0}`;doc.head.append(style);
    for(const node of doc.querySelectorAll('[style]'))if(node.style.fontFamily)node.style.fontFamily+=',ScanFallback,serif';
    await doc.fonts.load('12px ScanFallback');await doc.fonts.ready;await Promise.all([...doc.images].map(img=>img.decode().catch(()=>{throw Error('Word内嵌图片无法读取');})));
    const pages=paginateWord(doc);
    if(!pages.length)throw Error('Word中没有可转换页面');
    return {count:pages.length,note:'Word浏览器重排；原版分页请使用PDF',async page(index,dpi){
      const element=pages[index],bounds=element.getBoundingClientRect();
      if(bounds.width*bounds.height*(dpi/96)**2>MAX_PIXELS)throw Error('Word页面尺寸过大，请降低分辨率');
      const {default:html2canvas}=await import('html2canvas');
      const c=await html2canvas(element,{scale:dpi/96,backgroundColor:'#ffffff',logging:false,useCORS:false,allowTaint:false,width:bounds.width,height:bounds.height,windowWidth:1400,windowHeight:1600});
      return {canvas:c,widthPt:bounds.width*.75,heightPt:bounds.height*.75};
    },close:()=>frame.remove()};
  }catch(error){frame.remove();throw error;}
}

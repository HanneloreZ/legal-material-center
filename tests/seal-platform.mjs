import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createCanvas, GlobalFonts} from '@napi-rs/canvas';
import {DOMParser} from '@xmldom/xmldom';
import {imageAndTextPDF} from '../online/shared/pdf.js';
import {PAIRINGS,activePairing,handFont,loadHandFont,missingGlyphs,setExportPairing} from '../online/shared/font-policy.js';
import {SEAL_KINDS,SEAL_TEXTURES,applyPageScan,applySealTexture,arcGlyphAngles,drawSeal,inkStats,uprightAngle} from '../online/shared/seal.js';
import {renderNewMaterial} from '../online/materials/render.js';
import {exampleDocument} from '../online/materials/documents.js';
import {pdfFromImages as financePdf} from '../online/modules/finance/lib/export.ts';
import {documentPages as financePages} from '../online/modules/finance/lib/documents.ts';
import {demo} from '../online/modules/finance/lib/finance.ts';
import {cleanSeal} from '../online/scans/model.js';
import {editZip,readZip,storedPayload} from '../online/reference-edit/zip.js';
import {editPdf} from '../online/reference-edit/edit.js';
import JSZip from 'jszip';

GlobalFonts.registerFromPath(fileURLToPath(new URL('../online/public/fonts/NotoSansSC-Bold.ttf', import.meta.url)), 'SealUI');
const rare = '龘';
for (const font of ['xiaolai','jason','chen','yshi','tsuipita']) {
  handFont(font);
  const bytes = await loadHandFont(font);
  const missing = missingGlyphs(bytes, rare + '国');
  assert.equal(missing.includes(rare), true, font);
  assert.equal(missing.includes('国'), false, font + ' should cover 国');
  assert.equal(missingGlyphs(bytes, '沈予安').length, 0, font);
}
assert.throws(() => handFont('mashan'), /没有这款/);

const bottom = arcGlyphAngles('合成样本章', 200, 200, 140, 140, 130, 50, Array(5).fill(18));
assert.equal(bottom.length, 5);
assert(bottom.every(glyph => Math.abs(glyph.angle) <= 90), 'bottom arc stays upright');
assert(bottom[0].x < bottom.at(-1).x, 'bottom arc reads left to right');
const inward = uprightAngle(170);
assert(Math.abs(inward) <= 90);

function canvasSeal(spec) {
  const oval = spec.kind === 'oval_contract';
  const width = 360, height = oval ? Math.round(width / 1.36) : 360;
  const canvas = createCanvas(width, height + (spec.kind === 'name_chop' || spec.kind === 'circle_name_only' ? 28 : 0));
  const ctx = canvas.getContext('2d');
  drawSeal(ctx, {...spec, size: width});
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const textured = applySealTexture(image.data, canvas.width, canvas.height, spec.texture || 'normal');
  return {rgba: textured, width: canvas.width, height: canvas.height};
}
const hashes = new Set();
const stats = {};
for (const kind of SEAL_KINDS) for (const texture of SEAL_TEXTURES.filter(item => item.id !== 'scan')) {
  const image = canvasSeal({kind: kind.id, texture: texture.id, company: '苍澜示意科技有限公司', person: '沈予安'});
  const ink = inkStats(image.rgba);
  stats[kind.id] ||= {}; stats[kind.id][texture.id] = ink;
  let hash = 0;
  for (let i = 0; i < image.rgba.length; i += 80) hash = Math.imul(hash, 31) + image.rgba[i] >>> 0;
  const key = kind.id + ':' + texture.id + ':' + hash + ':' + ink.coverage;
  assert.equal(hashes.has(key), false);
  hashes.add(key);
}
for (const kind of SEAL_KINDS) {
  const row = stats[kind.id];
  assert(row.light.mean < row.normal.mean * .9, kind.id + ' light');
  assert(row.gap.coverage < row.light.coverage, kind.id + ' gap');
  assert(row.heavy.coverage > row.normal.coverage, kind.id + ' heavy');
}
const base = canvasSeal({kind:'circle_emblem', texture:'normal', company:'苍澜示意科技有限公司'});
const heavy = canvasSeal({kind:'circle_emblem', texture:'heavy', company:'苍澜示意科技有限公司'});
for (const image of [base, heavy]) {
  for (const widths of [[90,90,90,90], [70,80,100,110]]) {
    assert.equal(widths.reduce((sum, width) => sum + width, 0), image.width);
    let x = 0; const parts = widths.map((width, index) => {
      const slice = new Uint8Array(width * image.height * 4);
      for (let y = 0; y < image.height; y++) slice.set(image.rgba.subarray((y * image.width + x) * 4, (y * image.width + x + width) * 4), y * width * 4);
      x += width; return slice;
    });
    const back = new Uint8Array(image.rgba.length); x = 0;
    parts.forEach((slice, index) => {
      for (let y = 0; y < image.height; y++) back.set(slice.subarray(y * widths[index] * 4, (y + 1) * widths[index] * 4), (y * image.width + x) * 4);
      x += widths[index];
    });
    assert.equal(back.length, image.rgba.length);
    for (let i = 0; i < back.length; i++) if (back[i] !== image.rgba[i]) throw new Error('骑缝拼合在第 ' + i + ' 个字节不一致');
  }
}
const page = new Uint8Array(80 * 40 * 4);
for (let i = 0; i < page.length; i += 4) { page[i] = page[i + 1] = page[i + 2] = 250; page[i + 3] = 255; }
page[4] = 10;
const scanned = applyPageScan(page, 80, 40);
assert.notEqual(scanned[4], page[4]);
assert.notEqual(scanned[scanned.length - 2], page[page.length - 2]);
assert.throws(() => cleanSeal({enabled:true, kind:'circle_emblem', texture:'normal', company:'某某人民法院'}), /法院/);
assert.equal(cleanSeal(null), null);
assert.equal(cleanSeal({enabled:false}).enabled, false);

setExportPairing('song-times');
const song = activePairing();
setExportPairing('hei-helvetica');
const hei = activePairing();
assert.equal(song.chinese, 'song'); assert.equal(hei.latin, 'helvetica');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><text x="20" y="40">合成合同 RMB 128,000.50 元</text><text x="20" y="80">合成案例材料</text></svg>`;
const png = 'data:image/png;base64,' + Buffer.from(await (await import('sharp')).default({create:{width:20,height:20,channels:3,background:'#fff'}}).png().toBuffer()).toString('base64');
const pageSpec = {width:400, height:200, svg};
async function fontNames(blob) {
  const path = fileURLToPath(new URL('../work/seal-platform.pdf', import.meta.url));
  await fs.mkdir(new URL('../work/', import.meta.url), {recursive:true});
  await fs.writeFile(path, Buffer.from(await blob.arrayBuffer()));
  return execFileSync('pdffonts', [path], {encoding:'utf8'});
}
setExportPairing('song-times');
const docPdf = await renderNewMaterial({document_id:'font-doc', revision:1, title:'劳动合同', engine:'documents', formats:['pdf'], pdf_mode:'searchable', payload:{document:exampleDocument('employment-contract')}}, {Parser:DOMParser, rasterize: async () => png});
const finance = financePages(demo(), demo().transactions[0], 'invoice');
const financeBlob = await financePdf(finance, finance.map(() => png), {Parser:DOMParser, dimensions:() => [400, 200]});
const docFonts = await fontNames(docPdf.find(file => file.format === 'pdf').blob);
const financeFonts = await fontNames(financeBlob);
assert.match(docFonts, /NotoSerifSC/); assert.match(docFonts, /Times/);
assert.match(financeFonts, /NotoSerifSC/); assert.match(financeFonts, /Times/);
const direct = await imageAndTextPDF([pageSpec], [png], {pairing: PAIRINGS.find(item => item.id === 'hei-helvetica'), Parser:DOMParser, dimensions:() => [400, 200]});
assert.match(await fontNames(direct), /NotoSansSCBold/);
assert.match(await fontNames(direct), /Helvetica/);
const text = execFileSync('pdftotext', [fileURLToPath(new URL('../work/seal-platform.pdf', import.meta.url)), '-'], {encoding:'utf8'});
assert.match(text, /128,000\.50|合成/);
await assert.rejects(imageAndTextPDF([{width:200,height:100,svg:'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><text x="10" y="40">缺字龘</text></svg>'}], [png], {pairing: song, Parser:DOMParser, dimensions:() => [200, 100]}), /缺少这些字/);

const {cleanSignature}=await import('../online/scans/model.js');
assert.equal(cleanSignature(null).enabled, false);
assert.equal(cleanSignature({enabled:false}).enabled, false);
assert.throws(() => cleanSignature({enabled:true, font:'xiaolai', name:''}), /姓名/);

const zip = new JSZip();
zip.file('Reference/a.pdf', Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF'));
zip.file('notes/keep.txt', '保持原字节');
const packed = new Uint8Array(await zip.generateAsync({type:'uint8array', compression:'DEFLATE'}));
const before = readZip(packed);
const replaced = await editZip(packed, {}, null, async () => { throw Error('不应改写'); }).catch(error => error);
assert.match(String(replaced.message || replaced), /请选择|没有/);
assert.deepEqual(storedPayload(readZip(packed), 'notes/keep.txt'), storedPayload(before, 'notes/keep.txt'));
console.log('PASS: five handwriting fonts, 5x5 textures, upright arcs, perforation reassembly, paired export fonts, unsigned drafts, scan scope');

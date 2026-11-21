import fontkit from '@pdf-lib/fontkit';

export const PAIRINGS = [
  {id:'song-times', label:'宋体 + Times', chinese:'song', latin:'times', file:'NotoSerifSC-Regular.ttf'},
  {id:'hei-helvetica', label:'黑体 + Helvetica', chinese:'hei', latin:'helvetica', file:'NotoSansSC-Bold.ttf'},
  {id:'thin-helvetica', label:'细黑 + Helvetica', chinese:'thin', latin:'helvetica', file:'NotoSansSC-Thin.ttf'},
  {id:'song-courier', label:'宋体 + Courier', chinese:'song', latin:'courier', file:'NotoSerifSC-Regular.ttf'},
  {id:'hei-times', label:'黑体 + Times', chinese:'hei', latin:'times', file:'NotoSansSC-Bold.ttf'},
];
const files = {
  song: new URL('../public/fonts/NotoSerifSC-Regular.ttf', import.meta.url),
  hei: new URL('../public/fonts/NotoSansSC-Bold.ttf', import.meta.url),
  thin: new URL('../public/fonts/NotoSansSC-Thin.ttf', import.meta.url),
};
let chosen = null;
export function pairingById(id) {
  const found = PAIRINGS.find(item => item.id === id);
  if (!found) throw Error('没有这个中西文配对');
  return found;
}
export function setExportPairing(id) { chosen = id ? pairingById(id) : null; return chosen; }
export function activePairing() {
  if (chosen) return chosen;
  try {
    const id = globalThis.localStorage?.getItem('reference-export-pairing');
    if (id) return pairingById(id);
  } catch { /* private mode */ }
  return null;
}
export function isCjk(ch) {
  const c = ch.codePointAt(0);
  return c >= 0x3400 && c <= 0x9fff || c >= 0xf900 && c <= 0xfaff || c >= 0x3000 && c <= 0x303f || c >= 0xff00 && c <= 0xffef;
}
export function splitScripts(text) {
  const parts = [];
  for (const ch of text) {
    const kind = isCjk(ch) ? 'cjk' : 'latin';
    if (!parts.length || parts.at(-1).kind !== kind) parts.push({kind, text: ch});
    else parts.at(-1).text += ch;
  }
  return parts;
}
const fonts = new Map();
export function fontOf(bytes) {
  if (!fonts.has(bytes)) fonts.set(bytes, fontkit.create(bytes));
  return fonts.get(bytes);
}
export function missingGlyphs(bytes, text) {
  const font = fontOf(bytes);
  const missing = [];
  const seen = new Set();
  for (const ch of text) {
    if (seen.has(ch) || ch === ' ' || ch === '\n' || ch === '\t') continue;
    seen.add(ch);
    const glyph = font.glyphForCodePoint(ch.codePointAt(0));
    if (!glyph || glyph.id === 0 || glyph.name === '.notdef') missing.push(ch);
  }
  return missing;
}
export async function loadChineseFont(pairing, fetcher = globalThis.fetch) {
  const url = files[pairing.chinese];
  if (url.protocol === 'file:') {
    const {readFile} = await import('node:fs/promises');
    const {fileURLToPath} = await import('node:url');
    return new Uint8Array(await readFile(fileURLToPath(url)));
  }
  const response = await fetcher(url.href);
  if (!response.ok) throw Error('无法读取所选中文字体');
  return new Uint8Array(await response.arrayBuffer());
}
export function toBase64(bytes) {
  let text = '';
  for (let i = 0; i < bytes.length; i += 32768) text += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(text);
}

export const HAND_FONTS = [
  {id:'xiaolai', label:'小赖字体 Xiaolai', file:'Xiaolai-Regular.ttf', note:'圆润硬笔。排出的姓名不是连续签名。'},
  {id:'jason', label:'清松手写体8p', file:'JasonHandwriting8p.ttf', note:'原子笔随性日常。不是毛笔，也不是真人连笔。'},
  {id:'chen', label:'辰宇落雁体 2.0 细', file:'ChenYuluoyan-2.0-Thin.ttf', note:'细硬笔。源字库以繁体为主，简体缺字会停止。'},
  {id:'yshi', label:'写意体 SC', file:'YShiWrittenSC-Regular.ttf', note:'中性笔风。不是楷书毛笔。'},
  {id:'tsuipita', label:'晓声通秋茄 ToneOZ Tsuipita', file:'ToneOZ-Tsuipita-TC.ttf', note:'中性签字笔。与前四款不是同一字体换名。'},
];
const handUrls = Object.fromEntries(HAND_FONTS.map(font => [font.id, new URL('../public/fonts/handwriting/' + font.file, import.meta.url)]));
export async function loadHandFont(id, fetcher = globalThis.fetch) {
  const url = handUrls[id];
  if (!url) throw Error('没有这款手写字体');
  if (url.protocol === 'file:') {
    const {readFile} = await import('node:fs/promises');
    const {fileURLToPath} = await import('node:url');
    return new Uint8Array(await readFile(fileURLToPath(url)));
  }
  const response = await fetcher(url.href);
  if (!response.ok) throw Error('无法读取手写字体');
  return new Uint8Array(await response.arrayBuffer());
}
export function handFont(id) {
  const found = HAND_FONTS.find(font => font.id === id);
  if (!found) throw Error('没有这款手写字体');
  return found;
}

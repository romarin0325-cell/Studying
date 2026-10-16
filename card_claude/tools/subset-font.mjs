// Offline font preparation for card_claude. Not part of the build.
// Requires the `subset-font` package, which the repository does not install. Copy this file
// into a scratch folder, run `npm i subset-font@2` there, set CARD_CLAUDE to this folder's
// parent (card_claude) and run: node subset-font.mjs <path to NotoSansKR-VF.ttf>
// Noto Sans KR (SIL Open Font License 1.1) is kept variable from weight 400 to 900. The subset
// holds the 2,350 KS X 1001 Hangul syllables, ASCII, common symbols and every character used by
// card/game and card_claude/src, written as WOFF2 to card_claude/assets/dreamsans-subset.woff2.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';

const source = process.argv[2];
if (!source) throw new Error('Pass the path to NotoSansKR-VF.ttf');
const claude = path.resolve(process.env.CARD_CLAUDE || path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
const repo = path.resolve(claude, '..');
const chars = new Set();
const add = text => { for (const ch of text) chars.add(ch); };
for (let i = 0x20; i < 0x7f; i++) chars.add(String.fromCharCode(i));
add('·…—–―‘’“”「」『』《》〈〉【】※★☆♥♡♪♬✦✧◆◇○●■□▲△▼▽→←↑↓↗×÷±°％%~～！？：；、。');
const decoder = new TextDecoder('euc-kr');
for (let hi = 0xb0; hi <= 0xc8; hi++) for (let lo = 0xa1; lo <= 0xfe; lo++) add(decoder.decode(new Uint8Array([hi, lo])));
for (const dir of [path.join(repo, 'card/game'), path.join(claude, 'src')]) {
  for (const file of fs.readdirSync(dir)) if (/\.(js|html)$/.test(file)) add(fs.readFileSync(path.join(dir, file), 'utf8'));
}
const text = [...chars].filter(ch => ch.codePointAt(0) >= 0x20 && !/[\uD800-\uDFFF]/.test(ch)).join('');
const font = fs.readFileSync(source);
const out = await subsetFont(font, text, { targetFormat:'woff2', variationAxes:{ wght:{ min:400, max:900 } } });
fs.writeFileSync(path.join(claude, 'assets/dreamsans-subset.woff2'), out);
console.log(`Noto Sans KR: ${chars.size} characters, ${font.length} -> ${out.length} bytes`);

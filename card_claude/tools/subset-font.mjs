// Offline font preparation for card_claude. Not part of the build.
// Requires the `subset-font` package, which the repository does not install. Copy this file
// into a scratch folder, run `npm i subset-font@2` there, set CARD_CLAUDE to this folder's
// parent (card_claude) and run it with node.
// Keeps the 2,350 KS X 1001 Hangul syllables, ASCII, common symbols and every character
// used by card/game and card_claude/src, then writes WOFF2 to card_claude/assets.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';

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
const font = fs.readFileSync(path.join(repo, 'card/assets/Jua-Regular.ttf'));
const out = await subsetFont(font, text, { targetFormat: 'woff2' });
fs.writeFileSync(path.join(claude, 'assets/jua-subset.woff2'), out);
console.log(`Jua: ${chars.size} characters, ${font.length} -> ${out.length} bytes`);

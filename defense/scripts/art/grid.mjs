// Crop with labelled source-pixel grid lines, for reading skull and foot landmarks off a generated sheet.
//   node defense/scripts/art/grid.mjs <src> <out.png> <left> <top> <width> <height> <step> [scale]
import sharp from 'sharp';
const [src,out,l,t,w,h,step,sc='1']=process.argv.slice(2);const L=+l,T=+t,W=+w,H=+h,S=+step,K=+sc;
const crop=await sharp(src).extract({left:L,top:T,width:W,height:H}).resize(Math.round(W*K),Math.round(H*K)).png().toBuffer();
let svg=`<svg width="${Math.round(W*K)}" height="${Math.round(H*K)}">`;
for(let x=Math.ceil(L/S)*S;x<L+W;x+=S){const X=(x-L)*K;svg+=`<line x1="${X}" y1="0" x2="${X}" y2="${H*K}" stroke="${x%(S*5)?'#00ffff55':'#00ffffcc'}"/><text x="${X+2}" y="12" font-size="11" fill="#fff" stroke="#000" stroke-width=".3">${x}</text>`;}
for(let y=Math.ceil(T/S)*S;y<T+H;y+=S){const Y=(y-T)*K;svg+=`<line x1="0" y1="${Y}" x2="${W*K}" y2="${Y}" stroke="${y%(S*5)?'#ffff0055':'#ffff00cc'}"/><text x="2" y="${Y-2}" font-size="11" fill="#fff" stroke="#000" stroke-width=".3">${y}</text>`;}
await sharp(crop).composite([{input:Buffer.from(svg+'</svg>')}]).png().toFile(out);console.log(out);

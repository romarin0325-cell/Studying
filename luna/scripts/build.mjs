import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..');
const names=['portrait','thinking','warm','resolve'];
const images={};for(const name of names)images[name]='data:image/webp;base64,'+(await fs.readFile(path.join(root,'assets',name+'.webp'))).toString('base64');
let css=await fs.readFile(path.join(root,'styles/game.css'),'utf8');css=css.replace("../assets/portrait.webp",images.portrait);
let js='';for(const name of ['core','story','main'])js+=await fs.readFile(path.join(root,'src',name+'.js'),'utf8')+'\n';
for(const name of names)js=js.replaceAll('./assets/'+name+'.webp',images[name]);
// Template-selected expression URLs must also resolve offline.
js=js.replace("art[name].src='./assets/'+name+'.webp';","art[name].src=LUNA_IMAGES[name];");
js=js.replaceAll('./assets/${d.emotion}.webp','${LUNA_IMAGES[d.emotion]}');
js='const LUNA_IMAGES='+JSON.stringify(images)+';\n'+js;
let html=await fs.readFile(path.join(root,'index.html'),'utf8');html=html.replace('<link rel="stylesheet" href="./styles/game.css">',()=>'<style>'+css+'</style>');
html=html.replace(/<script src="\.\/src\/core\.js"><\/script><script src="\.\/src\/story\.js"><\/script><script src="\.\/src\/main\.js"><\/script>/,()=>'<script>'+js.replaceAll('</script','<\\/script')+'</script>');
if(/(?:src|href)="\.\//.test(html)||/url\(['"]?\.\./.test(html))throw Error('External asset left in single-file build');
await fs.mkdir(path.join(root,'dist'),{recursive:true});await fs.writeFile(path.join(root,'dist/LunaRememberedNames.html'),html);
console.log('LunaRememberedNames.html · '+(Buffer.byteLength(html)/1024).toFixed(0)+' KiB · sha256 '+createHash('sha256').update(html).digest('hex'));

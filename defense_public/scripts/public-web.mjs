import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {build,transform} from 'esbuild';
import {gameRoot as game,assetFile} from './local-inputs.mjs';
import {loadImagePack} from './image-pack.mjs';
import {EMBEDDED_ASSET_PATHS,RUNTIME_ASSET_PATHS} from '../src/asset-policy.js';
import {HEROES,ARTIFACTS} from '../src/content.js';
import {MEMORIAL_MEDIA_PATHS,MEMORIAL_WEBP_PATHS} from '../src/memorial-media.js';
import {LIBRARY_ART} from '../src/library.js';
import {MUSIC} from '../src/audio-tracks.js';
import {BRIGHT_ART,VISUAL_HEROES} from './image-policy.mjs';
import {brightCss} from './theme-bright.mjs';

export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=file=>fs.readFile(file,'utf8').then(s=>s.replace(/\r\n/g,'\n'));
export async function releaseConfig(file=process.env.GARDEN_RELEASE_CONFIG){
  const config=file?JSON.parse(await read(path.resolve(file))):{channel:'public',analytics:{enabled:false}};
  const allowed=(obj,keys)=>obj&&typeof obj==='object'&&!Array.isArray(obj)&&Object.keys(obj).every(k=>keys.includes(k));
  if(!allowed(config,['channel','analytics'])||!['public','test'].includes(config.channel)||!allowed(config.analytics,['enabled'])||typeof config.analytics.enabled!=='boolean')throw new Error('Invalid release config');
  return {channel:config.channel,analytics:{enabled:config.analytics.enabled}};
}
export function publicHeaders(config){
  return {
    'Content-Security-Policy':`default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
    'X-Content-Type-Options':'nosniff',
    'Referrer-Policy':'no-referrer',
    'Permissions-Policy':'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    'X-Frame-Options':'DENY',
    'X-Robots-Tag':'noindex, nofollow',
  };
}
export async function buildPublicWeb({outdir=path.join(game,'dist-public'),configFile}={}){
  const config=await releaseConfig(configFile),pack=await loadImagePack(),files=new Map();
  const put=(ext,bytes)=>{const buffer=Buffer.from(bytes),name=`assets/${sha256(buffer).slice(0,20)}.${ext}`;files.set(name,buffer);return './'+name;};
  const maps={__ASTRA_ASSETS__:{},__GARDEN_MEDIA__:{},__MEMORIAL_MEDIA__:{},__MEMORIAL_FALLBACK__:{},__LIBRARY_MEDIA__:{},__MEMORIAL_THUMBS__:{},__GARDEN_AUDIO__:{}};
  for(const [id,relative] of Object.entries(EMBEDDED_ASSET_PATHS))maps.__ASTRA_ASSETS__[id]=put('webp',pack.read(relative));
  for(const h of VISUAL_HEROES)for(const kind of ['portrait','figure'])maps.__GARDEN_MEDIA__[kind+':'+h.id]=put('webp',pack.readDerived(kind+':'+h.id));
  for(const a of ARTIFACTS)maps.__GARDEN_MEDIA__['relic:'+a.id]=put('webp',pack.readDerived('relic:'+a.id));
  for(const h of HEROES){
    maps.__MEMORIAL_MEDIA__[h.id]=put('avif',pack.read(MEMORIAL_MEDIA_PATHS[h.id]));
    maps.__MEMORIAL_FALLBACK__[h.id]=put('webp',pack.read(MEMORIAL_WEBP_PATHS[h.id]));
    maps.__MEMORIAL_THUMBS__[h.id]=put('webp',pack.readDerived('memorialThumb:'+h.id));
  }
  for(const [id,relative] of Object.entries(LIBRARY_ART))maps.__LIBRARY_MEDIA__[id]=put('webp',pack.read(relative));
  for(const [id,track] of Object.entries(MUSIC))maps.__GARDEN_AUDIO__[id]=put('ogg',await fs.readFile(assetFile(track.path)));
  const font=put('woff2',await fs.readFile(assetFile('./assets/Jua-Regular.woff2')));
  const runtime=Object.fromEntries(Object.keys(RUNTIME_ASSET_PATHS).map(id=>[id,maps.__ASTRA_ASSETS__[id]]));
  const result=await build({entryPoints:[path.join(game,'src/app.js')],bundle:true,write:false,metafile:true,outfile:'app.js',format:'iife',target:['es2020'],minify:true,sourcemap:false,charset:'utf8',legalComments:'external',drop:['console','debugger'],
    define:{__GARDEN_SOLO__:'false',__GARDEN_UNLOCKED__:'false',__GARDEN_PREVIEW__:'false',__GARDEN_PUBLIC_WEB__:'true'},
    plugins:[{name:'public-runtime-assets',setup(b){b.onLoad({filter:/[\\/]asset-policy\.js$/},()=>({contents:`export const RUNTIME_ASSET_PATHS=${JSON.stringify(runtime)};`,loader:'js'}));}}],
  });
  const js=result.outputFiles.find(f=>f.path.endsWith('.js')).text;
  const notices=result.outputFiles.filter(f=>f.path.endsWith('.LEGAL.txt')).map(f=>f.text).join('\n');
  for(const input of Object.keys(result.metafile.inputs)){
    const relative=path.relative(game,path.resolve(input));
    if(relative.startsWith('..')||path.isAbsolute(relative))throw new Error('Unexpected build input');
  }
  const app=put('js',js),template=await read(path.join(game,'index.html')),night=await read(path.join(game,'src/style.css'));
  const extra=await read(path.join(game,'src/public-web.css'));
  const skins=[];
  for(const light of [false,true]){
    const themeMaps=structuredClone(maps);
    if(light)for(const [id,relative] of Object.entries(BRIGHT_ART))themeMaps.__ASTRA_ASSETS__[id]=put('webp',pack.read(relative));
    const cssSource=(light?brightCss(night,await read(path.join(game,'src/theme-bright.css'))):night)+extra;
    const css=(await transform(cssSource.replace('__FONT__',font.replace('./assets/','./')),{loader:'css',minify:true,legalComments:'none'})).code;
    skins.push({light,maps:themeMaps,css:put('css',css)});
  }
  // Content version, independent of wall clock, checkout path and Git commit metadata.
  const buildId=sha256(JSON.stringify({config,template,files:[...files].map(([n,b])=>[n,sha256(b)]),skins})).slice(0,16);
  for(const skin of skins){
    const init=put('js',Object.entries(skin.maps).map(([k,v])=>`window.${k}=${JSON.stringify(v)};`).join('')+`window.__GARDEN_RELEASE__=${JSON.stringify({...config,buildId})};`);
    const html=template.replace(/<style>\/\*__STYLE__\*\/<\/style>/,`<link rel="stylesheet" href="${skin.css}">`)
      .replace('<script>/*__ASSETS__*/</script>',`<script src="${init}" defer></script>`)
      .replace('<script>/*__SCRIPT__*/</script>',`<script src="${app}" defer></script>`)
      .replace('content="#0a1020"',skin.light?'content="#eaf4ff"':'content="#0a1020"')
      .replace('</head>','<meta name="robots" content="noindex,nofollow">\n</head>')
      .replace(/<!--[^]*?-->/g,'');
    files.set(skin.light?'bright.html':'index.html',Buffer.from(html));
  }
  files.set('THIRD_PARTY_NOTICES.txt',Buffer.from('Jua — SIL Open Font License 1.1\n'+await read(assetFile('./assets/Jua-OFL.txt'))+'\n'+notices));
  const headers=publicHeaders(config);
  files.set('_headers',Buffer.from('/*\n'+Object.entries(headers).map(([k,v])=>'  '+k+': '+v).join('\n')+'\n  Cache-Control: no-cache\n/assets/*\n  ! Cache-Control\n  Cache-Control: public, max-age=31536000, immutable\n'));
  files.set('robots.txt',Buffer.from('User-agent: *\nDisallow: /\n'));
  files.set('404.html',Buffer.from('<!doctype html><html lang="ko"><meta charset="utf-8"><title>페이지 없음</title><p>페이지가 없습니다. <a href="/">게임으로 돌아가기</a></p></html>'));
  const manifest={version:1,buildId,channel:config.channel,analyticsEnabled:config.analytics.enabled,headers,files:Object.fromEntries([...files].sort(([a],[b])=>a.localeCompare(b,'en')).map(([name,bytes])=>[name,{sha256:sha256(bytes),bytes:bytes.length}]))};
  files.set('build-manifest.json',Buffer.from(JSON.stringify(manifest,null,2)+'\n'));
  // Refuse stale/unrelated files rather than deleting a directory or accidentally deploying source.
  const existing=await fs.readdir(outdir,{recursive:true,withFileTypes:true}).catch(e=>{if(e.code==='ENOENT')return [];throw e;});
  const extraFiles=existing.filter(e=>e.isFile()).map(e=>path.relative(outdir,path.join(e.parentPath??e.path,e.name)).replaceAll('\\','/')).filter(n=>!files.has(n));
  if(extraFiles.length)throw new Error('Output contains files from another build. Choose a fresh --outdir (retain the old folder for rollback).');
  for(const [name,bytes] of files){await fs.mkdir(path.dirname(path.join(outdir,name)),{recursive:true});await fs.writeFile(path.join(outdir,name),bytes);}
  console.log(`Public web ${buildId}: ${files.size} files, ${(Array.from(files.values()).reduce((n,b)=>n+b.length,0)/1048576).toFixed(2)} MiB; analytics ${config.analytics.enabled?'aggregate-only':'disabled'}`);
  return manifest;
}

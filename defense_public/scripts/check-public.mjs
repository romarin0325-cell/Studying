import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const hash=b=>createHash('sha256').update(b).digest('hex');
export async function checkPublic(directory){
  const root=path.resolve(directory),manifest=JSON.parse(await fs.readFile(path.join(root,'build-manifest.json'),'utf8'));
  if(!/^[a-f0-9]{16}$/.test(manifest.buildId)||manifest.version!==1)throw new Error('Invalid public manifest');
  const rootFiles=['index.html','bright.html','404.html','THIRD_PARTY_NOTICES.txt','robots.txt','_headers'];
  const asset=/^assets\/[a-f0-9]{20}\.(js|css|webp|avif|ogg|woff2)$/;
  const names=Object.keys(manifest.files),actual=(await fs.readdir(root,{recursive:true,withFileTypes:true}));
  for(const entry of actual){
    if(entry.isSymbolicLink())throw new Error('Symlink in deployment');
    if(!entry.isFile())continue;
    const relative=path.relative(root,path.join(entry.parentPath??entry.path,entry.name)).replaceAll('\\','/');
    if(relative!=='build-manifest.json'&&!names.includes(relative))throw new Error('Unlisted public file: '+relative);
  }
  const forbidden=/sourceMappingURL|\b(?:testGrant|STAR_GARDEN|__GARDEN_UNLOCKED__|__GARDEN_PREVIEW__|TODO|FIXME|debugger)\b|defense(?:_public)?\/src\/|romarin0325-cell|dist-test|GPT-default|Generated with|(?:[A-Za-z]:[\\/](?:Users|home)[\\/])|\/(?:Users|home)\/[^\s"']+|\bconsole\.(?:log|debug|warn|error)\s*\(/;
  let totalBytes=0;
  for(const name of names){
    if(!rootFiles.includes(name)&&!asset.test(name))throw new Error('Not a public asset: '+name);
    const bytes=await fs.readFile(path.join(root,name)),record=manifest.files[name];
    if(hash(bytes)!==record.sha256||bytes.length!==record.bytes)throw new Error('Asset hash mismatch: '+name);
    if(bytes.length>25*1024*1024)throw new Error('Asset exceeds hosting limit: '+name);
    totalBytes+=bytes.length;
    if(asset.test(name)&&!name.startsWith('assets/'+hash(bytes).slice(0,20)))throw new Error('Unhashed asset');
    if(/\.(?:html|js|css)$/.test(name)){
      const text=bytes.toString('utf8');
      if(forbidden.test(text))throw new Error('Development marker in '+name+': '+text.match(forbidden)[0]);
      if(/data:[^;"']+;base64,[A-Za-z0-9+/=]{200}/.test(text))throw new Error('Embedded media in '+name);
      if(name.endsWith('.html')){
        if(/<script\b(?![^>]*\bsrc=)[^>]*>/i.test(text)||/<style\b/i.test(text)||/\son\w+\s*=/i.test(text))throw new Error('Inline code in '+name);
        if(bytes.length>32*1024)throw new Error('HTML is not a small shell');
      }
      const references=[...text.matchAll(/(?:\.\/)?assets\/([a-f0-9]{20}\.[a-z0-9]+)/g)].map(m=>'assets/'+m[1]);
      if(name.endsWith('.css'))references.push(...[...text.matchAll(/url\(["']?\.\/([a-f0-9]{20}\.[a-z0-9]+)/g)].map(m=>'assets/'+m[1]));
      for(const reference of references)if(!names.includes(reference))throw new Error('Missing asset reference: '+reference);
    }
  }
  for(const name of rootFiles)if(!names.includes(name))throw new Error('Missing public file '+name);
  if(!manifest.headers['Content-Security-Policy'].includes("script-src 'self';")||manifest.headers['Referrer-Policy']!=='no-referrer'||manifest.headers['X-Content-Type-Options']!=='nosniff')throw new Error('Missing security policy');
  return {buildId:manifest.buildId,channel:manifest.channel,analyticsEnabled:manifest.analyticsEnabled,files:names.length+1,totalBytes,htmlBytes:manifest.files['index.html'].bytes,manifest};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const report=await checkPublic(process.argv[2]||path.join(path.dirname(fileURLToPath(import.meta.url)),'../dist-public'));
  const {manifest,...summary}=report;console.log(JSON.stringify(summary,null,2));
}

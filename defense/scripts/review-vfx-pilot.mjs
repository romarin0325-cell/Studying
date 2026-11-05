import {execFileSync} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import {build} from 'esbuild';
import {ASSET_PATHS, BOSSES, CHAPTERS, HERO} from '../src/content.js';
import {BRIGHT_ART} from './image-policy.mjs';
import {loadImagePack} from './image-pack.mjs';
import {gameRoot} from './local-inputs.mjs';
import {REVIEW_ALLIES, REVIEW_HEROES} from './pilot-review-scenes.mjs';

const DEFAULT_BASE = 'dd18202491bbce069c9ed6ac2e590381883ecbac';
function option(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  const value = process.argv[index+1];
  if (!value || value.startsWith('--')) throw new Error(name+' requires a value');
  return value;
}

const git = (...args) => execFileSync('git',args,{cwd:gameRoot,encoding:'utf8',maxBuffer:8*1024*1024});
const ref = git('rev-parse','--verify','--end-of-options',option('--baseline',DEFAULT_BASE)+'^{commit}').trim();
const output = path.resolve(option('--out',path.join(gameRoot,'test-results','vfx-pilot','index.html')));
const directory = path.join(gameRoot,'scripts');

// Compile the old renderer and audio with their original transitive imports.
// Both compiled renderers receive the same replay from the current engine.
const baseline = {
  name:'star-garden-baseline',
  setup(build) {
    build.onResolve({filter:/^vfx-before:/}, ({path:file})=>({
      path:'defense/src/'+file.slice('vfx-before:'.length), namespace:'vfx-before',
    }));
    build.onResolve({filter:/^\./,namespace:'vfx-before'},({path:file,importer})=>({
      path:path.posix.normalize(path.posix.join(path.posix.dirname(importer),file)),namespace:'vfx-before',
    }));
    build.onLoad({filter:/\.js$/,namespace:'vfx-before'},({path:file})=>({
      contents:git('show',ref+':'+file),loader:'js',
    }));
  },
};

const pack = await loadImagePack();
const webp = bytes=>'data:image/webp;base64,'+bytes.toString('base64');
const ids = new Set(['garden','creatures','effects','effects-expansion','effects-trio','ultimates','ultimates-extra-a','ultimates-extra-b','finishers',
  ...CHAPTERS[0].bosses.map(id=>BOSSES[id]?.atlas||'bosses'),
  ...[...REVIEW_HEROES,...REVIEW_ALLIES].map(id=>HERO[id].art.atlas),
]);
const images = Object.fromEntries([...ids].map(id=>[id,webp(pack.read(ASSET_PATHS[id]))]));
const portraits = Object.fromEntries(REVIEW_HEROES.map(id=>[id,webp(pack.readDerived('portrait:'+id))]));
const figures = Object.fromEntries(REVIEW_HEROES.map(id=>[id,webp(pack.readDerived('figure:'+id))]));
const data = {images,portraits,figures,bright:webp(pack.read(BRIGHT_ART.garden)),ref:ref.slice(0,7)};

const bundle = await build({
  entryPoints:[path.join(directory,'vfx-pilot-view.js')],bundle:true,write:false,format:'iife',
  platform:'browser',minify:true,charset:'utf8',legalComments:'none',plugins:[baseline],
});
const css = await fs.readFile(path.join(gameRoot,'src','style.css'),'utf8');
const cutin = css.slice(css.indexOf('.cutin{'),css.indexOf('.aura-chips{'));
const script = value=>value.replace(/<\/script/gi,'<\\/script');
const html = (await fs.readFile(path.join(directory,'vfx-pilot-view.html'),'utf8'))
  .replace('/*__CUTIN__*/',()=>cutin)
  .replace('/*__DATA__*/',()=>script('window.VFX_PILOT_DATA='+JSON.stringify(data)+';'))
  .replace('/*__VIEW__*/',()=>script(bundle.outputFiles[0].text));
await fs.mkdir(path.dirname(output),{recursive:true});
await fs.writeFile(output,html);
console.log(output+' ('+Buffer.byteLength(html)+' bytes), baseline '+ref.slice(0,7));

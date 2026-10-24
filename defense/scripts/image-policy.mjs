import {HEROES,ARTIFACTS,ASSET_PATHS} from '../src/content.js';
import {BUILD_ONLY_ATLASES} from '../src/asset-policy.js';
import {MEMORIAL_MEDIA_PATHS,MEMORIAL_WEBP_PATHS} from '../src/memorial-media.js';
import {LIBRARY_ART} from '../src/library.js';

export const BRIGHT_ART=Object.freeze({garden:'./assets/bright/garden.webp','summon-altar':'./assets/bright/summon-altar.webp',greenhouse:'./assets/bright/greenhouse.webp'});
export const IMAGE_PROFILES=Object.freeze({
  unit:{codec:'webp',width:640,height:640,quality:90,alphaQuality:100,effort:6},
  atlas:{codec:'webp',quality:85,alphaQuality:100,effort:6},
  ultimate:{codec:'webp',quality:90,alphaQuality:100,effort:6},
  illustration:{codec:'webp',quality:82,alphaQuality:100,effort:6},
  memorialAvif:{codec:'avif',quality:45,effort:6,chromaSubsampling:'4:4:4'},
  memorialWebp:{codec:'webp',quality:76,alphaQuality:100,effort:6,smartSubsample:true},
});
export const DERIVED_PROFILES=Object.freeze({
  portrait:{width:240,height:240,quality:84,alphaQuality:100,effort:6},
  figure:{width:512,height:512,quality:85,alphaQuality:100,effort:6},
  relic:{width:240,height:240,quality:82,alphaQuality:100,effort:6},
  memorialThumb:{width:240,height:360,quality:68,alphaQuality:100,effort:6},
});

// Build inputs, runtime destinations and retention policy share one inventory.
export function imageInputs(){
  const inputs=[];
  for(const [id,source] of Object.entries(ASSET_PATHS)){
    const buildOnly=Object.hasOwn(BUILD_ONLY_ATLASES,id),heroes=HEROES.filter(h=>h.art.atlas===id).map(h=>h.id),relics=ARTIFACTS.filter(a=>a.atlas===id).map(a=>a.id);
    inputs.push({id:'atlas:'+id,source,profile:buildOnly?null:id.startsWith('unit-')?'unit':id==='ultimates'?'ultimate':'atlas',
      uses:[...(buildOnly?[]:['window.__ASTRA_ASSETS__.'+id+'; combat renderer / stage UI']),
        ...heroes.flatMap(hero=>['portrait:'+hero+'; collection / party / summon','figure:'+hero+'; home / details / cut-in / results']),
        ...relics.map(relic=>'relic:'+relic+'; collection / summon / equipment'),
        ...(buildOnly?[BUILD_ONLY_ATLASES[id]]:[])],retention:'Preserve source bytes at this path; optimized output is separate.'});
  }
  for(const [id,source] of Object.entries(BRIGHT_ART))inputs.push({id:'bright:'+id,source,profile:'atlas',uses:['Bright window.__ASTRA_ASSETS__.'+id+'; home / summon / greenhouse']});
  for(const [id,source] of Object.entries(LIBRARY_ART))inputs.push({id:'library:'+id,source,profile:'illustration',uses:['window.__LIBRARY_MEDIA__.'+id+'; completed constellation illustration']});
  for(const h of HEROES){
    inputs.push({id:'memorial:'+h.id,source:MEMORIAL_MEDIA_PATHS[h.id],profile:'memorialAvif',uses:['window.__MEMORIAL_MEDIA__.'+h.id+'; standalone painting / web primary']});
    inputs.push({id:'memorial-webp:'+h.id,source:MEMORIAL_WEBP_PATHS[h.id],profile:'memorialWebp',uses:['window.__MEMORIAL_MEDIA__.'+h.id+'; compat painting / web fallback','memorialThumb:'+h.id+'; album thumbnail cropped from preserved source']});
  }
  return inputs;
}

// Fixed destinations prevent dated cache copies. The recipe is part of the manifest
// so changes to portraits, relic grid positions or crop sizes invalidate old files.
// Owner-requested visual centring for collection portraits (2026-10-24), applied on top of the measured face centre
// in art.portrait: hair mass and held props made these read slightly left or high. Offsets are in the 512 frame.
export const PORTRAIT_NUDGE=Object.freeze({toffee_apple:[-7,0],harmonious:[-7,0],time_magician:[-7,0],doom:[0,-8],rumi:[0,-8]});
export function derivedImageInputs(){
  const inputs=[];
  for(const h of HEROES){
    const source=ASSET_PATHS[h.art.atlas],p=h.art.portrait;
    if(!p)throw new Error('Missing reviewed portrait frame: '+h.id);
    inputs.push({id:'portrait:'+h.id,source,profile:'portrait',
      crop:{left:Math.round(p.x+(PORTRAIT_NUDGE[h.id]?.[0]||0)-p.size/2),top:Math.round(p.y+(PORTRAIT_NUDGE[h.id]?.[1]||0)-p.size/2),width:p.size,height:p.size},
      destination:'./assets/optimized/ui/portraits/'+h.id+'.webp',uses:['window.__GARDEN_MEDIA__; collection / party / summon']});
    inputs.push({id:'figure:'+h.id,source,profile:'figure',crop:{left:0,top:0,width:512,height:512},
      destination:'./assets/optimized/ui/figures/'+h.id+'.webp',uses:['window.__GARDEN_MEDIA__; home / details / cut-in / results']});
  }
  for(const a of ARTIFACTS)inputs.push({id:'relic:'+a.id,source:ASSET_PATHS[a.atlas],profile:'relic',
    crop:{columns:a.atlas==='relics'?5:2,rows:a.atlas==='relics'?4:2,index:a.icon},
    destination:'./assets/optimized/ui/relics/'+a.id+'.webp',uses:['window.__GARDEN_MEDIA__; collection / summon / equipment']});
  for(const h of HEROES)inputs.push({id:'memorialThumb:'+h.id,source:MEMORIAL_WEBP_PATHS[h.id],profile:'memorialThumb',crop:null,
    destination:'./assets/optimized/ui/memorial-thumbs/'+h.id+'.webp',uses:['window.__MEMORIAL_THUMBS__; album without full-painting decode']});
  return inputs;
}

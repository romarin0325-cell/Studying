import manifest from '../../assets/manifest.json' with {type:'json'};
export const ART=Object.fromEntries(manifest.assets.map(a=>[a.id,a]));
export const imageURL=(id,small=false)=>small?(globalThis.ASTRAL_THUMBNAILS?.[id]||'./assets/thumbs/'+id+'.webp'):(globalThis.ASTRAL_IMAGES?.[id]||(ART[id]?'./'+ART[id].path:''));
export const landscape=id=>!!ART[id]&&ART[id].width>ART[id].height;
export const focal=id=>ART[id]?.anchor||[.5,.25];
// Full scenes and collection rewards always contain the entire original composition.
export const ART_USAGE={home:{fit:'contain'},scene:{fit:'contain'},memory:{fit:'contain'},battle:{fit:'contain'},avatar:{fit:'cover'},viewer:{fit:'contain'}};

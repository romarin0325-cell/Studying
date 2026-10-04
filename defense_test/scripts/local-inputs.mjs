import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const gameRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function assetFile(relative){
  const file=path.resolve(gameRoot,relative),inside=path.relative(path.join(gameRoot,'assets'),file);
  if(!inside||inside==='..'||inside.startsWith('..'+path.sep)||path.isAbsolute(inside)){
    throw new Error('Star Garden asset must stay inside defense_test/assets: '+relative);
  }
  return file;
}

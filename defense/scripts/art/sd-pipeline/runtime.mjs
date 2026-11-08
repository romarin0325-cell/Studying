import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
export const here=path.dirname(fileURLToPath(import.meta.url));
export const root=path.resolve(here,'../../../..');
export const gameRoot=path.join(root,'defense');
export const runtimeRoot=path.join(gameRoot,'test-results/sd-pipeline/runtime');
export const require=createRequire(path.join(root,'package.json'));
export const sharp=require('sharp');
export async function segment(file){return (await import('./source-views.mjs')).segment(file);}

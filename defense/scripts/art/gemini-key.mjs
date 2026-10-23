// Gemini API key for asset tools. Read from GEMINI_API_KEY or from a key file OUTSIDE the repository
// (GEMINI_KEY_FILE or --key-file). The key is only ever sent as a request header; never print or commit it.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
export function geminiKey(argv=process.argv){
  if(process.env.GEMINI_API_KEY)return process.env.GEMINI_API_KEY.trim();
  const i=argv.indexOf('--key-file'),file=i>=0?argv[i+1]:process.env.GEMINI_KEY_FILE;
  if(!file)throw new Error('Set GEMINI_API_KEY, GEMINI_KEY_FILE or pass --key-file <path outside the repo>.');
  const abs=path.resolve(file);if(!path.relative(repo,abs).startsWith('..'))throw new Error('Keep the key file outside the repository.');
  return fs.readFileSync(abs,'utf8').trim();
}
export const GEMINI_ROOT='https://generativelanguage.googleapis.com/v1beta';

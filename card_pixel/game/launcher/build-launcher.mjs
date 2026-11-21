import { execFileSync } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const launcherDir = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(launcherDir, '../dist');
const output = path.join(dist, 'Relaymare.exe');
const compiler = path.join(process.env.SystemRoot ?? 'C:\\Windows',
  'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe');

mkdirSync(dist, { recursive: true });
execFileSync(compiler, [
  '/nologo', '/target:winexe', '/optimize+', '/codepage:65001',
  '/reference:System.Windows.Forms.dll', `/win32icon:${path.join(launcherDir, 'relaymare.ico')}`, `/out:${output}`, path.join(launcherDir, 'Launcher.cs')
], { stdio: 'inherit', windowsHide: true });

console.log(`${output} (${statSync(output).size.toLocaleString('en-US')} bytes)`);

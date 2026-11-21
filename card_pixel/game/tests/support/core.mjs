import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { scheduleTimer } from '../../src/engine/bridge.js';
import { create as makeRoster } from '../../src/engine/roster.js';
import { coreBundle } from '../../tools/core-bundle.mjs';

export function createCoreRoster() {
  const sandbox = { console, Math, __relayCoreTimer: scheduleTimer };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(coreBundle(fileURLToPath(new URL('../../../../', import.meta.url))), sandbox);
  const core = sandbox.RelayCore;
  const manifest = JSON.parse(fs.readFileSync(new URL('../../assets/sprites.json', import.meta.url), 'utf8'));
  const sp = Object.fromEntries(Object.entries(manifest).map(([name, sprite]) => [name.replace(/\.png$/, ''), sprite]));
  const roster = makeRoster(core, { sp });
  return { core, roster, sp };
}

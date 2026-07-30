'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { buildOutput, checkOutput, PATHS } = require('./build_class_roguelike');

const root = path.resolve(__dirname, '..');
const project = path.join(root, 'class_roguelike');
const clientDir = path.join(project, 'dist', 'client');
const serverDir = path.join(project, 'dist', 'server');
const workerSource = path.join(project, 'worker', 'index.js');
const socialImage = path.join(project, 'og.png');

const expected = buildOutput();
checkOutput(expected);

if (!fs.existsSync(workerSource)) throw new Error(`Missing worker source: ${workerSource}`);
if (!fs.existsSync(socialImage)) throw new Error(`Missing social image: ${socialImage}`);

fs.mkdirSync(clientDir, { recursive: true });
fs.mkdirSync(serverDir, { recursive: true });
fs.writeFileSync(path.join(clientDir, 'index.html'), expected, 'utf8');
fs.copyFileSync(socialImage, path.join(clientDir, 'og.png'));
fs.copyFileSync(workerSource, path.join(serverDir, 'index.js'));

console.log('Built class_roguelike Sites deployment output.');

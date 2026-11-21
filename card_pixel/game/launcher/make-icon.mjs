// Makes the app icon from Ash's idle sprite: launcher/relaymare.ico (exe) and assets/app-icon.png (page favicon).
// Run: node card_pixel/game/launcher/make-icon.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const sprite = path.resolve(here, '../assets/ash-idle.png');

// Head, red eye and the flame in her hand, framed in a pale moon disc so the dark hair reads on dark taskbars.
// The view is centred on her face (sprite pixels); the disc always shows a whole number of sprite pixels per pixel.
const faceCenter = { x: 37, y: 24 };
const moonFill = '#efe3c8';
const ringColor = '#4a3046';

function circleSvg(size, attributes) {
  const radius = size / 2 - Math.max(0.5, size / 64);
  return Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${radius}" ${attributes}/></svg>`);
}

// Pixel-exact portrait: the sprite is scaled by a whole number around the face centre and clipped to the disc.
async function crispIcon(size, scale) {
  const view = Math.ceil(size / scale);
  const margin = view;
  const padded = await sharp(sprite)
    .extend({ top: margin, bottom: margin, left: margin, right: margin, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toBuffer();
  const left = margin + faceCenter.x - Math.floor(view / 2);
  const top = margin + faceCenter.y - Math.floor(view / 2);
  const scaled = await sharp(padded).extract({ left, top, width: view, height: view })
    .resize(view * scale, view * scale, { kernel: 'nearest' }).png().toBuffer();
  const cut = Math.floor((view * scale - size) / 2);
  const face = sharp(scaled).extract({ left: cut, top: cut, width: size, height: size });
  const clipped = await face.composite([{ input: circleSvg(size, 'fill="#fff"'), blend: 'dest-in' }]).png().toBuffer();
  const ringWidth = Math.max(1, Math.round(size / 48));
  return sharp(circleSvg(size, `fill="${moonFill}"`))
    .composite([
      { input: clipped },
      { input: circleSvg(size, `fill="none" stroke="${ringColor}" stroke-width="${ringWidth}"`) }
    ])
    .png().toBuffer();
}

const shrink = (png, size) => sharp(png).resize(size, size, { kernel: 'lanczos3' }).png().toBuffer();

function icoFile(images) {
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, png }, index) => {
    const entry = 6 + index * 16;
    header.writeUInt8(size >= 256 ? 0 : size, entry);
    header.writeUInt8(size >= 256 ? 0 : size, entry + 1);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...images.map(image => image.png)]);
}

const large = await crispIcon(256, 5);
const images = [
  { size: 256, png: large },
  { size: 64, png: await shrink(large, 64) },
  { size: 48, png: await crispIcon(48, 1) },
  { size: 32, png: await shrink(large, 32) },
  { size: 16, png: await shrink(large, 16) }
];
fs.writeFileSync(path.join(here, 'relaymare.ico'), icoFile(images));
fs.writeFileSync(path.resolve(here, '../assets/app-icon.png'), images[1].png);
console.log('relaymare.ico', images.map(image => image.size).join('/'), '+ assets/app-icon.png');

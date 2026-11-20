import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const settings = {
  musicSeconds: 8,
  clipThresholdDbfs: -1,
  quietThresholdDbfs: -60,
  quietWindowSeconds: 0.02,
  combatDungeon: 'dawn_forest'
};

const effects = [
  { id: 'tap', seconds: 0.05 },
  { id: 'hit', args: [false], seconds: 0.11 },
  { id: 'heavy_hit', method: 'hit', args: [true], seconds: 0.28 },
  { id: 'cast', seconds: 0.2 },
  { id: 'warn', seconds: 0.85 },
  { id: 'boom', seconds: 0.45 }
];

async function initializePreview({ stageSource, settings }) {
  const preview = window.musicLevelPreview;
  if (!preview) throw new Error('The music preview measurement hook did not load.');

  const AudioContextClass = window.AudioContext;
  const context = new AudioContextClass();
  const stageUrl = URL.createObjectURL(new Blob([stageSource], { type: 'text/javascript' }));
  let createAudio;
  try {
    ({ createAudio } = await import(stageUrl));
  } finally {
    URL.revokeObjectURL(stageUrl);
  }

  // Both synths are mono. Poll the live output so this works on the file:// preview.
  const analyser = context.createAnalyser();
  analyser.fftSize = 8192;
  analyser.connect(context.destination);
  const music = preview.createMusic({ context, destination: analyser });
  const { sampleRate } = context;
  await context.resume();

  let effectStart;
  // The stage synth constructs its own context. Supply the same output and clock just for unlock.
  const stageContext = {
    get currentTime() { return effectStart; },
    sampleRate,
    destination: analyser,
    createOscillator: context.createOscillator.bind(context),
    createGain: context.createGain.bind(context),
    createBuffer: context.createBuffer.bind(context),
    createBufferSource: context.createBufferSource.bind(context)
  };
  const stage = createAudio({ fast: false });
  window.AudioContext = function StageMeasurementContext() { return stageContext; };
  try {
    stage.unlockAudio();
  } finally {
    window.AudioContext = AudioContextClass;
  }

  function record(startFrame, frames) {
    const samples = new Float32Array(frames);
    const snapshot = new Float32Array(analyser.fftSize);
    const endFrame = startFrame + frames;
    const deadline = performance.now() + frames / sampleRate * 1000 + 5000;
    let nextFrame = startFrame;
    return new Promise((resolve, reject) => {
      function poll() {
        const windowEnd = Math.round(context.currentTime * sampleRate);
        if (windowEnd > nextFrame) {
          analyser.getFloatTimeDomainData(snapshot);
          // Align overlapping snapshots to the audio clock and copy each frame once.
          if (windowEnd === Math.round(context.currentTime * sampleRate)) {
            const windowStart = windowEnd - snapshot.length;
            if (nextFrame < windowStart) {
              reject(new Error(`Analyser polling missed ${windowStart - nextFrame} frames.`));
              return;
            }
            const last = Math.min(windowEnd, endFrame);
            samples.set(snapshot.subarray(nextFrame - windowStart, last - windowStart), nextFrame - startFrame);
            nextFrame = last;
            if (nextFrame === endFrame) {
              resolve(samples);
              return;
            }
          }
        }
        if (performance.now() >= deadline) {
          reject(new Error(`Timed out recording ${frames} frames (AudioContext ${context.state}).`));
          return;
        }
        setTimeout(poll, 10);
      }
      poll();
    });
  }

  function summarize(samples, levelFrames, wraps) {
    const clipThreshold = 10 ** (settings.clipThresholdDbfs / 20);
    const quietPower = 10 ** (settings.quietThresholdDbfs / 10);
    const quietWindow = Math.round(settings.quietWindowSeconds * sampleRate);
    let peak = 0;
    let sumSquares = 0;
    let aboveThreshold = 0;
    let longestQuiet = 0;
    let quietRun = 0;
    let leadingQuiet = 0;
    let heardAudio = false;

    for (let start = 0; start < samples.length; start += quietWindow) {
      const end = Math.min(start + quietWindow, samples.length);
      let windowSquares = 0;
      for (let frame = start; frame < end; frame++) {
        const amplitude = Math.abs(samples[frame]);
        const power = amplitude * amplitude;
        windowSquares += power;
        if (frame >= levelFrames) continue;
        peak = Math.max(peak, amplitude);
        sumSquares += power;
        if (amplitude > clipThreshold) aboveThreshold++;
      }
      if (windowSquares / (end - start) < quietPower) {
        quietRun += end - start;
        longestQuiet = Math.max(longestQuiet, quietRun);
      } else {
        if (!heardAudio) leadingQuiet = quietRun;
        heardAudio = true;
        quietRun = 0;
      }
    }

    if (wraps && heardAudio) longestQuiet = Math.max(longestQuiet, leadingQuiet + quietRun);
    if (!peak) throw new Error('No audio signal was captured in the level window.');

    return {
      peakDbfs: 20 * Math.log10(peak),
      rmsDbfs: 10 * Math.log10(sumSquares / levelFrames),
      shareAboveMinus1Dbfs: aboveThreshold / levelFrames,
      longestNearSilenceSeconds: longestQuiet / sampleRate,
      levelSeconds: levelFrames / sampleRate,
      silenceScanSeconds: samples.length / sampleRate
    };
  }

  window.relaymareLevelMeasurements = {
    async music({ id, dungeon }) {
      const score = preview.makeScore(id, dungeon);
      const wraps = !score.once;
      // Fresh decks start 35 ms ahead and fade in for 65 ms. Leave another 20 ms of margin.
      const startDelay = 0.12;
      const scanSeconds = wraps ? score.duration : score.duration + 0.035 - startDelay;
      const startFrame = Math.round((context.currentTime + startDelay) * sampleRate);
      const frames = Math.round(scanSeconds * sampleRate);
      const pending = record(startFrame, frames);
      music.play(id, dungeon);
      let samples;
      try {
        samples = await pending;
      } finally {
        music.stop();
      }
      // Drain the deck's 120 ms stop fade before measuring the next item.
      await new Promise(resolve => setTimeout(resolve, 180));
      return summarize(samples, Math.min(frames, Math.round(settings.musicSeconds * sampleRate)), wraps);
    },
    async effect({ id, method = id, args = [], seconds }) {
      const startFrame = Math.round((context.currentTime + 0.1) * sampleRate);
      const frames = Math.round(seconds * sampleRate);
      effectStart = startFrame / sampleRate;
      const pending = record(startFrame, frames);
      stage.sfx[method](...args);
      return summarize(await pending, frames, false);
    }
  };

  return {
    sampleRate,
    tracks: Object.entries(preview.tracks).map(([id, track]) => ({
      id, name: track.name, dungeon: track.bars ? settings.combatDungeon : null
    }))
  };
}

async function measure(page, kind, item) {
  try {
    return await page.evaluate(({ kind, item }) => window.relaymareLevelMeasurements[kind](item), { kind, item });
  } catch (error) {
    throw new Error(`Could not measure ${kind} ${item.id}.`, { cause: error });
  }
}

const previewUrl = new URL('./music-preview.html?measure', import.meta.url);
const reportUrl = new URL('./music-levels.json', import.meta.url);
const stageSource = await readFile(new URL('../src/stage/audio.js', import.meta.url), 'utf8');
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required']
});

let sampleRate;
const results = [];
try {
  const page = await browser.newPage();
  await page.goto(previewUrl.href);
  const preview = await page.evaluate(initializePreview, {
    stageSource,
    settings
  });
  sampleRate = preview.sampleRate;
  for (const track of preview.tracks) {
    console.log(`Measuring ${track.id}${track.dungeon ? ` (${track.dungeon})` : ''}…`);
    const levels = await measure(page, 'music', track);
    results.push({ kind: 'music', ...track, ...levels });
  }
  for (const effect of effects) {
    console.log(`Measuring effect ${effect.id}…`);
    const levels = await measure(page, 'effect', effect);
    results.push({ kind: 'effect', id: effect.id, ...levels });
  }
} finally {
  await browser.close();
}

const hitRms = results.find(row => row.kind === 'effect' && row.id === 'hit').rmsDbfs;
for (const row of results) row.rmsVsHitDb = row.rmsDbfs - hitRms;

console.table(results.map(row => ({
  type: row.kind,
  track: row.id,
  'peak dBFS': row.peakDbfs.toFixed(2),
  'RMS dBFS': row.rmsDbfs.toFixed(2),
  '% > −1 dBFS': (row.shareAboveMinus1Dbfs * 100).toFixed(4),
  'longest quiet ms': (row.longestNearSilenceSeconds * 1000).toFixed(1),
  'level window s': row.levelSeconds.toFixed(2),
  'quiet scan s': row.silenceScanSeconds.toFixed(2),
  'RMS vs. hit dB': row.rmsVsHitDb.toFixed(2)
})));
await writeFile(reportUrl, `${JSON.stringify({ settings, sampleRate, results }, null, 2)}\n`);
console.log(`Saved ${fileURLToPath(reportUrl)}`);

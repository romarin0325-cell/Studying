// Chords list a bass root followed by the pad voicing. Melody pairs are [note, beats],
// with null for a rest. Bass triples are [start beat, semitones from root, beats].
export const TRACKS = {
  hub: {
    name: '꿈의 관측소', description: '따뜻한 현과 별빛처럼 번지는 유리종이 밤하늘을 그립니다.',
    key: 'D major', bpm: 76, beats: 4, instruments: ['velvet', 'round', 'glass', 'brush'],
    chords: {
      Dmaj9: ['D2', 'F#3', 'A3', 'C#4', 'E4'], Bm7: ['B2', 'F#3', 'A3', 'D4'],
      Gmaj7: ['G2', 'F#3', 'B3', 'D4'], A6: ['A2', 'E3', 'F#3', 'C#4'],
      Em7: ['E2', 'G3', 'B3', 'D4'], D_Fs: ['F#2', 'A3', 'D4', 'E4']
    },
    progression: ['Dmaj9', 'Bm7', 'Gmaj7', 'A6', 'Dmaj9', 'D_Fs', 'Em7', 'A6', 'Bm7', 'Gmaj7', 'Em7', 'A6'],
    bass: [[0, 0, 1.8], [2.5, 7, 0.8]],
    melody: [
      [[null, 0.5], ['A4', 0.5], ['C#5', 0.5], ['E5', 1.5], ['F#5', 1]],
      [['D5', 1.5], ['C#5', 0.5], ['B4', 1.5], [null, 0.5]],
      [['A4', 0.5], ['B4', 0.5], ['D5', 1.5], ['F#5', 1.5]],
      [['E5', 1.5], ['C#5', 1.5], [null, 1]],
      [[null, 0.5], ['A4', 0.5], ['C#5', 0.5], ['E5', 0.5], ['A5', 2]],
      [['F#5', 1], ['E5', 0.5], ['D5', 1.5], ['A4', 1]],
      [['G4', 1], ['B4', 0.5], ['D5', 0.5], ['E5', 2]],
      [['C#5', 2], [null, 1.5], ['F#5', 0.5]],
      [['B5', 1.5], ['A5', 0.5], ['F#5', 1], ['D5', 1]],
      [['G5', 1], ['F#5', 0.5], ['D5', 1.5], [null, 1]],
      [['E5', 1], ['D5', 0.5], ['B4', 0.5], ['G4', 2]],
      [['A4', 1], ['C#5', 1], ['E5', 1], [null, 1]]
    ]
  },
  dawn_forest: {
    name: '새벽의 숲', description: '부드러운 플루트가 새벽빛을 따라 가볍게 오릅니다.',
    key: 'G major', bpm: 94, beats: 4, instruments: ['velvet', 'round', 'flute', 'seed'],
    chords: {
      Gadd9: ['G2', 'B3', 'D4', 'A4'], Em7: ['E2', 'G3', 'B3', 'D4'],
      Cmaj7: ['C2', 'G3', 'B3', 'E4'], Dsus: ['D2', 'A3', 'D4', 'G4'],
      Bm7: ['B2', 'F#3', 'A3', 'D4'], D7: ['D2', 'A3', 'C4', 'F#4']
    },
    progression: ['Gadd9', 'Em7', 'Cmaj7', 'Dsus', 'Bm7', 'Em7', 'Cmaj7', 'D7'],
    bass: [[0, 0, 1.3], [2, 7, 0.65], [3, 12, 0.55]],
    melody: [
      [['G4', 0.5], ['A4', 0.5], ['B4', 1], ['D5', 1.5], ['B4', 0.5]],
      [['E5', 1], ['D5', 0.5], ['B4', 0.5], ['G4', 1.5], [null, 0.5]],
      [['G4', 0.5], ['A4', 0.5], ['B4', 1], ['E5', 1], ['D5', 1]],
      [['A4', 1.5], ['G4', 0.5], ['D5', 1.5], [null, 0.5]],
      [['F#5', 0.75], ['D5', 0.25], ['B4', 1], ['A4', 1], ['B4', 1]],
      [['E5', 0.5], ['F#5', 0.5], ['G5', 1], ['B5', 1], ['G5', 1]],
      [['E5', 1], ['G5', 0.5], ['E5', 0.5], ['D5', 1], ['C5', 1]],
      [['A4', 1], ['C5', 0.5], ['A4', 0.5], ['F#4', 1.5], [null, 0.5]]
    ]
  },
  ember_volcano: {
    name: '홍련 화산', description: '거친 리드와 엇박 북소리가 용암처럼 밀고 들어옵니다.',
    key: 'E minor', bpm: 118, beats: 4, instruments: ['reedPad', 'pulse', 'reed', 'forge'],
    chords: {
      Em: ['E2', 'B3', 'E4', 'G4'], C: ['C2', 'G3', 'C4', 'E4'],
      Am: ['A2', 'E3', 'A3', 'C4'], B7: ['B2', 'A3', 'D#4', 'F#4'],
      G: ['G2', 'B3', 'D4', 'G4'], Em_D: ['D2', 'G3', 'B3', 'E4']
    },
    progression: ['Em', 'C', 'Am', 'B7', 'Em', 'Em_D', 'G', 'B7'],
    bass: [[0, 0, 0.65], [0.75, 0, 0.4], [1.5, 12, 0.4], [2, 0, 0.65], [3.25, 7, 0.45]],
    melody: [
      [['E4', 0.75], ['G4', 0.25], ['B4', 0.75], ['A4', 0.25], ['E4', 1], [null, 1]],
      [['G4', 0.5], ['E4', 0.75], ['G4', 0.25], ['C5', 1], ['B4', 0.5], ['G4', 1]],
      [['A4', 0.75], ['C5', 0.25], ['E5', 0.75], ['D5', 0.25], ['C5', 1], ['A4', 1]],
      [['F#4', 0.5], ['A4', 0.5], ['B4', 0.75], ['D#5', 0.25], ['B4', 1.5], [null, 0.5]],
      [['E5', 0.75], ['G5', 0.25], ['B5', 0.75], ['A5', 0.25], ['G5', 0.5], ['E5', 1.5]],
      [['D5', 1], ['B4', 0.5], ['G4', 0.5], ['F#4', 0.75], ['G4', 0.25], ['B4', 1]],
      [['D5', 0.5], ['E5', 0.5], ['G5', 1], ['A5', 0.5], ['G5', 0.5], ['D5', 1]],
      [['F#5', 0.5], ['D#5', 0.5], ['B4', 0.75], ['A4', 0.25], ['F#4', 1], ['D#4', 1]]
    ]
  },
  twilight_cathedral: {
    name: '황혼 성당', description: '낮은 오르간 위로 청동종의 짧고 엄숙한 선율이 울립니다.',
    key: 'D minor', bpm: 72, beats: 4, instruments: ['organ', 'sub', 'bell', 'toll'],
    chords: {
      Dm: ['D2', 'A3', 'D4', 'F4'], Bb: ['Bb2', 'F3', 'Bb3', 'D4'],
      Gm: ['G2', 'Bb3', 'D4', 'G4'], A7: ['A2', 'G3', 'C#4', 'E4'],
      F: ['F2', 'A3', 'C4', 'F4'], C: ['C2', 'G3', 'C4', 'E4']
    },
    progression: ['Dm', 'Bb', 'Gm', 'A7', 'F', 'C', 'Bb', 'A7'],
    bass: [[0, 0, 2.6], [3, 7, 0.8]],
    melody: [
      [['D5', 1.5], ['A4', 0.5], ['F4', 1.5], [null, 0.5]],
      [['Bb4', 1.5], ['F4', 0.5], ['D4', 1.5], [null, 0.5]],
      [['G4', 1.5], ['Bb4', 0.5], ['D5', 1.5], ['C5', 0.5]],
      [['Bb4', 1], ['E4', 0.5], ['C#5', 2], [null, 0.5]],
      [['A5', 1.5], ['F5', 0.5], ['C5', 1.5], [null, 0.5]],
      [['G5', 1.5], ['E5', 0.5], ['D5', 1], ['C5', 1]],
      [['F5', 1], ['D5', 1], ['Bb4', 1.5], ['D5', 0.5]],
      [['E5', 0.75], ['D5', 0.25], ['C#5', 2.5], [null, 0.5]]
    ]
  },
  starlit_garden: {
    name: '별빛 정원', description: '하프처럼 튕기는 음과 가벼운 세 박자가 꿈결처럼 맴돕니다.',
    key: 'F major', bpm: 106, beats: 3, instruments: ['halo', 'round', 'pluck', 'waltz'],
    chords: {
      Fmaj7: ['F2', 'A3', 'C4', 'E4'], Dm7: ['D2', 'F3', 'A3', 'C4'],
      Bbmaj7: ['Bb2', 'F3', 'A3', 'D4'], C7: ['C2', 'G3', 'Bb3', 'E4'],
      Am7: ['A2', 'G3', 'C4', 'E4'], Gm7: ['G2', 'Bb3', 'D4', 'F4']
    },
    progression: ['Fmaj7', 'Dm7', 'Bbmaj7', 'C7', 'Am7', 'Dm7', 'Gm7', 'C7'],
    bass: [[0, 0, 0.8], [1, 7, 0.45], [2, 12, 0.45]],
    melody: [
      [[null, 0.5], ['C5', 0.5], ['A5', 1], ['G5', 0.5], ['F5', 0.5]],
      [['E5', 0.5], ['F5', 0.5], ['D5', 1.5], [null, 0.5]],
      [[null, 0.5], ['F5', 0.5], ['D6', 1], ['C6', 0.5], ['A5', 0.5]],
      [['G5', 1], ['E5', 0.5], ['C5', 1], [null, 0.5]],
      [['E5', 0.5], ['A5', 0.5], ['C6', 1], ['E6', 1]],
      [['D6', 1], ['C6', 0.5], ['A5', 0.5], ['F5', 1]],
      [['Bb5', 0.75], ['A5', 0.25], ['G5', 1], ['D5', 1]],
      [['E5', 0.5], ['F5', 0.5], ['G5', 0.5], ['C5', 1], [null, 0.5]]
    ]
  },
  midnight_trench: {
    name: '심야의 해구', description: '깊은 사인파 베이스와 느린 물방울 선율이 어둠 속을 떠다닙니다.',
    key: 'C minor', bpm: 60, beats: 4, instruments: ['deep', 'sub', 'droplet', 'tide'],
    chords: {
      Cm9: ['C2', 'Eb3', 'G3', 'Bb3', 'D4'], Abmaj7: ['Ab2', 'Eb3', 'G3', 'C4'],
      Fm7: ['F2', 'Ab3', 'C4', 'Eb4'], Gm7: ['G2', 'Bb3', 'D4', 'F4'],
      Ebmaj7: ['Eb2', 'G3', 'Bb3', 'D4'], G7: ['G2', 'F3', 'B3', 'D4']
    },
    progression: ['Cm9', 'Abmaj7', 'Fm7', 'Gm7', 'Ebmaj7', 'Abmaj7', 'Fm7', 'G7'],
    bass: [[0, 0, 3], [3.25, 0, 0.65]],
    melody: [
      [[null, 0.5], ['G4', 1.5], ['Eb4', 0.75], ['D4', 0.25], ['C4', 1]],
      [['Eb4', 1.5], [null, 0.5], ['G4', 1], ['Ab4', 1]],
      [['C5', 1.25], ['Ab4', 0.75], ['G4', 0.5], ['F4', 1.5]],
      [[null, 0.5], ['D4', 0.75], ['F4', 0.25], ['G4', 2.5]],
      [['Bb4', 1.5], ['G4', 0.75], ['F4', 0.25], ['Eb4', 1.5]],
      [[null, 0.75], ['C5', 1.25], ['Eb5', 0.75], ['C5', 0.25], ['G4', 1]],
      [['Ab4', 1.5], ['F4', 0.75], ['Eb4', 0.25], ['C4', 1.5]],
      [['D4', 1], ['F4', 1], ['B3', 1.5], [null, 0.5]]
    ]
  },
  arena: {
    name: '투기장', description: '짧은 브라스 구절과 행진 북이 결투의 걸음을 맞춥니다.',
    key: 'Bb major', bpm: 112, beats: 4, instruments: ['reedPad', 'pulse', 'brass', 'march'],
    chords: {
      Bb: ['Bb2', 'F3', 'Bb3', 'D4'], Gm: ['G2', 'G3', 'Bb3', 'D4'],
      Eb: ['Eb2', 'G3', 'Bb3', 'Eb4'], F7: ['F2', 'A3', 'C4', 'Eb4'],
      Cm: ['C2', 'G3', 'C4', 'Eb4'], Bb_D: ['D2', 'F3', 'Bb3', 'D4']
    },
    progression: ['Bb', 'Gm', 'Eb', 'F7', 'Bb_D', 'Eb', 'Cm', 'F7'],
    bass: [[0, 0, 0.85], [1, 0, 0.55], [2, 7, 0.85], [3, 0, 0.55]],
    melody: [
      [['Bb4', 0.75], ['Bb4', 0.25], ['D5', 1], ['F5', 1.5], [null, 0.5]],
      [['G5', 0.75], ['F5', 0.25], ['D5', 1], ['Bb4', 1.5], [null, 0.5]],
      [['Eb5', 0.75], ['Eb5', 0.25], ['G5', 1], ['Bb5', 1], ['G5', 1]],
      [['F5', 0.5], ['Eb5', 0.5], ['C5', 1], ['A4', 1.5], [null, 0.5]],
      [['D5', 0.75], ['D5', 0.25], ['F5', 1], ['Bb5', 1], ['D6', 1]],
      [['C6', 0.75], ['Bb5', 0.25], ['G5', 1], ['Eb5', 2]],
      [['G5', 0.5], ['Eb5', 0.5], ['C5', 1], ['G4', 0.75], ['C5', 0.25], ['Eb5', 1]],
      [['F5', 1], ['C5', 0.75], ['A4', 0.25], ['F4', 1], ['A4', 1]]
    ]
  },
  creation_tower: {
    name: '창조의 탑', description: '넓게 퍼지는 화음 위로 별빛 종의 선율이 층층이 올라갑니다.',
    key: 'A major', bpm: 86, beats: 4, instruments: ['halo', 'round', 'carillon', 'spire'],
    chords: {
      Aadd9: ['A2', 'E3', 'B3', 'C#4', 'E4'], Fsm7: ['F#2', 'A3', 'C#4', 'E4'],
      Dmaj7: ['D2', 'A3', 'C#4', 'F#4'], Esus: ['E2', 'A3', 'B3', 'E4'],
      Bm7: ['B2', 'A3', 'D4', 'F#4'], Csm7: ['C#2', 'G#3', 'B3', 'E4'],
      A_E: ['E2', 'A3', 'C#4', 'E4'], E7: ['E2', 'G#3', 'B3', 'D4']
    },
    progression: ['Aadd9', 'Fsm7', 'Dmaj7', 'Esus', 'Bm7', 'Csm7', 'Dmaj7', 'E7', 'Fsm7', 'Dmaj7', 'A_E', 'E7'],
    bass: [[0, 0, 1.8], [2, 7, 0.7], [3, 12, 0.85]],
    melody: [
      [['A4', 1], ['E5', 1], ['B5', 1.5], ['C#6', 0.5]],
      [['A5', 1.5], ['F#5', 0.5], ['E5', 1], ['C#5', 1]],
      [['D5', 1], ['A5', 1], ['C#6', 1.5], ['D6', 0.5]],
      [['B5', 1.5], ['A5', 0.5], ['E5', 1.5], [null, 0.5]],
      [['F#5', 0.5], ['A5', 0.5], ['B5', 1], ['D6', 1.5], ['C#6', 0.5]],
      [['B5', 1], ['G#5', 0.5], ['E5', 0.5], ['C#5', 2]],
      [['D5', 0.5], ['F#5', 0.5], ['A5', 1], ['D6', 2]],
      [['B5', 1], ['G#5', 1], ['E5', 1.5], [null, 0.5]],
      [['F#5', 1], ['C#6', 1], ['E6', 2]],
      [['D6', 1.5], ['C#6', 0.5], ['A5', 1], ['F#5', 1]],
      [['E5', 1], ['A5', 0.5], ['B5', 0.5], ['C#6', 1], ['E6', 1]],
      [['D6', 1], ['B5', 0.5], ['A5', 0.5], ['G#5', 1.5], [null, 0.5]]
    ]
  },
  battle: {
    name: '전투', description: '던전의 선율과 악기가 빠른 베이스와 엇박 타악을 타고 달립니다.',
    bpmScale: 1.28, bars: [0, 1, 2, 3, 0, -3, -2, -1], lowerBars: 0, gate: 0.72,
    bass: {
      3: [[0, 0, 0.5], [0.75, 12, 0.4], [1.5, 7, 0.4], [2.25, 0, 0.5]],
      4: [[0, 0, 0.5], [0.75, 12, 0.4], [1.5, 7, 0.4], [2, 0, 0.5], [3.25, 12, 0.5]]
    }
  },
  boss: {
    name: '보스', description: '던전의 모티프가 낮게 시작하고, 몰아치는 북 위로 다시 솟아오릅니다.',
    bpmScale: 1.48, bars: [0, 2, 1, 3, 0, -3, -2, -1], lowerBars: 4, gate: 0.86,
    bass: {
      3: [[0, 0, 0.65], [1, 0, 0.35], [1.5, 12, 0.4], [2, 7, 0.35], [2.5, 0, 0.45]],
      4: [[0, 0, 0.65], [1, 0, 0.35], [1.5, 12, 0.4], [2, 0, 0.65], [3, 7, 0.35], [3.5, 0, 0.4]]
    }
  },
  victory: {
    name: '승리', description: '유리종의 상승음이 밝은 화음에 닿고 잔향이 사라집니다.',
    key: 'G major', bpm: 132, beats: 3, instruments: ['halo', 'round', 'glass', 'seed'], once: true,
    chords: { D7: ['D2', 'A3', 'C4', 'F#4'], Gadd9: ['G2', 'B3', 'D4', 'A4'] },
    progression: ['D7', 'Gadd9'], bass: [[0, 0, 1.45]],
    melody: [
      [['D5', 0.5], ['F#5', 0.5], ['A5', 0.5], ['D6', 0.5], ['F#6', 1]],
      [['G6', 2.5], [null, 0.5]]
    ]
  },
  defeat: {
    name: '패배', description: '낮은 현과 물방울 음이 천천히 가라앉고 멈춥니다.',
    key: 'B minor', bpm: 70, beats: 3, instruments: ['deep', 'sub', 'droplet', 'tide'], once: true,
    chords: { Em7: ['E2', 'G3', 'B3', 'D4'], Bm: ['B2', 'F#3', 'B3', 'D4'] },
    progression: ['Em7', 'Bm'], bass: [[0, 0, 2.3]],
    melody: [
      [['G4', 0.75], ['F#4', 0.75], ['E4', 1.5]],
      [['D4', 1], ['B3', 1.5], [null, 0.5]]
    ]
  }
};

// [wave, low-pass Hz, level, attack s, release s, optional overtone ratio and level]
const INSTRUMENTS = {
  velvet: ['triangle', 880, 0.017, 0.28, 0.45],
  reedPad: ['sawtooth', 560, 0.022, 0.17, 0.32],
  organ: ['sine', 1050, 0.019, 0.23, 0.42, 2, 0.24],
  halo: ['triangle', 1150, 0.018, 0.32, 0.46, 2, 0.24],
  deep: ['sine', 700, 0.021, 0.38, 0.52, 1.005, 0.36],
  round: ['triangle', 420, 0.045, 0.025, 0.16],
  sub: ['sine', 260, 0.052, 0.05, 0.22],
  pulse: ['triangle', 620, 0.048, 0.012, 0.11],
  glass: ['sine', 4200, 0.066, 0.009, 0.32, 2.76, 0.31],
  flute: ['sine', 2600, 0.065, 0.041, 0.14, 2, 0.17],
  reed: ['sawtooth', 1420, 0.054, 0.028, 0.16, 1.007, 0.27],
  bell: ['sine', 3300, 0.068, 0.006, 0.46, 2.37, 0.46],
  pluck: ['triangle', 2850, 0.061, 0.008, 0.29, 2, 0.22],
  droplet: ['sine', 1700, 0.065, 0.023, 0.42, 1.5, 0.23],
  brass: ['sawtooth', 1280, 0.06, 0.057, 0.14, 1.006, 0.34],
  carillon: ['triangle', 3200, 0.063, 0.012, 0.35, 2.5, 0.3]
};

const PERCUSSION = {
  brush: { pitch: 68, color: 2100, hits: [[0, 'kick', 0.4], [2.5, 'hat', 0.45]] },
  seed: { pitch: 83, color: 2750, hits: [[0, 'kick', 0.55], [1.5, 'hat', 0.4], [3, 'hat', 0.5]] },
  forge: { pitch: 91, color: 1850, hits: [[0, 'kick', 1], [1.5, 'hat', 0.65], [2, 'kick', 0.8], [3, 'snare', 0.8], [3.5, 'hat', 0.55]] },
  toll: { pitch: 57, color: 1250, hits: [[0, 'kick', 0.64], [3, 'hat', 0.32]] },
  waltz: { pitch: 73, color: 3000, hits: [[0, 'kick', 0.64], [1, 'hat', 0.5], [2, 'hat', 0.4]] },
  tide: { pitch: 54, color: 950, hits: [[0, 'kick', 0.5], [2.75, 'hat', 0.32]] },
  march: { pitch: 88, color: 2200, hits: [[0, 'kick', 0.95], [1, 'snare', 0.85], [2, 'kick', 0.85], [3, 'snare', 0.85], [3.5, 'hat', 0.44]] },
  spire: { pitch: 63, color: 2600, hits: [[0, 'kick', 0.68], [2, 'hat', 0.4], [3.5, 'hat', 0.36]] }
};

const COMBAT_HITS = {
  battle: [[0, 'kick', 0.95], [0.75, 'hat', 0.58], [1.5, 'snare', 0.72],
    [2, 'kick', 0.78], [2.75, 'hat', 0.54], [3.25, 'snare', 0.65]],
  boss: [[0, 'kick', 1.1], [0.5, 'hat', 0.62], [1, 'snare', 0.82],
    [1.75, 'kick', 0.82], [2, 'kick', 0.95], [2.5, 'hat', 0.62],
    [3, 'snare', 0.92], [3.5, 'kick', 0.68]]
};

const PITCH_CLASSES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const MASTER_LEVEL = 10 ** (-14 / 20);
const START_AHEAD = 0.035;
const CROSSFADE = 0.8;
const STOP_FADE = 0.12;
const FOREGROUND_AHEAD = 0.35;
const BACKGROUND_AHEAD = 4;

function midi(note) {
  const [, letter, accidental, octave] = /^([A-G])([#b]?)(\d)$/.exec(note);
  const offset = accidental === '#' ? 1 : accidental === 'b' ? -1 : 0;
  return (Number(octave) + 1) * 12 + PITCH_CLASSES[letter] + offset;
}

function frequency(note) {
  return 440 * 2 ** ((note - 69) / 12);
}

function isDungeon(id) {
  return id !== 'hub' && Object.hasOwn(TRACKS, id) && !TRACKS[id].bars && !TRACKS[id].once;
}

function makeScore(id, dungeon) {
  const arrangement = TRACKS[id];
  const combat = Boolean(arrangement.bars);
  const theme = combat ? TRACKS[dungeon] : arrangement;
  const [pad, bass, lead, drum] = theme.instruments;
  const kit = PERCUSSION[drum];
  const { beats, progression } = theme;
  const secondsPerBeat = 60 / (theme.bpm * (arrangement.bpmScale ?? 1));
  const barDuration = beats * secondsPerBeat;
  const bars = combat ? arrangement.bars : progression.map((_, index) => index);
  const bassPattern = combat ? arrangement.bass[beats] : theme.bass;
  const hits = combat ? COMBAT_HITS[id] : kit.hits;
  const events = [];

  bars.forEach((bar, index) => {
    const source = bar < 0 ? progression.length + bar : bar;
    const [root, ...voicing] = theme.chords[progression[source]].map(midi);
    function note(part, pitch, beat, length, strength = 1) {
      events.push({
        part, pitch, offset: index * barDuration + beat * secondsPerBeat,
        duration: length * secondsPerBeat, strength
      });
    }

    for (const pitch of voicing) note(pad, pitch, 0, beats, 3 / voicing.length);
    for (const [beat, interval, length] of bassPattern) note(bass, root + interval, beat, length);

    const register = index < arrangement.lowerBars ? -12 : 0;
    const gate = arrangement.gate ?? 0.94;
    let beat = 0;
    for (const [pitch, length] of theme.melody[source]) {
      if (pitch) note(lead, midi(pitch) + register, beat, length * gate, beat === 0 ? 1 : 0.9);
      beat += length;
    }

    // Leave the resolving chord of each sting free of drums.
    if (theme.once && index === bars.length - 1) return;
    for (const [start, part, strength] of hits) {
      if (start < beats) note(part, 0, start, Math.min(beats - start, 0.5), strength);
    }
  });

  events.sort((a, b) => a.offset - b.offset);
  return { events, barDuration, duration: bars.length * barDuration, once: Boolean(theme.once), kit };
}

function gainAt(deck, now) {
  if (deck.fade && now >= deck.fade.start) {
    const { start, end, level } = deck.fade;
    return level * Math.max(0, (end - now) / (end - start));
  }
  return Math.min(1, Math.max(0, (now - deck.start) / deck.fadeIn));
}

function fadeOut(deck, level, start, duration) {
  const gain = deck.bus.gain;
  gain.cancelScheduledValues(start);
  gain.setValueAtTime(level, start);
  gain.linearRampToValueAtTime(0, start + duration);
  deck.fade = { start, end: start + duration, level };
}

export function createMusic({ context, destination = context.destination }) {
  let master = null;
  let timer = null;
  let noise = null;
  let current = null;
  let queued = null;
  let wanted = null;
  let dungeon = 'dawn_forest';
  let enabled = true;
  let volume = 1;
  const decks = new Set();

  function attachSource(deck, source, filter, envelope, at, end) {
    function disconnect() {
      source.onended = null;
      source.disconnect();
      filter.disconnect();
      envelope.disconnect();
      deck.voices.delete(voice);
    }

    const voice = { source, end, disconnect };
    deck.voices.add(voice);
    source.onended = disconnect;
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(deck.bus);
    source.start(at);
    source.stop(end);
  }

  function synth(deck, wave, hz, cutoff, level, attack, release, at, duration, sweep) {
    const source = context.createOscillator();
    const filter = context.createBiquadFilter();
    const envelope = context.createGain();
    const end = at + duration;
    const peak = at + Math.min(attack, duration * 0.35);
    source.type = wave;
    source.frequency.setValueAtTime(hz, at);
    if (sweep) source.frequency.exponentialRampToValueAtTime(sweep, end);
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    envelope.gain.setValueAtTime(0, at);
    envelope.gain.linearRampToValueAtTime(level, peak);
    envelope.gain.setValueAtTime(level, Math.max(peak, end - release));
    envelope.gain.linearRampToValueAtTime(0, end);
    attachSource(deck, source, filter, envelope, at, end);
  }

  function percussion(deck, part, strength, at, duration) {
    const { pitch, color } = deck.score.kit;
    if (part === 'kick') {
      synth(deck, 'sine', pitch * 1.6, 360, 0.046 * strength, 0.008, 0.16,
        at, Math.min(duration, 0.16), pitch * 0.65);
      return;
    }

    if (!noise) {
      noise = context.createBuffer(1, Math.ceil(context.sampleRate * 0.13), context.sampleRate);
      const samples = noise.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    }
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const envelope = context.createGain();
    const snare = part === 'snare';
    const end = at + Math.min(duration, snare ? 0.12 : 0.052);
    source.buffer = noise;
    filter.type = 'bandpass';
    filter.frequency.value = snare ? color : color * 1.8;
    envelope.gain.setValueAtTime(0, at);
    envelope.gain.linearRampToValueAtTime(strength * (snare ? 0.031 : 0.018), at + 0.006);
    envelope.gain.linearRampToValueAtTime(0, end);
    attachSource(deck, source, filter, envelope, at, end);
  }

  function scheduleEvent(deck, event, at) {
    const { part, pitch, duration, strength } = event;
    const instrument = INSTRUMENTS[part];
    if (!instrument) {
      percussion(deck, part, strength, at, duration);
      return;
    }

    const [wave, cutoff, level, attack, release, ratio, overtone] = instrument;
    const hz = frequency(pitch);
    synth(deck, wave, hz, cutoff, level * strength, attack, release, at, duration);
    if (ratio) {
      synth(deck, 'sine', hz * ratio, cutoff, level * strength * overtone,
        attack, release, at, duration * 0.75);
    }
  }

  function scheduleDeck(deck, now, horizon) {
    const { events, duration, once } = deck.score;
    const until = Math.min(horizon, deck.fade?.end ?? Infinity);
    if (deck.stopping || until <= deck.start) return;

    // A throttled timer can wake several bars late. Preserve the phase and skip stale notes.
    const elapsedCycles = Math.floor((now - deck.start) / duration);
    if (!once && elapsedCycles > deck.cycle) {
      deck.cycle = elapsedCycles;
      deck.index = 0;
    }

    while (!once || deck.cycle === 0) {
      const event = events[deck.index];
      const at = deck.start + deck.cycle * duration + event.offset;
      if (at >= until) break;
      if (at >= now) scheduleEvent(deck, event, at);
      deck.index++;
      if (deck.index === events.length) {
        deck.cycle++;
        deck.index = 0;
      }
    }
  }

  function releaseDeck(deck, now) {
    for (const voice of deck.voices) {
      if (now < voice.end) voice.source.stop(now);
      voice.disconnect();
    }
    deck.bus.disconnect();
    decks.delete(deck);
    if (current === deck) current = null;
    if (queued === deck) queued = null;
  }

  function advance(now) {
    if (queued && queued.start <= now) {
      current = queued;
      queued = null;
    }
    for (const deck of decks) {
      const ended = deck.score.once && now >= deck.start + deck.score.duration;
      const faded = deck.fade && now >= deck.fade.end;
      const closed = context.state === 'closed';
      if (ended || faded || closed || (deck.stopping && context.state !== 'running')) {
        if ((ended || closed) && wanted === deck.request) wanted = null;
        releaseDeck(deck, now);
      }
    }
  }

  function schedule() {
    const now = context.currentTime;
    advance(now);
    if (!decks.size) {
      if (timer !== null) clearInterval(timer);
      timer = null;
      context.removeEventListener('statechange', schedule);
      globalThis.document?.removeEventListener('visibilitychange', schedule);
      master?.disconnect();
      master = null;
      return;
    }
    if (context.state !== 'running') return;

    const ahead = globalThis.document?.hidden ? BACKGROUND_AHEAD : FOREGROUND_AHEAD;
    for (const deck of decks) scheduleDeck(deck, now, now + ahead);
  }

  function startDeck(request, at, fadeIn) {
    if (!master) {
      master = context.createGain();
      master.gain.value = MASTER_LEVEL * volume;
      master.connect(destination);
      timer = setInterval(schedule, 50);
      context.addEventListener('statechange', schedule);
      globalThis.document?.addEventListener('visibilitychange', schedule);
    }
    const bus = context.createGain();
    bus.gain.value = 0;
    bus.gain.setValueAtTime(0, at);
    bus.gain.linearRampToValueAtTime(1, at + fadeIn);
    bus.connect(master);
    const deck = {
      request, score: makeScore(request.id, request.dungeon), bus, start: at, fadeIn,
      cycle: 0, index: 0, voices: new Set(), fade: null, stopping: false
    };
    decks.add(deck);
    return deck;
  }

  function cancelQueue(now) {
    if (!queued) return;
    if (current) {
      current.bus.gain.cancelScheduledValues(queued.start);
      current.fade = null;
    }
    releaseDeck(queued, now);
  }

  function cue(request, now) {
    if (context.state === 'closed') return;
    if (!current) {
      current = startDeck(request, now + START_AHEAD, 0.065);
    } else {
      const { start, score } = current;
      const nextBar = Math.max(1, Math.floor((now - start) / score.barDuration) + 1);
      const bar = score.once ? Math.min(nextBar, score.duration / score.barDuration) : nextBar;
      const at = start + bar * score.barDuration;
      fadeOut(current, 1, at, CROSSFADE);
      queued = startDeck(request, at, CROSSFADE);
    }
    schedule();
  }

  function play(id, dungeonId = dungeon) {
    if (!Object.hasOwn(TRACKS, id) || context.state === 'closed') return;
    if (isDungeon(id)) dungeon = id;
    const combat = Boolean(TRACKS[id].bars);
    if (combat && isDungeon(dungeonId)) dungeon = dungeonId;

    const now = context.currentTime;
    advance(now);
    const region = combat ? dungeon : null;
    if (wanted?.id === id && wanted.dungeon === region) return;
    if (current?.request.id === id && current.request.dungeon === region) return;
    cancelQueue(now);
    wanted = { id, dungeon: region };
    if (enabled) cue(wanted, now);
  }

  function fadeToSilence() {
    const now = context.currentTime;
    advance(now);
    cancelQueue(now);
    current = null;
    for (const deck of decks) {
      const level = gainAt(deck, now);
      if (context.state !== 'running' || level === 0) {
        releaseDeck(deck, now);
      } else if (!deck.stopping) {
        deck.stopping = true;
        fadeOut(deck, level, now, STOP_FADE);
      }
    }
    schedule();
  }

  function stop() {
    wanted = null;
    fadeToSilence();
  }

  function setEnabled(value) {
    const next = Boolean(value);
    if (enabled === next) return;
    enabled = next;
    if (!enabled) fadeToSilence();
    else if (wanted) {
      wanted = { ...wanted };
      cue(wanted, context.currentTime);
    }
  }

  function setVolume(value) {
    if (!Number.isFinite(value)) return;
    volume = Math.min(1, Math.max(0, value));
    master?.gain.setTargetAtTime(MASTER_LEVEL * volume, context.currentTime, 0.025);
  }

  return { play, stop, setEnabled, setVolume };
}

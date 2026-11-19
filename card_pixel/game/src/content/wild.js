/* Wild creatures (Defense creature sheet). One skill each; the affixes give them their twist. */
export const WILD = {
  golem: { name: '악몽 골렘', element: 'nature', size: 'large', stats: { hp: 900, atk: 110, matk: 60, def: 80, mdef: 40 }, skill: ['강타', 'phy', 1.8] },
  emerald_beetle: { name: '에메랄드 갑충', element: 'nature', size: 'small', stats: { hp: 760, atk: 100, matk: 50, def: 95, mdef: 45 }, skill: ['껍질 돌진', 'phy', 1.8] },
  magma_beetle: { name: '용암 갑충', element: 'fire', size: 'small', stats: { hp: 700, atk: 108, matk: 86, def: 75, mdef: 55 }, skill: ['용암 분출', 'mag', 1.8] },
  gold_moth: { name: '황금 나방', element: 'light', size: 'small', stats: { hp: 560, atk: 60, matk: 118, def: 50, mdef: 90 }, skill: ['빛가루', 'mag', 1.7] },
  treant: { name: '고목 수호자', element: 'nature', size: 'large', stats: { hp: 1050, atk: 100, matk: 70, def: 85, mdef: 70 }, skill: ['뿌리 휘감기', 'phy', 1.7] },
  wraith: { name: '망령', element: 'dark', size: 'medium', stats: { hp: 620, atk: 60, matk: 122, def: 45, mdef: 95 }, skill: ['저주의 손길', 'mag', 1.8] },
  night_bat: { name: '밤박쥐', element: 'dark', size: 'small', stats: { hp: 520, atk: 112, matk: 60, def: 50, mdef: 50 }, skill: ['흡혈 이빨', 'phy', 1.6] },
  dark_knight: { name: '흑기사', element: 'dark', size: 'large', stats: { hp: 980, atk: 122, matk: 70, def: 95, mdef: 60 }, skill: ['암흑 베기', 'phy', 2.0] },
  abyss_eye: { name: '심연의 눈', element: 'water', size: 'medium', stats: { hp: 660, atk: 60, matk: 122, def: 55, mdef: 85 }, skill: ['마안', 'mag', 1.8] }
};
export const LARGE = ['golem', 'treant', 'dark_knight'];

import test from 'node:test';
import assert from 'node:assert/strict';
import { HERO_BY_ID } from '../../js/content/heroes.js';

// Values from the preceding release, independent of the new cadence helper.
const PREVIOUS = {
  rumi:[2,8.75,7,31.5], luna:[1,18,9,117], cinderella:[2,16,5,22.5], zeke:[1,16,7,73],
  snow_rabbit:[.5,6,5,37.5], avalanche_maid:[3,36,9,72], night_rabbit:[3,42,7,70], guardian:[2.5,20,7,56],
  storm_sage:[2,7.5,7,31.5], lightning_sage:[3,24,9,67.5], red_dragon:[1.8,7,8,45], flame_sage:[1.1,7,8,28],
  mushroom_king:[2.1,16,8,40], great_detective:[2.6,19,8,52], siren:[1.3,7,9,25], phantom:[2.4,29,9,50],
};

test('slower attacks and rarer skills preserve every existing hero nominal direct DPS', () => {
  for(const [id,[interval,damage,cooldown,skillDamage]] of Object.entries(PREVIOUS)) {
    const hero=HERO_BY_ID[id];
    assert.ok(hero.attack.interval>interval,`${id}: basic cadence must be readable`);
    assert.ok(hero.skill.cooldown>=cooldown*1.6,`${id}: skill must be a less frequent event`);
    assert.ok(Math.abs(hero.attack.damage/hero.attack.interval-damage/interval)<1e-6,id+' basic DPS');
    assert.ok(Math.abs(hero.skill.damage/hero.skill.cooldown-skillDamage/cooldown)<1e-6,id+' skill DPS');
    if(hero.attack.pelletDamage!==undefined) assert.equal(hero.attack.pelletDamage,hero.attack.damage,id+' pellet damage alias');
    assert.equal(hero.attack.baseDamage,hero.attack.damage);
    assert.equal(hero.attack.intervalSeconds,hero.attack.interval);
  }
  assert.ok(HERO_BY_ID.snow_rabbit.attack.interval < 1,'rapid fire keeps its distinct rhythm');
  assert.ok(HERO_BY_ID.avalanche_maid.attack.interval > 3,'sniper keeps its committed cadence');
});

test('Queen is a nature main balancer with Royal Bloom and an innate Earth Blessing', () => {
  const hero=HERO_BY_ID.queen;
  assert.equal(hero.gender,'female'); assert.equal(hero.position,'main'); assert.equal(hero.role,'balancer'); assert.equal(hero.element,'nature');
  assert.deepEqual(hero.innateAuras,[{buffId:'earth_bless',range:4}]);
  assert.equal(hero.skill.name,'로열 블룸'); assert.equal(hero.skill.shape,'area');
  assert.ok(hero.skill.onHitEffects.some(effect=>effect.statusId==='slow'));
});

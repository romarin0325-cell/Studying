import assert from 'node:assert/strict';
import { DUNGEONS } from '../../src/content/dungeons.js';
import { appearanceRegions, companionSpringRates, createProfile, missionPeriodKeys, missionsView, nextGoal, unrecruitedCompanions } from '../../src/engine/meta.js';

export function dreamClearProfile() {
  const profile = createProfile();
  profile.unlockedDungeons = Object.keys(DUNGEONS);
  profile.records.clears = Object.fromEntries(profile.unlockedDungeons.map(id => [id, {
    easy: Number(id !== 'dawn_forest'), normal: Number(id === 'dawn_forest'), nightmare: 0
  }]));
  profile.records.appliedRuns = [...profile.unlockedDungeons.map(id => `return-${id}`), 'return-again'];
  profile.records.runs = profile.records.appliedRuns.length;
  profile.notebook = { chapters: [1, 2, 3, 4, 6, 7], firstLead: 'snow_rabbit' };
  profile.recruits = { snow_rabbit: { bond: 1, since: 1 }, sunflower: { bond: 0, since: 4 } };
  profile.lead = 'snow_rabbit';
  profile.seenCharacters = ['snow_rabbit', 'marshmallow'];
  profile.ui.recent = { deep_lord: [{ dungeonId: 'creation_tower', floor: 8, result: 'win' }] };
  profile.ui.endingSeen = true;
  profile.ui.entry.done = ['departure'];
  profile.ui.entry.tours = ['preparation', 'difficulty', 'region', 'mission'];
  profile.ui.destination = 'twilight_cathedral';
  profile.ui.difficulty = { ember_volcano: 'easy' };
  return profile;
}

export function createGoalCases({ roster, storedSession, enterObservatory }) {
  const goalText = '홍련 화산 여정 생환 → 악몽 해금';
  const companion = 'marshmallow';
  const collection = page => page.locator('#collection.on');
  const sheet = page => page.locator('#sheet.on');

  async function openUnrecruited(page) {
    await enterObservatory(page);
    await page.locator('#hub.on [data-meta-page="collection"]').click();
    await collection(page).locator('#meta-unrecruited').click();
  }

  return {
    'goals-journey-unlock'() {
      const profile = dreamClearProfile();
      const goal = nextGoal(profile, null, roster);
      assert.equal(goal.text, goalText);
      assert.deepEqual(goal.target, { screen: 'dungeons', dungeonId: 'ember_volcano', difficulty: 'normal' });
      return {
        session: storedSession({ profile }), proof: 'All Dream clears and the tower point to a Journey clear with Journey preselected',
        async show(page, { text, capture }) {
          await enterObservatory(page);
          await text(page.locator('#hub.on .meta-next-goal'), goalText, { exact: true });
          await capture('observatory');
          await page.locator('#hub.on #meta-depart').click();
          await text(sheet(page).locator('#sh-title'), '홍련 화산 · 준비', { exact: true });
          await text(sheet(page).locator('[data-difficulty="normal"][aria-pressed="true"]'), '여정', { exact: true });
          await capture();
          await sheet(page).locator('[data-difficulty="easy"]').click();
          await text(sheet(page).locator('[data-difficulty="easy"][aria-pressed="true"]'), '꿈결', { exact: true });
          await sheet(page).locator('#b-sheetclose').click();
          await page.locator('#hub.on [data-meta-page="notebook"]').click();
          const notebookGoal = page.locator('#notebook.on #meta-follow-goal');
          await text(notebookGoal, goalText, { exact: true });
          await notebookGoal.click();
          await text(sheet(page).locator('[data-difficulty="normal"][aria-pressed="true"]'), '여정', { exact: true });
        }
      };
    },
    'goals-collection-unrecruited'() {
      const profile = dreamClearProfile();
      profile.ui.difficulty.midnight_trench = 'easy';
      assert.deepEqual(new Set(unrecruitedCompanions(profile, roster)), new Set([companion, 'deep_lord']));
      assert.equal(appearanceRegions(roster, companion)[0], 'ember_volcano');
      const openRates = companionSpringRates(profile, roster, companion).filter(rate => rate.unlocked && rate.percent > 0);
      assert.deepEqual(openRates.map(rate => [rate.dungeonId, rate.percent]), [
        ['midnight_trench', 4], ['ember_volcano', 40 / 11], ['starlit_garden', 40 / 11], ['creation_tower', 40 / 26]
      ]);
      return {
        session: storedSession({ profile }), proof: 'Unrecruited companion has four available springs and the best destination differs from the first base region',
        async show(page, { text, capture }) {
          await openUnrecruited(page);
          await text(collection(page).locator('#meta-unrecruited[aria-pressed="true"]'), '영입 전', { exact: true });
          await text(collection(page).locator('#meta-collected'), '영입 전 2명', { exact: true });
          assert.equal(await collection(page).locator('[data-companion]').count(), 2);
          await capture('filtered');
          await collection(page).locator(`[data-companion="${companion}"]`).click();
          const depart = sheet(page).locator('[data-companion-depart="midnight_trench"]');
          await text(depart, '심야의 해구로 · ◆1 칸 4.0%', { exact: true });
          await text(sheet(page).locator('.meta-companion-rates'), '홍련 화산 3.6% · 별빛 정원 3.6% · 창조의 탑 1.5%', { exact: true });
          await capture('companion');
          await depart.click();
          const destinations = page.locator('#dungeons.on');
          await text(destinations.locator('[data-dungeon="midnight_trench"][aria-pressed="true"] b'), '심야의 해구', { exact: true });
          await text(destinations.locator('#meta-quick-start'), '심야의 해구 · 꿈결 · 바로 출발', { exact: true });
          await capture();
        }
      };
    },
    'goals-collection-spring-hints'() {
      const profile = dreamClearProfile();
      profile.unlockedDungeons = ['dawn_forest', 'ember_volcano', 'twilight_cathedral'];
      profile.records.clears = { dawn_forest: profile.records.clears.dawn_forest, ember_volcano: { easy: 1, normal: 1, nightmare: 0 } };
      profile.notebook.chapters = [1, 2, 3, 4];
      profile.seals.ember_volcano = [companion];
      profile.seenCharacters.push('behemoth');
      profile.ui.destination = 'ember_volcano';
      assert.deepEqual(appearanceRegions(roster, 'behemoth'), ['creation_tower']);
      assert.ok(roster.pool(DUNGEONS.ember_volcano.pool).includes('sunflower') && profile.recruits.sunflower);
      for (const id of [companion, 'behemoth']) {
        assert.ok(unrecruitedCompanions(profile, roster).includes(id));
        assert.ok(companionSpringRates(profile, roster, id).every(rate => !rate.unlocked || !rate.percent));
      }
      return {
        session: storedSession({ profile }), proof: 'Sealed and locked companions have no open spring rates, while Sunflower is already recruited',
        async show(page, { text, capture }) {
          await openUnrecruited(page);
          await collection(page).locator(`[data-companion="${companion}"]`).click();
          await text(sheet(page).locator('.meta-companion-links small'), '준비에서 출현 제외 해제 필요', { exact: true });
          await capture('sealed');
          await sheet(page).locator('#b-sheetclose').click();
          await collection(page).locator('[data-companion="behemoth"]').click();
          await text(sheet(page).locator('.meta-companion-links small'), '지역 해금 필요', { exact: true });
          await capture('locked');
          await sheet(page).locator('#b-sheetclose').click();
          await collection(page).locator('#meta-unrecruited').click();
          await collection(page).locator('[data-companion="sunflower"]').click();
          assert.equal(await sheet(page).locator('.meta-companion-links').count(), 0);
          await capture('recruited');
        }
      };
    },
    'goals-collection-mission'() {
      const profile = dreamClearProfile();
      const earlier = missionPeriodKeys('2026-11-08').weekly;
      const matching = missionPeriodKeys('2026-11-15').weekly;
      for (const [key, id] of [[earlier, 'ash'], [matching, companion]]) {
        profile.missions.periods[key] = { gates: 2, regionIds: [], state: 'earned', offerOrder: [id], claimedId: null };
      }
      assert.deepEqual(missionsView(profile, roster).claimable.find(period => period.key === matching).candidates, [companion]);
      return {
        session: storedSession({ profile }), proof: 'The collection opens the exact earned mission offering the unrecruited companion',
        async show(page, { text, capture }) {
          await openUnrecruited(page);
          await collection(page).locator(`[data-companion="${companion}"]`).click();
          await sheet(page).locator('#meta-companion-mission').click();
          await text(page.locator('#notebook.on [data-screen-tab="missions"][aria-pressed="true"]'), '영입 임무', { exact: true });
          await text(sheet(page).locator(`[data-invite="${companion}"]`), roster.card(companion).name, { exact: true });
          await capture();
        }
      };
    }
  };
}

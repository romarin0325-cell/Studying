import assert from 'node:assert/strict';
import { EPISODES } from '../../src/content/episodes.js';
import { episodeGreeting } from '../../src/content/episode-greetings.js';
import { episodePages, episodeState } from '../../src/engine/episodes.js';
import { chronicle } from '../../src/engine/history.js';
import { applyRunEnd, createProfile } from '../../src/engine/meta.js';
import { EPISODE } from '../../src/ui/glossary.js';
import { SESSION_KEY } from '../../src/ui/storage.js';
import { playRun } from '../../tools/sim.mjs';

const id = 'snow_rabbit';
const episode = EPISODES[id];
const collection = '#hub.on [data-meta-page="collection"]';
const companion = `#collection.on [data-companion="${id}"]`;
const entry = '#sheet.on #meta-episode';
const badge = `${collection} #meta-episode-badge`;

async function openDetail(page, enterObservatory) {
  await enterObservatory(page);
  await page.locator(collection).click();
  const cell = page.locator(companion);
  await cell.click();
  return page.locator(entry);
}

export function createEpisodeCases({ storedSession, enterObservatory }) {
  let fixtures;
  function profiles() {
    if (fixtures) return fixtures;
    const initial = createProfile();
    initial.ui.entry.legacy = true;
    const intro = playRun('dawn_forest', 17, { profile: initial, opening: 'rescue' }).run;
    assert.equal(intro.phase, 'done');
    assert.equal(chronicle(intro)[id].fielded, true);
    const selection = { recruits: [id] };
    const receipt = applyRunEnd(initial, intro, selection);
    const locked = receipt.profile;
    assert.equal(receipt.announce.ok, true);
    assert.equal(episodeState(locked, id), 'locked');
    const expedition = playRun('ember_volcano', 7, { profile: locked, difficulty: 'easy' }).run;
    const returned = applyRunEnd(locked, expedition);
    const unlocked = returned.profile;
    assert.equal(returned.announce.ok, true);
    assert.equal(episodeState(unlocked, id), 'new');
    assert.ok(['fell', 'survived'].includes(unlocked.history[id][0].outcome), 'The companion fought in the settled run');
    return (fixtures = { initial, intro, locked, unlocked });
  }

  return {
    'episode-recruit'() {
      const { initial, intro } = profiles();
      return {
        session: storedSession({ profile: initial, run: intro }), mute: true,
        proof: 'Snow Rabbit returned from the intro and can be recruited',
        async show(page, { capture }) {
          await page.locator(`#recruit.on [data-candidate="${id}"]`).click();
          await page.locator('#recruit.on #meta-recruit-confirm').click();
          const receipt = page.locator(`#hub.on [data-recruited="${id}"]`);
          await receipt.locator('.run-face img').waitFor();
          assert.equal(await receipt.locator('.episode-greeting').textContent(), episodeGreeting(id));
          assert.equal(await page.locator(badge).count(), 0, 'The recruitment run leaves the episode locked');
          await capture();
        }
      };
    },
    'episode-locked'() {
      const { locked } = profiles();
      return {
        session: storedSession({ profile: locked }), mute: true,
        proof: 'The fielding record is from the same run in which Snow Rabbit was recruited',
        async show(page, { text, capture }) {
          const button = await openDetail(page, enterObservatory);
          await text(button, EPISODE.title(episode.title), { exact: true });
          assert.equal(await button.getAttribute('aria-disabled'), 'true');
          await text(page.locator('#sheet.on #meta-episode-condition'), EPISODE.locked, { exact: true });
          await button.focus();
          await page.keyboard.press('Enter');
          assert.equal(await page.locator('#sheet.on .episode-reader').count(), 0);
          await capture();
        }
      };
    },
    'episode-unlocked'() {
      const { unlocked } = profiles();
      return {
        session: storedSession({ profile: unlocked }), mute: true,
        proof: 'Snow Rabbit was fielded in a later settled expedition that Snow Rabbit did not survive',
        async show(page, { text, capture }) {
          const button = await openDetail(page, enterObservatory);
          await text(button, EPISODE.title(episode.title), { exact: true });
          assert.equal(await button.isEnabled(), true);
          await capture();
        }
      };
    },
    'episode-reader'() {
      const { unlocked } = profiles();
      const pages = episodePages(episode.body);
      assert.ok(pages.length > 1);
      return {
        session: storedSession({ profile: unlocked }), mute: true,
        proof: `The original Snow Rabbit episode spans ${pages.length} pages`,
        async show(page, { text, capture }) {
          const button = await openDetail(page, enterObservatory);
          await button.focus();
          await page.keyboard.press('Enter');
          await text(page.locator('#sheet.on #sh-title'), episode.title, { exact: true });
          const notes = page.locator('#sheet.on .episode-notes');
          assert.equal(await notes.getAttribute('open'), null);
          assert.equal(await notes.locator('summary:focus').count(), 1);
          await page.keyboard.press('Space');
          assert.ok(await notes.evaluate(node => node.open));
          await text(notes, episode.appearance);
          await text(notes, episode.voice);
          await page.keyboard.press('Space');
          assert.equal(await notes.getAttribute('open'), null);
          const previous = page.locator('#sheet.on #episode-prev');
          const next = page.locator('#sheet.on #episode-next');
          const paragraphs = page.locator('#sheet.on .episode-page p');
          const count = page.locator('#sheet.on .episode-count');
          const check = async index => {
            assert.deepEqual(await paragraphs.allTextContents(), pages[index]);
            await text(count, `${index + 1} / ${pages.length}`, { exact: true });
          };
          await check(0);
          assert.equal(await previous.isDisabled(), true);
          await capture('first');
          await page.keyboard.press('Tab');
          assert.equal(await page.locator('.episode-page:focus').count(), 1);
          await page.keyboard.press('Tab');
          assert.equal(await page.locator('#episode-next:focus').count(), 1);
          for (let i = 1; i < pages.length; i++) {
            await page.keyboard.press('Enter');
            await check(i);
          }
          assert.equal(await next.isDisabled(), true);
          await capture('last');
          assert.equal(await page.locator('#episode-prev:focus').count(), 1);
          await page.keyboard.press('Enter');
          await check(pages.length - 2);
          await page.keyboard.press('Escape');
          await page.locator('#sheet').waitFor({ state: 'hidden' });
          assert.equal(await page.locator(`${companion}:focus`).count(), 1);
          const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)).profile.ui.episodesRead, SESSION_KEY);
          assert.equal(saved[id], true);
          await page.reload({ waitUntil: 'domcontentloaded' });
          await enterObservatory(page);
          assert.equal(await page.locator(badge).count(), 0);
        }
      };
    },
    'episode-hub-badge'() {
      const { unlocked } = profiles();
      return {
        session: storedSession({ profile: unlocked }), mute: true,
        proof: 'Snow Rabbit has one unread episode',
        async show(page, { text, capture }) {
          await enterObservatory(page);
          await text(page.locator(badge), EPISODE.unread, { exact: true });
          const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)).profile.ui.episodesUnlocked, SESSION_KEY);
          assert.equal(saved[id], true);
          await capture();
        }
      };
    }
  };
}

const EVENT_ASSETS = ['harmonious', 'gold-dragon', 'ancient-soul', 'behemoth', 'time-ruler'];

const resolveAsset = path => (globalThis.ASTRAL_EMBEDDED_ASSETS?.[path] ?? globalThis.ASTRAL_EMBEDDED_ASSETS?.[path.startsWith('assets/') ? path.slice(7) : `assets/${path}`] ?? path);
const numbered = (root, group, count) => Array.from({ length: count }, (_, index) => resolveAsset(`${root}/${group}/${index}.webp`));

/**
 * Paths for the preprocessed, mobile-sized textures. These resolve transparently
 * through globalThis.ASTRAL_EMBEDDED_ASSETS when bundled in the single-file release,
 * or fall back to standard relative paths.
 */
export function createArtUrls(root = 'assets') {
  const heroes = numbered(root, 'heroes', 4);
  const bosses = numbered(root, 'bosses', 4);
  const enemies = numbered(root, 'enemies', 4);
  const companions = numbered(root, 'companions', 4);
  const secrets = numbered(root, 'secrets', 4);
  const sentinels = numbered(root, 'sentinels', 4);
  const relics = numbered(root, 'relics', 16);
  const tides = numbered(root, 'tides', 4);
  const bloomFx = numbered(root, 'bloom-fx', 4);
  const tideWorlds = numbered(root, 'tide-worlds', 2);
  const tideRelics = numbered(root, 'tide-relics', 6);
  const shieldRelics = numbered(root, 'shield-relics', 11);
  const celestialRelics = numbered(root, 'celestial-relics', 4);
  const balanceRelics = numbered(root, 'balance-relics', 6);
  const worlds = numbered(root, 'worlds', 4);
  const eventBosses = EVENT_ASSETS.map(name => resolveAsset(`${root}/${name}/0.webp`));
  const eventWorlds = EVENT_ASSETS.map(name => resolveAsset(`${root}/${name}-world/0.webp`));
  const asteaUrl = resolveAsset(`${root}/astea/0.webp`);
  const celestialWorldUrl = resolveAsset(`${root}/celestial-world/0.webp`);
  const darkFairyUrl = resolveAsset(`${root}/companions/dark-fairy.webp`);

  const renderedBosses = [bosses[0], bosses[1], bosses[2], tides[0], tides[1], bosses[3], asteaUrl, ...eventBosses];
  const renderedEnemies = [enemies[0], enemies[1], enemies[2], tides[2], tides[3], enemies[3], enemies[1]];
  const renderedSentinels = [sentinels[0], sentinels[1], sentinels[2], tides[2], tides[3], sentinels[3], sentinels[1]];
  const renderedWorlds = [worlds[0], worlds[1], worlds[2], tideWorlds[0], tideWorlds[1], worlds[3], celestialWorldUrl, ...eventWorlds];
  const renderedHeroes = [...heroes, companions[0], companions[1], companions[2], secrets[0], secrets[1]];
  const renderedRelics = [...relics, ...tideRelics];
  for (let index = 0; index < shieldRelics.length; index++) renderedRelics[index === 10 ? 15 : 22 + index] = shieldRelics[index];
  renderedRelics.push(...celestialRelics, ...balanceRelics);

  return {
    heroes: renderedHeroes,
    bosses: renderedBosses,
    enemies: renderedEnemies,
    worlds: renderedWorlds,
    companions,
    secrets,
    sentinels: renderedSentinels,
    relics: renderedRelics,
    baseRelics: relics,
    tides,
    bloomFx,
    astea: [asteaUrl],
    dark: secrets[2],
    sigil: secrets[3],
    darkFairy: darkFairyUrl,
    urls: {
      heroes: renderedHeroes,
      bosses: renderedBosses,
      worlds: renderedWorlds,
      relics: renderedRelics,
      dark: secrets[2],
      sigil: secrets[3]
    }
  };
}

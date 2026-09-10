(() => {
  const MODE_LABELS = {
    origin: '오리진', restriction: '제약의 시련', balance: '균형의 도전',
    suffering: '고난의 여정', puzzle: '퍼즐', archive: '아카이브',
    curse: '저주의 증폭', flood: '축복의 범람', chaos: '카오스',
    artifact_chaos: '아티팩트 카오스', draft: '드래프트', factory: '팩토리',
    artifact: '아티팩트', artifact_reserve: '아티팩트 리저브',
    overdrive: '오버드라이브', dream_corridor: '꿈의회랑'
  };
  const TYPE_LABELS = { standard: '일반', challenge: '챌린지', endless: '엔드리스' };
  const ROLE = ['선봉', '중견', '대장'];
  const byId = id => document.getElementById(id);

  function patchPortraits(imageAssets) {
    if (!imageAssets || imageAssets._azurePatched) return;
    const original = imageAssets.load.bind(imageAssets);
    imageAssets.load = function load(img, entity, options = {}) {
      if (!img) return;
      const source = this.getEntitySource(entity);
      const resolved = window.AzurePortraits ? AzurePortraits.resolve(source, img) : source;
      const wrapped = { ...options };
      const prevError = img.onerror;
      original(img, resolved, wrapped);
      const onError = img.onerror;
      img.onerror = event => {
        if (window.AzurePortraits && AzurePortraits.noteFailure(img)) {
          this.sources.delete(img);
          this.load(img, entity, { ...options, force: true });
          return;
        }
        if (typeof onError === 'function') onError.call(img, event);
        if (typeof prevError === 'function') prevError.call(img, event);
      };
    };
    imageAssets._azurePatched = true;
  }

  function renderParty(rpg) {
    const deck = rpg && rpg.state && Array.isArray(rpg.state.deck) ? rpg.state.deck : [null, null, null];
    deck.forEach((id, index) => {
      const slot = byId(`hub-party-slot-${index}`);
      const img = byId(`hub-party-img-${index}`);
      const name = slot && slot.querySelector('.hub-party-name');
      const card = id && rpg.getCardData ? rpg.getCardData(id) : null;
      if (name) name.textContent = card ? card.name : '비어 있음';
      if (slot) slot.classList.toggle('is-empty', !card);
      if (img && window.ImageAssets) ImageAssets.load(img, card || '');
    });
  }

  function renderHub(rpg) {
    if (!rpg || !rpg.state) return;
    const mode = byId('hub-mode-name');
    const meta = byId('hub-run-meta');
    const stage = byId('hub-stage-text');
    if (mode) mode.textContent = MODE_LABELS[rpg.state.mode] || rpg.state.mode || '오리진';
    if (meta) {
      const type = TYPE_LABELS[rpg.state.gameType] || '일반';
      meta.textContent = `${type} · Stage ${Number(rpg.state.enemyScale || 0) + 1}`;
    }
    if (stage) stage.textContent = `Stage ${Number(rpg.state.enemyScale || 0) + 1}`;
    const brand = document.getElementById('app');
    if (brand) brand.dataset.screen = document.querySelector('.screen.active')?.id || '';
    renderParty(rpg);
  }

  function hook(rpg) {
    if (!rpg || rpg._azureHooked) return;
    const wrap = (name, after) => {
      const original = rpg[name];
      if (typeof original !== 'function') return;
      rpg[name] = function patched(...args) {
        const result = original.apply(this, args);
        after.call(this, args, result);
        return result;
      };
    };
    wrap('showScreen', () => {
      const app = document.getElementById('app');
      const active = document.querySelector('.screen.active');
      if (app) app.dataset.screen = active ? active.id : '';
      document.body.dataset.screen = active ? active.id : '';
      renderHub(this);
    });
    wrap('toMenu', () => renderHub(this));
    wrap('confirmDeck', () => renderHub(this));
    rpg._azureHooked = true;
  }

  window.AzureShell = {
    install(rpg, imageAssets) {
      if (imageAssets) {
        window.ImageAssets = imageAssets;
        patchPortraits(imageAssets);
        imageAssets.hydrate(document);
      }
      if (window.AzureSky) AzureSky.start();
      hook(rpg);
      renderHub(rpg);
      const log = byId('battle-log');
      const toggle = byId('battle-log-toggle');
      if (log && toggle && !toggle._bound) {
        toggle._bound = true;
        toggle.onclick = () => {
          log.classList.toggle('is-collapsed');
          toggle.setAttribute('aria-expanded', String(!log.classList.contains('is-collapsed')));
        };
      }
    }
  };
})();

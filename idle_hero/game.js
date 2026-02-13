(function(){
  'use strict';

  // ====== LocalStorage 체크 ======
  var storageOK = true;
  try{
    localStorage.setItem('__t','1');
    localStorage.removeItem('__t');
  }catch(e){
    storageOK = false;
  }

  // ====== 포맷 ======
  var nf = null;
  try{ nf = new Intl.NumberFormat('ko-KR'); }catch(e){ nf = null; }
  function fmt(n){
    n = Math.floor(n);
    return nf ? nf.format(n) : String(n);
  }
  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
  function pct(p){ return (p*100).toFixed(2)+'%'; }

  function escapeHtml(s){
    s = String(s);
    return s
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#039;');
  }

  // ====== 모달 / 토스트 ======
  function toast(title, detail, ms){
    ms = ms || 3200;
    var host = document.getElementById('toastHost');
    var div = document.createElement('div');
    div.className = 'toast';
    div.innerHTML = '<div class="t">'+escapeHtml(title)+'</div>' + (detail ? '<div class="d">'+escapeHtml(detail)+'</div>' : '');
    host.appendChild(div);
    setTimeout(function(){
      div.style.opacity = '0';
      div.style.transition = 'opacity 350ms ease';
      setTimeout(function(){ if(div && div.parentNode) div.parentNode.removeChild(div); }, 400);
    }, ms);
  }

  function showModal(title, bodyText, buttons, onClose){
    var host = document.getElementById('modalHost');
    host.innerHTML = '';

    var modal = document.createElement('div');
    modal.className = 'modal';

    var h = document.createElement('h3');
    h.textContent = title || '알림';

    var body = document.createElement('div');
    body.className = 'body';
    body.innerHTML = bodyText || '';

    var actions = document.createElement('div');
    actions.className = 'actions';

    buttons = buttons || [{text:'확인', kind:'good', value:'ok'}];

    for(var i=0;i<buttons.length;i++){
      (function(btnDef){
        var b = document.createElement('button');
        b.className = 'btn ' + (btnDef.kind || '');
        b.textContent = btnDef.text || '확인';
        bindTap(b, function(){
          host.classList.remove('show');
          host.setAttribute('aria-hidden','true');
          host.innerHTML = '';
          if(onClose) onClose(btnDef.value);
        });
        actions.appendChild(b);
      })(buttons[i]);
    }

    modal.appendChild(h);
    modal.appendChild(body);
    modal.appendChild(actions);
    host.appendChild(modal);

    host.classList.add('show');
    host.setAttribute('aria-hidden','false');

    // 배경 탭 닫기
    bindTap(host, function(e){
      if(e && e.target === host){
        host.classList.remove('show');
        host.setAttribute('aria-hidden','true');
        host.innerHTML = '';
        if(onClose) onClose('backdrop');
      }
    });
  }
  // Expose showModal for global error handler
  window.showModal = showModal;

  // ====== 터치/클릭 바인딩 (모바일 WebView 대응) ======
  var lastTouchTime = 0;
  function bindTap(el, handler){
    if(!el) return;
    el.addEventListener('touchend', function(e){
      lastTouchTime = Date.now();
      try{ e.preventDefault(); }catch(_e){}
      handler(e);
    }, {passive:false});
    el.addEventListener('click', function(e){
      // 터치 직후 click 중복 방지
      if(Date.now() - lastTouchTime < 450) return;
      handler(e);
    });
  }

  // ====== 시간/날짜(도쿄) ======
  function pad2(n){ return (n<10?'0':'')+n; }
  function tokyoDateKey(date){
    date = date || new Date();
    try{
      return new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Tokyo' }).format(date);
    }catch(e){
      // fallback: UTC로 변환 후 +9h
      var utcMs = date.getTime() + (date.getTimezoneOffset()*60000);
      var tokyoMs = utcMs + 9*3600000;
      var d = new Date(tokyoMs);
      var y = d.getUTCFullYear();
      var m = d.getUTCMonth()+1;
      var dd = d.getUTCDate();
      return y+'-'+pad2(m)+'-'+pad2(dd);
    }
  }
  function dayNumberFromDateKey(key){
    var parts = key.split('-');
    var y = parseInt(parts[0],10), m = parseInt(parts[1],10), d = parseInt(parts[2],10);
    return Math.floor(Date.UTC(y,m-1,d)/86400000);
  }

  // ====== 게임 상수 ======
  var STORAGE_KEY = 'idle-elemental-heroes-singlefile-v2';
  var OFFLINE_CAP_SECONDS = 30*3600;
  var DEF_COEFF = 1000;

  var ECON = {
    baseXpPerHour: 1500,
    baseGoldPerHour: 1000,
    upgradeEffectGrowth: 1.25,
    upgradeCostGrowth: 1.45,
    xpUpgradeBaseCost: 250,
    goldUpgradeBaseCost: 250,

    weapon10Cost: 600,
    weapon100Cost: 5400,
    armor10Cost: 600,
    armor100Cost: 5400,

    card1Cost: 10,
    card10Cost: 90,
    card100Cost: 800
  };

  var RARITY_ORDER = ['normal','rare','epic','legend'];
  var RARITY_LABEL = { normal:'일반', rare:'레어', epic:'에픽', legend:'전설' };

  var ELEMENT = {
    fire:{label:'불', emoji:'🔥'},
    water:{label:'물', emoji:'💧'},
    nature:{label:'자연', emoji:'🌿'},
    light:{label:'빛', emoji:'✨'},
    dark:{label:'어둠', emoji:'🌙'},
    none:{label:'무', emoji:'⚪'}
  };

  var ADVANTAGE_TO = {
    fire:'nature',
    nature:'water',
    water:'fire',
    light:'dark',
    dark:'light'
  };

  var BASE_STATS = { hp:500, mp:100, atk:100, matk:100, def:100, mdef:100 };

  var CHAR_DEFS = [
    { id:'zeek', name:'지크', element:'fire', weaponType:'대검', physBias:0.90, magBias:0.10, defBias:1.25 },
    { id:'lumi', name:'루미', element:'water', weaponType:'원드', physBias:0.35, magBias:0.65, defBias:1.15 },
    { id:'queen', name:'여왕', element:'nature', weaponType:'채찍', physBias:0.50, magBias:0.50, defBias:1.05 },
    { id:'jasmine', name:'자스민', element:'light', weaponType:'스태프', physBias:0.25, magBias:0.75, defBias:0.95 },
    { id:'luna', name:'루나', element:'dark', weaponType:'단검', physBias:0.65, magBias:0.35, defBias:0.85 }
  ];

  var TIER_NAMES = ['브론즈','실버','골드','플래티넘','다이아','마스터','그랜드마스터','챌린저','이터널','셀레스티얼'];

  // ====== 카드 ======
  var CARD_POOLS = {
    legend: ["에인션트소울","골드드래곤","세계수","시간의지배자","혹한의마녀"],
    epic: ["폭풍의현자","그림자추적자","마왕","레드드래곤","번개의현자","화염의현자","아발란체메이드","대천사","푸딩프린세스","고스트킹"],
    rare: ["구름양","베이비드래곤","혼돈의마법사","펜리르","밤토끼","라이트엘리멘탈","생크림메이드","골렘","공허의기사","스핑크스","침묵의사서"],
    normal: ["마시멜로","코볼트","웨어베어","뱀파이어","눈토끼","페어리","캔디보이","슬라임","미이라","미믹","잭오랜턴"]
  };
  var CARD_RARITY_WEIGHTS = { legend:0.01, epic:0.03, rare:0.16, normal:0.80 };

  function buildCardDefs(){
    var defs = {};
    for(var ri=0; ri<RARITY_ORDER.length; ri++){
      var r = RARITY_ORDER[ri];
      var arr = CARD_POOLS[r];
      for(var i=0;i<arr.length;i++){
        var name = arr[i];
        var type = (i%2===0) ? 'physical' : 'magic';
        defs[name] = { name:name, rarity:r, manaCost:10, baseMultiplier:2.0, type:type };
      }
    }
    return defs;
  }
  var CARD_DEFS = buildCardDefs();

  // ====== 일일 보스 ======
  var DAILY_BOSSES = [
    { element:'water', name:'인조마신' },
    { element:'fire', name:'저주의 여신 아이리스' },
    { element:'nature', name:'고대신 파라오' },
    { element:'dark', name:'마신' },
    { element:'light', name:'사랑의 여신 아이리스' }
  ];
  function todayBoss(){
    var key = tokyoDateKey();
    var dayNum = dayNumberFromDateKey(key);
    var idx = ((dayNum%5)+5)%5;
    var b = DAILY_BOSSES[idx];
    return { element:b.element, name:b.name, dateKey:key, idx:idx };
  }

  // ====== 공용 유틸 ======
  function weightedPick(map){
    var total = 0;
    for(var k in map){ if(map.hasOwnProperty(k)) total += map[k]; }
    var r = Math.random()*total;
    for(var k2 in map){
      if(!map.hasOwnProperty(k2)) continue;
      r -= map[k2];
      if(r<=0) return k2;
    }
    // fallback
    for(var k3 in map){ if(map.hasOwnProperty(k3)) return k3; }
    return 'normal';
  }

  function xpNeedForLevel(level){
    return Math.floor(100*Math.pow(1.10, level-1) + 25*level*level);
  }
  function xpPerHour(state){
    return ECON.baseXpPerHour * Math.pow(ECON.upgradeEffectGrowth, state.upgrades.xpRateLevel);
  }
  function goldPerHour(state){
    return ECON.baseGoldPerHour * Math.pow(ECON.upgradeEffectGrowth, state.upgrades.goldRateLevel);
  }
  function upgradeCost(base, level){
    return Math.floor(base * Math.pow(ECON.upgradeCostGrowth, level));
  }

  function gachaLevelFromDraws(draws){
    var level = 1;
    var t = 200;
    while(draws >= t){
      level += 1;
      t *= 2;
    }
    return level;
  }

  function rarityChancesForLevel(level){
    if(level===1) return { normal:0.90, rare:0.095, epic:0.005, legend:0.0 };
    if(level===2) return { normal:0.85, rare:0.14,  epic:0.01,  legend:0.0 };
    if(level===3) return { normal:0.80, rare:0.18,  epic:0.02,  legend:0.0 };
    if(level===4) return { normal:0.75, rare:0.22,  epic:0.025, legend:0.005 };

    var extra = level-4;
    var legend = Math.min(0.005 + 0.002*extra, 0.06);
    var epic   = Math.min(0.025 + 0.006*extra, 0.25);
    var rare   = Math.min(0.22  + 0.02*extra,  0.70);
    var normal = 1 - (legend+epic+rare);
    if(normal < 0.05){
      normal = 0.05;
      var totalOther = legend+epic+rare;
      var scale = (1-normal)/totalOther;
      legend *= scale; epic *= scale; rare *= scale;
    }
    var sum = normal+rare+epic+legend;
    return { normal:normal/sum, rare:rare/sum, epic:epic/sum, legend:legend/sum };
  }

  function enhanceSuccessChance(curEnh){
    return Math.pow(0.95, curEnh+1);
  }
  function enhanceMultiplier(enh){
    return 1 + 0.05*enh;
  }

  function elementDamageMultiplier(attElem, defElem){
    if(!attElem || !defElem) return 1.0;
    if(ADVANTAGE_TO[attElem] === defElem) return 1.5;
    if(ADVANTAGE_TO[defElem] === attElem) return 0.5;
    return 1.0;
  }
  function mitigatedDamage(raw, defense){
    var factor = DEF_COEFF / (DEF_COEFF + Math.max(0, defense));
    return raw * factor;
  }

  // ====== 장비 풀 생성 ======
  function getCharDef(charId){
    for(var i=0;i<CHAR_DEFS.length;i++){
      if(CHAR_DEFS[i].id===charId) return CHAR_DEFS[i];
    }
    return null;
  }

  function buildWeaponPoolForChar(cd){
    var prefixes = {
      normal:['훈련용','여행자의','낡은'],
      rare:['정예','푸른','강화된'],
      epic:['영혼의','마력의','비전의'],
      legend:['신화의','왕의','멸망의']
    };
    var totalPower = { normal:30, rare:50, epic:75, legend:95 };
    var pool = [];
    for(var ri=0;ri<RARITY_ORDER.length;ri++){
      var r = RARITY_ORDER[ri];
      for(var i=0;i<3;i++){
        var name = prefixes[r][i] + ' ' + cd.weaponType;
        var id = cd.id + '_w_' + r + '_' + i;
        var phys = Math.round(totalPower[r]*cd.physBias);
        var mag  = Math.round(totalPower[r]*cd.magBias);
        pool.push({ id:id, name:name, rarity:r, physAtk:phys, magAtk:mag });
      }
    }
    return pool;
  }

  function buildArmorPoolForChar(cd){
    var prefixes = {
      normal:['천','초보자','낡은'],
      rare:['정예','강화','수호자'],
      epic:['성스러운','비전','자연의'],
      legend:['신화','왕가','멸망의']
    };
    var baseDef = { normal:28, rare:45, epic:70, legend:90 };
    var baseHp  = { normal:45, rare:75, epic:115, legend:155 };
    var offenseFactor = clamp(1.25 - cd.defBias, 0, 0.6);
    var baseOff = { normal:2, rare:4, epic:7, legend:10 };

    var pool = [];
    for(var ri=0;ri<RARITY_ORDER.length;ri++){
      var r = RARITY_ORDER[ri];
      for(var i=0;i<3;i++){
        var name = prefixes[r][i] + ' 방어구';
        var id = cd.id + '_a_' + r + '_' + i;
        var def = Math.round(baseDef[r]*cd.defBias);
        var mdef = Math.round(baseDef[r]*(0.85*cd.defBias + 0.25));
        var hp = Math.round(baseHp[r]*cd.defBias);

        var offTotal = Math.round(baseOff[r]*offenseFactor);
        var bonusAtk = Math.round(offTotal*cd.physBias);
        var bonusMatk = Math.round(offTotal*cd.magBias);

        pool.push({ id:id, name:name, rarity:r, def:def, mdef:mdef, hp:hp, bonusAtk:bonusAtk, bonusMatk:bonusMatk });
      }
    }
    return pool;
  }

  var WEAPON_POOLS = {};
  var ARMOR_POOLS = {};
  for(var ci=0;ci<CHAR_DEFS.length;ci++){
    var cd = CHAR_DEFS[ci];
    WEAPON_POOLS[cd.id] = buildWeaponPoolForChar(cd);
    ARMOR_POOLS[cd.id] = buildArmorPoolForChar(cd);
  }

  function findWeaponDef(charId, itemId){
    var pool = WEAPON_POOLS[charId] || [];
    for(var i=0;i<pool.length;i++) if(pool[i].id===itemId) return pool[i];
    return null;
  }
  function findArmorDef(charId, itemId){
    var pool = ARMOR_POOLS[charId] || [];
    for(var i=0;i<pool.length;i++) if(pool[i].id===itemId) return pool[i];
    return null;
  }

  function effectiveWeaponStats(wd, enh){
    var mul = enhanceMultiplier(enh);
    return { physAtk:Math.round(wd.physAtk*mul), magAtk:Math.round(wd.magAtk*mul), mul:mul };
  }
  function effectiveArmorStats(ad, enh){
    var mul = enhanceMultiplier(enh);
    return {
      def:Math.round(ad.def*mul),
      mdef:Math.round(ad.mdef*mul),
      hp:Math.round(ad.hp*mul),
      bonusAtk:Math.round((ad.bonusAtk||0)*mul),
      bonusMatk:Math.round((ad.bonusMatk||0)*mul),
      mul:mul
    };
  }

  // ====== 승급 보너스 ======
  function tierBonusMultiplier(state){
    return 1 + 0.20*state.ascension.tierIndex;
  }

  function computeCharacterFinalStats(state, charId){
    var cd = getCharDef(charId);
    var c = state.characters[charId];
    var lv = c.level;

    var hp = BASE_STATS.hp + (lv-1)*5;
    var mp = BASE_STATS.mp;
    var atk = BASE_STATS.atk + (lv-1)*1;
    var matk = BASE_STATS.matk + (lv-1)*1;
    var def = BASE_STATS.def;
    var mdef = BASE_STATS.mdef;

    if(c.weapon.equippedId){
      var wd = findWeaponDef(charId, c.weapon.equippedId);
      var ow = c.weapon.inv[c.weapon.equippedId];
      if(wd && ow){
        var effW = effectiveWeaponStats(wd, ow.enhance);
        atk += effW.physAtk;
        matk += effW.magAtk;
      }
    }
    if(c.armor.equippedId){
      var ad = findArmorDef(charId, c.armor.equippedId);
      var oa = c.armor.inv[c.armor.equippedId];
      if(ad && oa){
        var effA = effectiveArmorStats(ad, oa.enhance);
        hp += effA.hp;
        def += effA.def;
        mdef += effA.mdef;
        atk += effA.bonusAtk;
        matk += effA.bonusMatk;
      }
    }

    var tMul = tierBonusMultiplier(state);
    hp = Math.round(hp*tMul);
    atk = Math.round(atk*tMul);
    matk = Math.round(matk*tMul);

    return {
      name: cd.name,
      element: cd.element,
      physBias: cd.physBias,
      magBias: cd.magBias,
      hpMax: hp,
      mpMax: mp,
      atk: atk,
      matk: matk,
      def: def,
      mdef: mdef
    };
  }

  // ====== 상태 저장/로드 ======
  function nowMs(){ return Date.now(); }

  function createNewState(){
    var chars = {};
    for(var i=0;i<CHAR_DEFS.length;i++){
      var id = CHAR_DEFS[i].id;
      chars[id] = {
        level: 1,
        xpInLevel: 0,
        weapon: { equippedId:null, inv:{} },
        armor:  { equippedId:null, inv:{} },
        weaponDraws: 0,
        armorDraws: 0
      };
    }

    // 스타터 카드 5장 + 덱 세팅
    var starter = ["마시멜로","슬라임","미이라","코볼트","잭오랜턴"];
    var inv = {};
    for(var s=0;s<starter.length;s++){
      inv[starter[s]] = { enhance:0 };
    }

    return {
      createdAt: nowMs(),
      lastSavedAt: nowMs(),
      lastTickAt: nowMs(),

      selectedCharId: 'zeek',
      ui: { currentTab:'home', lastGachaLog:'' },

      resources: {
        gold: 1000,
        xp: 500,
        gems: 30 // 시작 보석(초반 막힘 방지)
      },

      upgrades: { xpRateLevel:0, goldRateLevel:0 },

      characters: chars,

      cards: {
        totalDraws: 0,
        inv: inv,
        deck: [starter[0],starter[1],starter[2],starter[3],starter[4]],
        lastLog: ''
      },

      daily: { lastAttemptDateKey:null, lastResult:null },
      ascension: { tierIndex:0, progressWins:0, lastAttemptDateKey:null, lastResult:null },

      assets: { charImages: { zeek:null, lumi:null, queen:null, jasmine:null, luna:null } },

      lastOffline: null
    };
  }

  function loadState(){
    if(!storageOK) return createNewState();
    try{
      var raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return createNewState();
      var parsed = JSON.parse(raw);
      if(!parsed || !parsed.characters) return createNewState();
      // assets 누락 시 보정
      if(!parsed.assets) parsed.assets = { charImages:{ zeek:null, lumi:null, queen:null, jasmine:null, luna:null } };
      if(!parsed.assets.charImages) parsed.assets.charImages = { zeek:null, lumi:null, queen:null, jasmine:null, luna:null };
      return parsed;
    }catch(e){
      return createNewState();
    }
  }

  function saveState(state){
    if(!storageOK) return false;
    try{
      state.lastSavedAt = nowMs();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    }catch(e){
      return false;
    }
  }

  var state = loadState();
  window.__STATE = state; // 이미지 fallback 등에서 참조

  // ====== 오프라인 누적 ======
  function applyOfflineProgress(){
    var now = nowMs();
    var last = state.lastSavedAt || now;
    var elapsedSec = clamp((now-last)/1000, 0, OFFLINE_CAP_SECONDS);
    if(elapsedSec >= 5){
      var xpg = xpPerHour(state) * (elapsedSec/3600);
      var gg = goldPerHour(state) * (elapsedSec/3600);
      state.resources.xp += xpg;
      state.resources.gold += gg;
      state.lastOffline = { elapsedSec:elapsedSec, xpGain:xpg, goldGain:gg, at:tokyoDateKey() };
      toast('오프라인 보상', Math.floor(elapsedSec/60)+'분 · XP+'+fmt(xpg)+' 골드+'+fmt(gg));
    }
  }
  applyOfflineProgress();
  saveState(state);

  // ====== 이미지 로딩 대응 ======
  function resolveUrl(path){
    try{
      return (new URL(path, window.location.href)).href;
    }catch(e){
      return path;
    }
  }
  function getCharImgCandidates(charId){
    return [
      resolveUrl(charId+'.png'),
      resolveUrl(charId+'.PNG'),
      resolveUrl('images/'+charId+'.png'),
      resolveUrl('images/'+charId+'.PNG'),
      resolveUrl('img/'+charId+'.png'),
      resolveUrl('img/'+charId+'.PNG')
    ];
  }
  function getCharImageSrc(charId){
    var stored = state.assets && state.assets.charImages ? state.assets.charImages[charId] : null;
    if(stored) return stored;
    return getCharImgCandidates(charId)[0];
  }

  // ====== UI 렌더 ======
  var mainEl = document.getElementById('main');
  var resEl = document.getElementById('resourceBar');
  var tabBtns = document.querySelectorAll('.tab-btn');

  function renderResourceBar(){
    var xph = xpPerHour(state);
    var gph = goldPerHour(state);
    var tierName = TIER_NAMES[state.ascension.tierIndex] || '—';
    var tMul = tierBonusMultiplier(state);

    resEl.innerHTML =
      '<div class="res-pill">골드 <strong>'+fmt(state.resources.gold)+'</strong></div>'+
      '<div class="res-pill">XP풀 <strong>'+fmt(state.resources.xp)+'</strong></div>'+
      '<div class="res-pill">보석 <strong>'+fmt(state.resources.gems)+'</strong></div>'+
      '<div class="res-pill">XP/시간 <strong>'+fmt(xph)+'</strong></div>'+
      '<div class="res-pill">골드/시간 <strong>'+fmt(gph)+'</strong></div>'+
      '<div class="res-pill">승급 <strong>'+escapeHtml(tierName)+'</strong> <span class="small">(x'+tMul.toFixed(2)+')</span></div>';
  }

  function setTab(tab){
    // 탭 이동 시 전투가 진행 중이면 안전하게 종료(렌더 대상 DOM이 사라지는 문제 방지)
    if(battle && battle.inProgress){
      stopBattle('탭 이동');
    }
    state.ui.currentTab = tab;
    render();
    window.scrollTo(0,0);
  }

  for(var i=0;i<tabBtns.length;i++){
    (function(btn){
      bindTap(btn, function(){
        setTab(btn.getAttribute('data-tab'));
      });
    })(tabBtns[i]);
  }

  function updateTabActive(){
    for(var i=0;i<tabBtns.length;i++){
      var t = tabBtns[i].getAttribute('data-tab');
      if(t === state.ui.currentTab) tabBtns[i].classList.add('active');
      else tabBtns[i].classList.remove('active');
    }
  }

  function rarityPill(r){
    return '<span class="rarity-pill"><span class="dot '+r+'"></span>'+RARITY_LABEL[r]+'</span>';
  }

  function render(){
    var scrollY = window.scrollY;
    updateTabActive();
    renderResourceBar();

    try{
      var tab = state.ui.currentTab;
      if(tab==='home') renderHome();
      else if(tab==='characters') renderCharacters();
      else if(tab==='upgrades') renderUpgrades();
      else if(tab==='equipment') renderEquipment();
      else if(tab==='daily') renderDaily();
      else if(tab==='cards') renderCards();
      else if(tab==='ascension') renderAscension();
      else renderSettings();
    }catch(e){
      showModal('렌더 오류', (e && (e.stack||e.message)) ? (e.stack||e.message) : String(e),
        [{text:'설정으로', kind:'warn', value:'settings'}, {text:'닫기', kind:'good', value:'close'}],
        function(v){ if(v==='settings'){ state.ui.currentTab='settings'; render(); } }
      );
    }
    window.scrollTo(0, scrollY);
  }

  // ====== 홈 ======
  function renderHome(){
    var cd = getCharDef(state.selectedCharId);
    var c = state.characters[cd.id];
    var st = computeCharacterFinalStats(state, cd.id);
    var need = xpNeedForLevel(c.level);

    var btns = '';
    for(var i=0;i<CHAR_DEFS.length;i++){
      var x = CHAR_DEFS[i];
      var active = (x.id===state.selectedCharId) ? ' good' : '';
      btns += '<button class="btn'+active+'" data-select="'+x.id+'">'+ELEMENT[x.element].emoji+' '+x.name+'</button>';
    }

    var offHtml = '';
    if(state.lastOffline){
      var o = state.lastOffline;
      offHtml =
        '<div class="panel"><h2>오프라인 누적</h2>'+
        '<div class="note">누적: <b>'+Math.floor(o.elapsedSec/3600)+'h '+Math.floor((o.elapsedSec%3600)/60)+'m</b><br/>'+
        '획득: XP <b>+'+fmt(o.xpGain)+'</b>, 골드 <b>+'+fmt(o.goldGain)+'</b><br/>(최대 30시간)</div></div>';
    }

    mainEl.innerHTML =
      '<div class="grid">'+
        '<div class="panel" style="grid-column: span 7;">'+
          '<h2>메인 캐릭터</h2>'+
          '<div class="row" style="gap:14px; align-items:flex-start;">'+
            '<div>'+
              '<img class="avatar big" data-charimg="'+cd.id+'" data-try="0" src="'+getCharImageSrc(cd.id)+'" onerror="window.__imgFallback && window.__imgFallback(this)" alt="'+escapeHtml(cd.name)+'" />'+
              '<div class="hint">자동 로드가 안 되면 설정 탭에서 이미지 파일을 직접 선택해 등록하세요.</div>'+
            '</div>'+
            '<div style="flex:1;">'+
              '<div class="char-name">'+ELEMENT[cd.element].emoji+' '+ELEMENT[cd.element].label+'속성 '+cd.name+' (Lv.'+c.level+')</div>'+
              '<div class="small">개별 XP바 (공용 XP풀로 성장)</div>'+
              '<div class="progress" style="margin:8px 0 6px;"><div style="width:'+((c.xpInLevel/need)*100).toFixed(2)+'%"></div></div>'+
              '<div class="small">XP: '+fmt(c.xpInLevel)+' / '+fmt(need)+' · 레벨업당: 체력+5, 공격+1, 마공+1</div>'+
              '<hr class="sep"/>'+
              '<div class="kv">'+
                '<span>HP <strong>'+fmt(st.hpMax)+'</strong></span>'+
                '<span>MP <strong>'+fmt(st.mpMax)+'</strong></span>'+
                '<span>공격 <strong>'+fmt(st.atk)+'</strong></span>'+
                '<span>마공 <strong>'+fmt(st.matk)+'</strong></span>'+
                '<span>방어 <strong>'+fmt(st.def)+'</strong></span>'+
                '<span>마방 <strong>'+fmt(st.mdef)+'</strong></span>'+
              '</div>'+
              '<div class="hint">공격 성향: 물리 '+Math.round(cd.physBias*100)+'% / 마법 '+Math.round(cd.magBias*100)+'%</div>'+
              '<hr class="sep"/>'+
              '<div class="row">'+btns+'</div>'+
            '</div>'+
          '</div>'+
        '</div>'+

        '<div class="panel" style="grid-column: span 5;">'+
          '<h2>초기 진행 안내</h2>'+
          '<div class="note">'+
            '- 시작 보석이 조금 있고, 기본 카드 5장이 덱에 들어있습니다.<br/>'+
            '- 일일도전(하루 1회) 승리 시 보석을 더 얻습니다.<br/>'+
            '- 장비/카드가 없어도 전투는 기본공격으로 진행됩니다.<br/>'+
            (storageOK ? '' : '<br/><b style="color:#ffcc66;">주의: 이 WebView는 LocalStorage 저장이 막혀있어 진행 저장이 안 될 수 있습니다.</b>')+
          '</div>'+
        '</div>'+

        '<div style="grid-column: span 12;">'+offHtml+'</div>'+
      '</div>';

    // 이벤트
    var selects = mainEl.querySelectorAll('[data-select]');
    for(var j=0;j<selects.length;j++){
      (function(btn){
        bindTap(btn, function(){
          state.selectedCharId = btn.getAttribute('data-select');
          saveState(state);
          render();
        });
      })(selects[j]);
    }
  }

  // ====== 캐릭터 성장 ======
  function levelUpOnce(charId){
    var c = state.characters[charId];
    var need = xpNeedForLevel(c.level);
    var missing = need - c.xpInLevel;
    if(missing<=0) return false;
    if(state.resources.xp<=0) return false;

    var spend = Math.min(missing, state.resources.xp);
    state.resources.xp -= spend;
    c.xpInLevel += spend;

    if(c.xpInLevel >= need){
      c.level += 1;
      c.xpInLevel = c.xpInLevel - need;
      return true;
    }
    return false;
  }
  function levelUpMax(charId){
    var leveled = 0;
    for(var i=0;i<9999;i++){
      var before = state.characters[charId].level;
      var ok = levelUpOnce(charId);
      var after = state.characters[charId].level;
      if(!ok) break;
      if(after>before) leveled += 1;
      if(state.resources.xp<=0) break;
    }
    return leveled;
  }

  function renderCharacters(){
    var xpPool = state.resources.xp;
    var html = '';

    for(var i=0;i<CHAR_DEFS.length;i++){
      var cd = CHAR_DEFS[i];
      var c = state.characters[cd.id];
      var need = xpNeedForLevel(c.level);
      var st = computeCharacterFinalStats(state, cd.id);

      html +=
        '<div class="char-card">'+
          '<div>'+
            '<img class="avatar" data-charimg="'+cd.id+'" data-try="0" src="'+getCharImageSrc(cd.id)+'" onerror="window.__imgFallback && window.__imgFallback(this)" alt="'+escapeHtml(cd.name)+'"/>'+
            '<div class="small" style="margin-top:6px;">'+ELEMENT[cd.element].emoji+' '+ELEMENT[cd.element].label+'</div>'+
          '</div>'+
          '<div>'+
            '<div class="char-name">'+cd.name+' <span class="small">(Lv.'+c.level+')</span></div>'+
            '<div class="progress"><div style="width:'+((c.xpInLevel/need)*100).toFixed(2)+'%"></div></div>'+
            '<div class="small" style="margin-top:6px;">XP '+fmt(c.xpInLevel)+' / '+fmt(need)+'</div>'+
            '<div class="kv" style="margin-top:8px;">'+
              '<span>HP <strong>'+fmt(st.hpMax)+'</strong></span>'+
              '<span>공격 <strong>'+fmt(st.atk)+'</strong></span>'+
              '<span>마공 <strong>'+fmt(st.matk)+'</strong></span>'+
              '<span>방어 <strong>'+fmt(st.def)+'</strong></span>'+
              '<span>마방 <strong>'+fmt(st.mdef)+'</strong></span>'+
            '</div>'+
          '</div>'+
          '<div class="actions">'+
            '<button class="btn good" data-lv1="'+cd.id+'">레벨 +1</button>'+
            '<button class="btn warn" data-lvmax="'+cd.id+'">최대 레벨업</button>'+
            '<button class="btn" data-setmain="'+cd.id+'">메인 표시</button>'+
          '</div>'+
        '</div>';
    }

    mainEl.innerHTML =
      '<div class="grid">'+
        '<div class="panel" style="grid-column: span 12;">'+
          '<div class="row space">'+
            '<h2 style="margin:0;">캐릭터 성장</h2>'+
            '<div class="small">공용 XP풀: <b>'+fmt(xpPool)+'</b></div>'+
          '</div>'+
          '<div class="hint">레벨업당: 체력+5, 공격+1, 마공+1 · 방어계수 '+DEF_COEFF+'</div>'+
        '</div>'+
        '<div class="panel" style="grid-column: span 12;">'+
          '<div class="list" style="max-height: 460px;">'+html+'</div>'+
        '</div>'+
      '</div>';

    var lv1s = mainEl.querySelectorAll('[data-lv1]');
    for(var j=0;j<lv1s.length;j++){
      (function(btn){
        bindTap(btn, function(){
          var id = btn.getAttribute('data-lv1');
          var before = state.characters[id].level;
          levelUpOnce(id);
          var after = state.characters[id].level;
          saveState(state);
          if(after>before) toast('레벨업!', getCharDef(id).name+' Lv.'+before+' → Lv.'+after);
          render();
        });
      })(lv1s[j]);
    }

    var lvmaxs = mainEl.querySelectorAll('[data-lvmax]');
    for(var k=0;k<lvmaxs.length;k++){
      (function(btn){
        bindTap(btn, function(){
          var id = btn.getAttribute('data-lvmax');
          var before = state.characters[id].level;
          var up = levelUpMax(id);
          var after = state.characters[id].level;
          saveState(state);
          toast('최대 레벨업', getCharDef(id).name+': +'+up+'레벨 (Lv.'+before+' → Lv.'+after+')');
          render();
        });
      })(lvmaxs[k]);
    }

    var setm = mainEl.querySelectorAll('[data-setmain]');
    for(var t=0;t<setm.length;t++){
      (function(btn){
        bindTap(btn, function(){
          state.selectedCharId = btn.getAttribute('data-setmain');
          saveState(state);
          render();
        });
      })(setm[t]);
    }
  }

  // ====== 업그레이드 ======
  function renderUpgrades(){
    var xLv = state.upgrades.xpRateLevel;
    var gLv = state.upgrades.goldRateLevel;
    var xph = xpPerHour(state);
    var gph = goldPerHour(state);

    var xCost = upgradeCost(ECON.xpUpgradeBaseCost, xLv);
    var gCost = upgradeCost(ECON.goldUpgradeBaseCost, gLv);

    mainEl.innerHTML =
      '<div class="grid">'+
        '<div class="panel" style="grid-column: span 7;">'+
          '<h2>방치 수익 업그레이드</h2>'+
          '<div class="note">오프라인 누적 최대 30시간</div>'+
          '<hr class="sep"/>'+

          '<div class="panel" style="background: rgba(255,255,255,0.02);">'+
            '<div class="row space">'+
              '<div>'+
                '<div class="char-name">시간당 경험치</div>'+
                '<div class="small">현재: <b>'+fmt(xph)+'</b> XP/시간 · 레벨: <b>'+xLv+'</b></div>'+
                '<div class="hint">다음 레벨 효과: x'+ECON.upgradeEffectGrowth.toFixed(2)+'</div>'+
              '</div>'+
              '<div style="min-width:220px;">'+
                '<button id="buyXpUp" class="btn good" '+(state.resources.gold>=xCost?'':'disabled')+'>구매 ('+fmt(xCost)+' 골드)</button>'+
              '</div>'+
            '</div>'+
          '</div>'+

          '<div class="panel" style="background: rgba(255,255,255,0.02); margin-top:10px;">'+
            '<div class="row space">'+
              '<div>'+
                '<div class="char-name">시간당 골드</div>'+
                '<div class="small">현재: <b>'+fmt(gph)+'</b> 골드/시간 · 레벨: <b>'+gLv+'</b></div>'+
                '<div class="hint">다음 레벨 효과: x'+ECON.upgradeEffectGrowth.toFixed(2)+'</div>'+
              '</div>'+
              '<div style="min-width:220px;">'+
                '<button id="buyGoldUp" class="btn good" '+(state.resources.gold>=gCost?'':'disabled')+'>구매 ('+fmt(gCost)+' 골드)</button>'+
              '</div>'+
            '</div>'+
          '</div>'+

        '</div>'+

        '<div class="panel" style="grid-column: span 5;">'+
          '<h2>공식</h2>'+
          '<div class="note">'+
            'XP필요 = floor(100*1.10^(lv-1) + 25*lv^2)\n\n'+
            'XP/시간 = baseXP * 1.25^(xp업글레벨)\n'+
            '골드/시간 = baseGold * 1.25^(gold업글레벨)\n\n'+
            '업글비용 = baseCost * 1.45^(현재레벨)'+
          '</div>'+
        '</div>'+
      '</div>';

    var buyXp = document.getElementById('buyXpUp');
    var buyG = document.getElementById('buyGoldUp');

    bindTap(buyXp, function(){
      var cost = upgradeCost(ECON.xpUpgradeBaseCost, state.upgrades.xpRateLevel);
      if(state.resources.gold < cost) return;
      state.resources.gold -= cost;
      state.upgrades.xpRateLevel += 1;
      saveState(state);
      toast('업그레이드 완료', '시간당 XP 레벨 '+state.upgrades.xpRateLevel);
      render();
    });

    bindTap(buyG, function(){
      var cost = upgradeCost(ECON.goldUpgradeBaseCost, state.upgrades.goldRateLevel);
      if(state.resources.gold < cost) return;
      state.resources.gold -= cost;
      state.upgrades.goldRateLevel += 1;
      saveState(state);
      toast('업그레이드 완료', '시간당 골드 레벨 '+state.upgrades.goldRateLevel);
      render();
    });
  }

  // ====== 장비 (뽑기+장착) ======
  function buildEquipOptions(charId, kind){
    var c = state.characters[charId];
    var inv = (kind==='weapon') ? c.weapon.inv : c.armor.inv;
    var pool = (kind==='weapon') ? WEAPON_POOLS[charId] : ARMOR_POOLS[charId];

    var owned = [];
    for(var id in inv){
      if(!inv.hasOwnProperty(id)) continue;
      for(var i=0;i<pool.length;i++){
        if(pool[i].id===id){
          owned.push({ def:pool[i], enh:inv[id].enhance });
          break;
        }
      }
    }
    owned.sort(function(a,b){
      var ra = RARITY_ORDER.indexOf(a.def.rarity);
      var rb = RARITY_ORDER.indexOf(b.def.rarity);
      if(ra!==rb) return rb-ra;
      return (b.enh - a.enh);
    });

    var opts = '<option value="">(없음)</option>';
    for(var j=0;j<owned.length;j++){
      var it = owned[j];
      if(kind==='weapon'){
        var effW = effectiveWeaponStats(it.def, it.enh);
        opts += '<option value="'+it.def.id+'">['+RARITY_LABEL[it.def.rarity]+'] '+escapeHtml(it.def.name)+' (+'+it.enh+') · 물공 '+effW.physAtk+', 마공 '+effW.magAtk+'</option>';
      }else{
        var effA = effectiveArmorStats(it.def, it.enh);
        opts += '<option value="'+it.def.id+'">['+RARITY_LABEL[it.def.rarity]+'] '+escapeHtml(it.def.name)+' (+'+it.enh+') · 방어 '+effA.def+', 마방 '+effA.mdef+', HP '+effA.hp+'</option>';
      }
    }
    return opts;
  }

  function doEquipGacha(charId, kind, count){
    var c = state.characters[charId];
    var isWeapon = (kind==='weapon');
    var pool = isWeapon ? WEAPON_POOLS[charId] : ARMOR_POOLS[charId];

    var cost = 0;
    if(isWeapon) cost = (count===10) ? ECON.weapon10Cost : ECON.weapon100Cost;
    else cost = (count===10) ? ECON.armor10Cost : ECON.armor100Cost;

    if(state.resources.gold < cost){
      toast('골드 부족', '필요 '+fmt(cost)+' / 보유 '+fmt(state.resources.gold));
      return;
    }
    state.resources.gold -= cost;

    var beforeDraws = isWeapon ? c.weaponDraws : c.armorDraws;
    var results = [];
    var countByR = { normal:0, rare:0, epic:0, legend:0 };
    var dupCount = 0, enhOk = 0;

    for(var i=0;i<count;i++){
      if(isWeapon) c.weaponDraws += 1;
      else c.armorDraws += 1;

      var draws = isWeapon ? c.weaponDraws : c.armorDraws;
      var lv = gachaLevelFromDraws(draws);
      var ch = rarityChancesForLevel(lv);
      var rarity = weightedPick(ch);

      // 후보 3개 중 랜덤
      var candidates = [];
      for(var k=0;k<pool.length;k++) if(pool[k].rarity===rarity) candidates.push(pool[k]);
      var picked = candidates[Math.floor(Math.random()*candidates.length)];

      countByR[rarity] += 1;

      if(isWeapon){
        var invW = c.weapon.inv;
        if(invW[picked.id]){
          dupCount++;
          var cur = invW[picked.id].enhance;
          var p = enhanceSuccessChance(cur);
          var ok = Math.random() < p;
          if(ok){ invW[picked.id].enhance += 1; enhOk++; }
          results.push({type:'dup', rarity:rarity, name:picked.name, before:cur, after:invW[picked.id].enhance, chance:p, success:ok});
        }else{
          invW[picked.id] = { enhance:0 };
          results.push({type:'new', rarity:rarity, name:picked.name, enhance:0});
        }
      }else{
        var invA = c.armor.inv;
        if(invA[picked.id]){
          dupCount++;
          var cur2 = invA[picked.id].enhance;
          var p2 = enhanceSuccessChance(cur2);
          var ok2 = Math.random() < p2;
          if(ok2){ invA[picked.id].enhance += 1; enhOk++; }
          results.push({type:'dup', rarity:rarity, name:picked.name, before:cur2, after:invA[picked.id].enhance, chance:p2, success:ok2});
        }else{
          invA[picked.id] = { enhance:0 };
          results.push({type:'new', rarity:rarity, name:picked.name, enhance:0});
        }
      }
    }

    var afterDraws = isWeapon ? c.weaponDraws : c.armorDraws;
    var beforeLv = gachaLevelFromDraws(beforeDraws);
    var afterLv = gachaLevelFromDraws(afterDraws);

    var log = '';
    log += '== '+getCharDef(charId).name+' '+(isWeapon?'무기':'방어구')+' '+count+'회 뽑기 ==\n';
    log += '비용: '+fmt(cost)+' 골드\n';
    log += '획득: 일반 '+countByR.normal+', 레어 '+countByR.rare+', 에픽 '+countByR.epic+', 전설 '+countByR.legend+'\n';
    if(dupCount>0) log += '중복: '+dupCount+'회 (강화 성공 '+enhOk+'회)\n';
    if(afterLv>beforeLv) log += '뽑기 레벨 상승! Lv.'+beforeLv+' → Lv.'+afterLv+'\n';
    log += '\n[상세]\n';
    var limit = Math.min(results.length, 80);
    for(var r=0;r<limit;r++){
      var it = results[r];
      if(it.type==='new'){
        log += '+ ('+RARITY_LABEL[it.rarity]+') '+it.name+' (+0)\n';
      }else{
        log += '= ('+RARITY_LABEL[it.rarity]+') '+it.name+' 중복 → 강화 '+(it.success?'성공':'실패')+
          ' ('+it.before+' → '+it.after+', 확률 '+pct(it.chance)+')\n';
      }
    }
    if(results.length>80) log += '... (상세 '+(results.length-80)+'개 생략)\n';

    state.ui.lastGachaLog = log;
    saveState(state);

    // 팝업 생성
    var summary = '<div class="list" style="max-height:300px;">';
    for(var r=0;r<results.length;r++){
      var it = results[r];
      var colorClass = it.rarity; // normal, rare, epic, legend
      // Reuse dot style
      var dot = '<span class="dot '+colorClass+'"></span>';

      if(it.type === 'new'){
        summary += '<div class="item" style="padding:6px;"><div class="top"><div class="name" style="font-size:13px;">'+dot+' '+(isWeapon?'[무기] ':'[방어구] ')+escapeHtml(it.name)+' <span style="color:#4dff8a;">NEW!</span> (+0)</div></div></div>';
      } else {
        var diff = '<span style="color:#aeb6e9;">'+it.before+'</span> → <span style="color:'+(it.success?'#4dff8a':'#ffcc66')+';">'+it.after+'</span>';
        var msg = it.success ? '강화 성공' : '강화 실패';
        summary += '<div class="item" style="padding:6px;"><div class="top"><div class="name" style="font-size:13px;">'+dot+' '+(isWeapon?'[무기] ':'[방어구] ')+escapeHtml(it.name)+'</div><div class="meta">'+diff+' ('+msg+')</div></div></div>';
      }
    }
    summary += '</div>';

    if(afterLv > beforeLv){
      summary = '<div class="panel" style="margin-bottom:8px;background:rgba(77,255,138,0.1);border-color:#4dff8a;"><h3>🎉 뽑기 레벨 상승! Lv.'+beforeLv+' → Lv.'+afterLv+'</h3></div>' + summary;
    }

    showModal((isWeapon?'무기':'방어구')+' 뽑기 결과', summary, [{text:'확인', kind:'good', value:'ok'}], null);
    // toast('뽑기 완료', (isWeapon?'무기':'방어구')+' 결과 갱신됨'); // Modal replaces toast
  }

  function renderEquipment(){
    var charId = state.selectedCharId;
    var cd = getCharDef(charId);
    var c = state.characters[charId];

    var wLv = gachaLevelFromDraws(c.weaponDraws);
    var aLv = gachaLevelFromDraws(c.armorDraws);
    var wCh = rarityChancesForLevel(wLv);
    var aCh = rarityChancesForLevel(aLv);

    var charOpts = '';
    for(var i=0;i<CHAR_DEFS.length;i++){
      var x = CHAR_DEFS[i];
      charOpts += '<option value="'+x.id+'" '+(x.id===charId?'selected':'')+'>'+ELEMENT[x.element].emoji+' '+x.name+'</option>';
    }

    mainEl.innerHTML =
      '<div class="grid">'+
        '<div class="panel" style="grid-column: span 12;">'+
          '<div class="row space">'+
            '<h2 style="margin:0;">장비</h2>'+
            '<div class="row">'+
              '<div class="small">대상 캐릭터</div>'+
              '<select id="equipCharSel" class="select" style="width:220px;">'+charOpts+'</select>'+
            '</div>'+
          '</div>'+
          '<div class="hint">무기/방어구는 캐릭터별 뽑기 레벨이 따로 존재합니다.</div>'+
        '</div>'+

        '<div class="panel" style="grid-column: span 6;">'+
          '<h2>무기 뽑기 ('+cd.name+')</h2>'+
          '<div class="small">누적: <b>'+fmt(c.weaponDraws)+'</b> · 뽑기레벨: <b>Lv.'+wLv+'</b></div>'+
          '<div class="small">확률: 일반 '+pct(wCh.normal)+' / 레어 '+pct(wCh.rare)+' / 에픽 '+pct(wCh.epic)+' / 전설 '+pct(wCh.legend)+'</div>'+
          '<hr class="sep"/>'+
          '<div class="row">'+
            '<button id="w10" class="btn good">10회 ('+fmt(ECON.weapon10Cost)+'G)</button>'+
            '<button id="w100" class="btn warn">100회 ('+fmt(ECON.weapon100Cost)+'G)</button>'+
          '</div>'+
          '<hr class="sep"/>'+
          '<div class="row">'+
            '<div style="flex:1;">'+
              '<div class="small">장착 무기</div>'+
              '<select id="equipWeapon" class="select">'+buildEquipOptions(charId,'weapon')+'</select>'+
            '</div>'+
          '</div>'+
          '<div class="hint">중복 강화: 0.95^(강화+1), 강화당 +5%</div>'+
        '</div>'+

        '<div class="panel" style="grid-column: span 6;">'+
          '<h2>방어구 뽑기 ('+cd.name+')</h2>'+
          '<div class="small">누적: <b>'+fmt(c.armorDraws)+'</b> · 뽑기레벨: <b>Lv.'+aLv+'</b></div>'+
          '<div class="small">확률: 일반 '+pct(aCh.normal)+' / 레어 '+pct(aCh.rare)+' / 에픽 '+pct(aCh.epic)+' / 전설 '+pct(aCh.legend)+'</div>'+
          '<hr class="sep"/>'+
          '<div class="row">'+
            '<button id="a10" class="btn good">10회 ('+fmt(ECON.armor10Cost)+'G)</button>'+
            '<button id="a100" class="btn warn">100회 ('+fmt(ECON.armor100Cost)+'G)</button>'+
          '</div>'+
          '<hr class="sep"/>'+
          '<div class="row">'+
            '<div style="flex:1;">'+
              '<div class="small">장착 방어구</div>'+
              '<select id="equipArmor" class="select">'+buildEquipOptions(charId,'armor')+'</select>'+
            '</div>'+
          '</div>'+
          '<div class="hint">지크→루미→여왕→자스민→루나 순으로 방어 성향</div>'+
        '</div>'+

        '<div class="panel" style="grid-column: span 12;">'+
          '<h2>뽑기 결과</h2>'+
          '<div class="log">'+escapeHtml(state.ui.lastGachaLog || '아직 뽑기 결과가 없습니다.')+'</div>'+
        '</div>'+
      '</div>';

    var sel = document.getElementById('equipCharSel');
    sel.addEventListener('change', function(e){
      state.selectedCharId = e.target.value;
      saveState(state);
      render();
    });

    bindTap(document.getElementById('w10'), function(){ doEquipGacha(state.selectedCharId,'weapon',10); render(); });
    bindTap(document.getElementById('w100'), function(){ doEquipGacha(state.selectedCharId,'weapon',100); render(); });
    bindTap(document.getElementById('a10'), function(){ doEquipGacha(state.selectedCharId,'armor',10); render(); });
    bindTap(document.getElementById('a100'), function(){ doEquipGacha(state.selectedCharId,'armor',100); render(); });

    document.getElementById('equipWeapon').addEventListener('change', function(e){
      state.characters[state.selectedCharId].weapon.equippedId = e.target.value || null;
      saveState(state);
      toast('장착 변경','무기 변경됨');
      render();
    });
    document.getElementById('equipArmor').addEventListener('change', function(e){
      state.characters[state.selectedCharId].armor.equippedId = e.target.value || null;
      saveState(state);
      toast('장착 변경','방어구 변경됨');
      render();
    });
  }

  // ====== 카드 ======
  function cardMultiplier(cardName){
    var def = CARD_DEFS[cardName];
    if(!def) return 1.0;
    var enh = state.cards.inv[cardName] ? state.cards.inv[cardName].enhance : 0;
    return def.baseMultiplier * (1 + 0.05*enh);
  }

  function doCardGacha(count){
    var cost = (count===1)?ECON.card1Cost : (count===10)?ECON.card10Cost : ECON.card100Cost;
    if(state.resources.gems < cost){
      toast('보석 부족', '필요 '+fmt(cost)+' / 보유 '+fmt(state.resources.gems));
      return;
    }
    state.resources.gems -= cost;

    var results = [];
    var countByR = { normal:0, rare:0, epic:0, legend:0 };
    var dup = 0, enhOk = 0;

    for(var i=0;i<count;i++){
      state.cards.totalDraws += 1;
      var rarity = weightedPick(CARD_RARITY_WEIGHTS);
      var arr = CARD_POOLS[rarity];
      var name = arr[Math.floor(Math.random()*arr.length)];
      countByR[rarity] += 1;

      if(state.cards.inv[name]){
        dup++;
        var cur = state.cards.inv[name].enhance;
        var p = enhanceSuccessChance(cur);
        var ok = Math.random() < p;
        if(ok){ state.cards.inv[name].enhance += 1; enhOk++; }
        results.push({type:'dup', rarity:rarity, name:name, before:cur, after:state.cards.inv[name].enhance, chance:p, success:ok});
      }else{
        state.cards.inv[name] = { enhance:0 };
        results.push({type:'new', rarity:rarity, name:name, enhance:0});
      }
    }

    var log = '';
    log += '== 카드 '+count+'회 뽑기 ==\n';
    log += '비용: '+fmt(cost)+' 보석\n';
    log += '획득: 일반 '+countByR.normal+', 레어 '+countByR.rare+', 에픽 '+countByR.epic+', 전설 '+countByR.legend+'\n';
    if(dup>0) log += '중복: '+dup+'회 (강화 성공 '+enhOk+'회)\n';
    log += '\n[상세]\n';

    var limit = Math.min(results.length, 120);
    for(var r=0;r<limit;r++){
      var it = results[r];
      if(it.type==='new'){
        log += '+ ('+RARITY_LABEL[it.rarity]+') '+it.name+' (+0)\n';
      }else{
        log += '= ('+RARITY_LABEL[it.rarity]+') '+it.name+' 중복 → 강화 '+(it.success?'성공':'실패')+
          ' ('+it.before+' → '+it.after+', 확률 '+pct(it.chance)+')\n';
      }
    }
    if(results.length>120) log += '... (상세 '+(results.length-120)+'개 생략)\n';

    state.cards.lastLog = log;
    saveState(state);
    toast('카드 뽑기 완료', count+'회 결과 갱신');
  }

  function renderCards(){
    var owned = [];
    for(var name in state.cards.inv){
      if(state.cards.inv.hasOwnProperty(name)) owned.push(name);
    }
    owned.sort(function(a,b){
      var ra = RARITY_ORDER.indexOf(CARD_DEFS[a].rarity);
      var rb = RARITY_ORDER.indexOf(CARD_DEFS[b].rarity);
      if(ra!==rb) return rb-ra;
      var ea = state.cards.inv[a].enhance, eb = state.cards.inv[b].enhance;
      if(ea!==eb) return eb-ea;
      return a.localeCompare(b,'ko');
    });

    // 덱 셀렉트 옵션
    function deckOptions(selected){
      var opt = '<option value="">(없음)</option>';
      for(var i=0;i<owned.length;i++){
        var n = owned[i];
        opt += '<option value="'+escapeHtml(n)+'" '+(n===selected?'selected':'')+'>['+RARITY_LABEL[CARD_DEFS[n].rarity]+'] '+escapeHtml(n)+' (+'+state.cards.inv[n].enhance+')</option>';
      }
      return opt;
    }

    var deckHtml = '';
    for(var s=0;s<5;s++){
      deckHtml +=
        '<div style="grid-column: span 5;">'+
          '<div class="small">슬롯 '+(s+1)+'</div>'+
          '<select class="select" data-deckslot="'+s+'">'+deckOptions(state.cards.deck[s])+'</select>'+
        '</div>';
    }

    var ownedList = '';
    if(owned.length===0){
      ownedList = '<div class="note">보유 카드가 없습니다.</div>';
    }else{
      for(var i=0;i<owned.length;i++){
        var n = owned[i];
        var def = CARD_DEFS[n];
        var enh = state.cards.inv[n].enhance;
        var mul = cardMultiplier(n);
        ownedList +=
          '<div class="item">'+
            '<div class="top">'+
              '<div class="name">'+rarityPill(def.rarity)+' '+escapeHtml(n)+' <span class="small">(+'+enh+')</span></div>'+
              '<div class="meta">'+(def.type==='physical'?'물리':'마법')+' · 마나 '+def.manaCost+' · x'+mul.toFixed(2)+'</div>'+
            '</div>'+
          '</div>';
      }
    }

    mainEl.innerHTML =
      '<div class="grid">'+
        '<div class="panel" style="grid-column: span 7;">'+
          '<h2>카드 뽑기</h2>'+
          '<div class="note">확률: 전설 1% / 에픽 3% / 레어 16% / 일반 80% · 중복 강화: 0.95^(강화+1) · 강화당 배율 +5%</div>'+
          '<hr class="sep"/>'+
          '<div class="row">'+
            '<button id="c1" class="btn good">1회 ('+fmt(ECON.card1Cost)+'💎)</button>'+
            '<button id="c10" class="btn warn">10회 ('+fmt(ECON.card10Cost)+'💎)</button>'+
            '<button id="c100" class="btn warn">100회 ('+fmt(ECON.card100Cost)+'💎)</button>'+
          '</div>'+
          '<hr class="sep"/>'+

          '<h2>덱 설정(5장)</h2>'+
          '<div class="note">전투 시 1→5 순환 사용(마나 10 이상일 때만)</div>'+
          '<div class="grid" style="grid-template-columns: repeat(10, 1fr); gap: 8px; margin-top:10px;">'+deckHtml+'</div>'+

          '<hr class="sep"/>'+
          '<h2>최근 뽑기 로그</h2>'+
          '<div class="log">'+escapeHtml(state.cards.lastLog || '아직 카드 뽑기 결과가 없습니다.')+'</div>'+
        '</div>'+

        '<div class="panel" style="grid-column: span 5;">'+
          '<h2>보유 카드</h2>'+
          '<div class="small">보유: <b>'+owned.length+'</b>종 · 총 뽑기: <b>'+fmt(state.cards.totalDraws)+'</b>회</div>'+
          '<hr class="sep"/>'+
          '<div class="list">'+ownedList+'</div>'+
        '</div>'+
      '</div>';

    bindTap(document.getElementById('c1'), function(){ doCardGacha(1); render(); });
    bindTap(document.getElementById('c10'), function(){ doCardGacha(10); render(); });
    bindTap(document.getElementById('c100'), function(){ doCardGacha(100); render(); });

    var sels = mainEl.querySelectorAll('[data-deckslot]');
    for(var i=0;i<sels.length;i++){
      (function(sel){
        sel.addEventListener('change', function(e){
          var idx = parseInt(sel.getAttribute('data-deckslot'),10);
          state.cards.deck[idx] = e.target.value || null;
          saveState(state);
          toast('덱 변경', '슬롯 '+(idx+1)+' 변경됨');
        });
      })(sels[i]);
    }
  }

  // ====== 전투 시스템 (준비중 멈춤 버그 대책: DOM 참조를 battle.ui로 유지) ======
  var battle = null;

  function mountBattleUI(container){
    container.innerHTML =
      '<div class="panel">'+
        '<h2>전투</h2>'+
        '<div class="small" data-battle-top>전투 준비중...</div>'+
        '<hr class="sep"/>'+
        '<div class="battle" data-battle-layout></div>'+
        '<hr class="sep"/>'+
        '<div class="row">'+
          '<button class="btn warn" data-battle-fast>즉시 결과</button>'+
          '<button class="btn bad" data-battle-stop>전투 중단</button>'+
        '</div>'+
        '<div class="hint">※ 기본공격 + 덱 5장 자동사용(마나 10) · 상성 유리 1.5 / 불리 0.5</div>'+
        '<hr class="sep"/>'+
        '<div class="log" data-battle-log></div>'+
      '</div>';

    var ui = {
      container: container,
      top: container.querySelector('[data-battle-top]'),
      layout: container.querySelector('[data-battle-layout]'),
      log: container.querySelector('[data-battle-log]'),
      btnFast: container.querySelector('[data-battle-fast]'),
      btnStop: container.querySelector('[data-battle-stop]')
    };
    return ui;
  }

  function computeAttackDamage(attAtk, attMatk, physBias, magBias, def, mdef){
    var p = mitigatedDamage(attAtk, def);
    var m = mitigatedDamage(attMatk, mdef);
    return p*physBias + m*magBias;
  }

  function startBattle(mode, enemy, charId, ui){
    var p = computeCharacterFinalStats(state, charId);
    var e = enemy.stats;

    battle = {
      mode: mode,
      inProgress: true,
      ui: ui,
      charId: charId,
      enemy: enemy,
      turn: 0,
      log: [],
      intervalId: null,

      p: { name:p.name, element:p.element, hp:p.hpMax, hpMax:p.hpMax, mp:p.mpMax, mpMax:p.mpMax, atk:p.atk, matk:p.matk, def:p.def, mdef:p.mdef, physBias:p.physBias, magBias:p.magBias },
      e: { name:enemy.name, element:enemy.element, hp:e.hp, hpMax:e.hp, mp:e.mp, mpMax:e.mp, atk:e.atk, matk:e.matk, def:e.def, mdef:e.mdef }
    };

    battle.log.push('[시작] '+battle.p.name+' vs '+battle.e.name);

    bindTap(ui.btnStop, function(){ stopBattle('중단'); });
    bindTap(ui.btnFast, function(){ fastResolveBattle(); });

    renderBattleFrame();

    battle.intervalId = setInterval(function(){
      try{ stepBattle(); }catch(err){
        stopBattle('오류');
        showModal('전투 오류', (err && (err.stack||err.message)) ? (err.stack||err.message) : String(err),
          [{text:'닫기', kind:'warn', value:'close'}], null);
      }
    }, 500);
  }

  function stopBattle(reason){
    if(!battle) return;
    if(battle.intervalId) clearInterval(battle.intervalId);
    battle.inProgress = false;
    battle.log.push('['+reason+'] 전투가 종료되었습니다.');
    renderBattleFrame();
  }

  function endBattle(result){
    if(!battle) return;
    if(battle.intervalId) clearInterval(battle.intervalId);
    battle.inProgress = false;

    var today = tokyoDateKey();

    if(result==='win'){
      battle.log.push('[승리] '+battle.p.name+' 승리!');
      if(battle.mode==='daily'){
        var gems = 10 * clamp(battle.enemy.stage,1,10);
        state.resources.gems += gems;
        state.daily.lastResult = { dateKey:today, stage:battle.enemy.stage, result:'win', gems:gems };
        battle.log.push('[보상] 보석 +'+gems);
      }else if(battle.mode==='ascension'){
        state.ascension.lastResult = { dateKey:today, tier:state.ascension.tierIndex, result:'win' };
        state.ascension.progressWins += 1;
        var need = Math.pow(2, state.ascension.tierIndex);
        battle.log.push('[승급 진행] '+state.ascension.progressWins+' / '+need);
        if(state.ascension.progressWins >= need){
          if(state.ascension.tierIndex < TIER_NAMES.length-1){
            state.ascension.tierIndex += 1;
            state.ascension.progressWins = 0;
            battle.log.push('[승급 성공] 현재: '+TIER_NAMES[state.ascension.tierIndex]);
            toast('승급 성공!', '티어 '+TIER_NAMES[state.ascension.tierIndex]+' 달성');
          }
        }
      }
    }else{
      battle.log.push('[패배] '+battle.p.name+' 패배...');
      if(battle.mode==='daily') state.daily.lastResult = { dateKey:today, stage:battle.enemy.stage, result:'lose', gems:0 };
      if(battle.mode==='ascension') state.ascension.lastResult = { dateKey:today, tier:state.ascension.tierIndex, result:'lose' };
    }

    saveState(state);
    renderBattleFrame();
  }

  function choosePlayableCard(turn){
    var deck = state.cards.deck;
    var idx = (turn-1) % 5;
    var name = deck[idx];
    if(!name) return null;
    var def = CARD_DEFS[name];
    if(!def) return null;
    if(!state.cards.inv[name]) return null;
    if(battle.p.mp < def.manaCost) return null;
    return name;
  }

  function stepBattle(){
    if(!battle || !battle.inProgress) return;
    battle.turn += 1;

    // 플레이어 행동
    var cardName = choosePlayableCard(battle.turn);
    if(cardName){
      var cDef = CARD_DEFS[cardName];
      var mul = cardMultiplier(cardName);
      var type = cDef.type; // physical/magic
      battle.p.mp -= cDef.manaCost;

      var dmg = computeAttackDamage(
        battle.p.atk, battle.p.matk,
        (type==='physical')?1:0,
        (type==='magic')?1:0,
        battle.e.def, battle.e.mdef
      );
      var elemMul = elementDamageMultiplier(battle.p.element, battle.e.element);
      var final = Math.max(1, Math.floor(dmg * mul * elemMul));
      battle.e.hp -= final;
      battle.log.push('[T'+battle.turn+'] '+battle.p.name+' 카드('+cardName+') x'+mul.toFixed(2)+' 피해 '+final+' (상성 x'+elemMul+')');
    }else{
      var dmg2 = computeAttackDamage(
        battle.p.atk, battle.p.matk,
        battle.p.physBias, battle.p.magBias,
        battle.e.def, battle.e.mdef
      );
      var elemMul2 = elementDamageMultiplier(battle.p.element, battle.e.element);
      var final2 = Math.max(1, Math.floor(dmg2 * elemMul2));
      battle.e.hp -= final2;
      battle.log.push('[T'+battle.turn+'] '+battle.p.name+' 기본공격 피해 '+final2+' (상성 x'+elemMul2+')');
    }

    // 마나 회복(프로토타입)
    battle.p.mp = Math.min(battle.p.mpMax, battle.p.mp + 5);

    if(battle.e.hp <= 0){
      battle.e.hp = 0;
      endBattle('win');
      return;
    }

    // 적 행동(기본공격)
    var edmg = computeAttackDamage(
      battle.e.atk, battle.e.matk,
      0.5, 0.5,
      battle.p.def, battle.p.mdef
    );
    var elemMulE = elementDamageMultiplier(battle.e.element, battle.p.element);
    var eFinal = Math.max(1, Math.floor(edmg * elemMulE));
    battle.p.hp -= eFinal;
    battle.log.push('[T'+battle.turn+'] '+battle.e.name+' 공격 피해 '+eFinal+' (상성 x'+elemMulE+')');

    if(battle.p.hp <= 0){
      battle.p.hp = 0;
      endBattle('lose');
      return;
    }

    renderBattleFrame();
  }

  function renderBattleFrame(){
    if(!battle) return;
    var ui = battle.ui;
    if(!ui || !ui.top || !ui.layout || !ui.log){
      // UI가 사라진 경우(탭 이동 등) 안전 종료
      stopBattle('UI 없음');
      return;
    }

    ui.top.textContent = (battle.inProgress?'진행중':'종료')+' · 턴 '+battle.turn+' · '+battle.p.name+'('+ELEMENT[battle.p.element].label+') vs '+battle.e.name+'('+ELEMENT[battle.e.element].label+')';

    var p = battle.p, e = battle.e;

    ui.layout.innerHTML =
      '<div class="battle-side">'+
        '<img class="avatar" data-charimg="'+battle.charId+'" data-try="0" src="'+getCharImageSrc(battle.charId)+'" onerror="window.__imgFallback && window.__imgFallback(this)" alt="'+escapeHtml(p.name)+'"/>'+
        '<div class="bar-wrap">'+
          '<div class="bar-label"><span>'+escapeHtml(p.name)+'</span><span>HP '+fmt(p.hp)+' / '+fmt(p.hpMax)+'</span></div>'+
          '<div class="bar"><div style="width:'+((p.hp/p.hpMax)*100).toFixed(2)+'%"></div></div>'+
          '<div class="bar-label" style="margin-top:8px;"><span>MP</span><span>'+fmt(p.mp)+' / '+fmt(p.mpMax)+'</span></div>'+
          '<div class="bar mp"><div style="width:'+((p.mp/p.mpMax)*100).toFixed(2)+'%"></div></div>'+
        '</div>'+
      '</div>'+

      '<div class="battle-mid">VS</div>'+

      '<div class="battle-side">'+
        '<div class="bar-wrap">'+
          '<div class="bar-label"><span>'+escapeHtml(e.name)+'</span><span>HP '+fmt(e.hp)+' / '+fmt(e.hpMax)+'</span></div>'+
          '<div class="bar"><div style="width:'+((e.hp/e.hpMax)*100).toFixed(2)+'%"></div></div>'+
          '<div class="bar-label" style="margin-top:8px;"><span>MP</span><span>'+fmt(e.mp)+' / '+fmt(e.mpMax)+'</span></div>'+
          '<div class="bar mp"><div style="width:'+((e.mp/e.mpMax)*100).toFixed(2)+'%"></div></div>'+
        '</div>'+
        '<div class="avatar" style="display:flex;align-items:center;justify-content:center;border-radius:14px;">'+
          '<div style="font-size:34px;">'+ELEMENT[e.element].emoji+'</div>'+
        '</div>'+
      '</div>';

    var lines = battle.log.slice(Math.max(0, battle.log.length-250));
    ui.log.textContent = lines.join('\n');
    ui.log.scrollTop = ui.log.scrollHeight;

    ui.btnStop.disabled = !battle.inProgress;
    ui.btnFast.disabled = !battle.inProgress;
  }

  function fastResolveBattle(){
    if(!battle || !battle.inProgress) return;
    for(var i=0;i<400;i++){
      if(!battle.inProgress) break;
      stepBattle();
    }
    if(battle && battle.inProgress) stopBattle('턴 제한');
  }

  // ====== 일일도전 ======
  function buildDailyEnemy(stage, boss){
    var base = { hp:1000, mp:100, atk:200, matk:200, def:100, mdef:100 };
    stage = clamp(stage,1,10);
    var hpMul = Math.pow(1.40, stage-1);
    var atkMul = Math.pow(1.25, stage-1);
    var defMul = Math.pow(1.18, stage-1);
    return {
      kind:'daily',
      stage:stage,
      element:boss.element,
      name: boss.name+' (난이도 '+stage+')',
      stats: {
        hp: Math.round(base.hp*hpMul),
        mp: base.mp,
        atk: Math.round(base.atk*atkMul),
        matk: Math.round(base.matk*atkMul),
        def: Math.round(base.def*defMul),
        mdef: Math.round(base.mdef*defMul)
      }
    };
  }

  function renderDaily(){
    var boss = todayBoss();
    var today = boss.dateKey;
    var attempted = (state.daily.lastAttemptDateKey === today);
    var last = state.daily.lastResult;

    var charOpts = '';
    for(var i=0;i<CHAR_DEFS.length;i++){
      var cd = CHAR_DEFS[i];
      charOpts += '<option value="'+cd.id+'" '+(cd.id===state.selectedCharId?'selected':'')+'>'+ELEMENT[cd.element].emoji+' '+cd.name+'</option>';
    }

    var lastHtml = '아직 기록이 없습니다.';
    if(last){
      lastHtml =
        '날짜: <b>'+escapeHtml(last.dateKey)+'</b><br/>'+
        '결과: <b>'+escapeHtml(last.result)+'</b><br/>'+
        '난이도: <b>'+escapeHtml(String(last.stage))+'</b><br/>'+
        '보석: <b>+'+fmt(last.gems||0)+'</b>';
    }

    mainEl.innerHTML =
      '<div class="grid">'+
        '<div class="panel" style="grid-column: span 7;">'+
          '<h2>일일 도전 배틀</h2>'+
          '<div class="note">오늘의 적: <b>'+ELEMENT[boss.element].emoji+' '+ELEMENT[boss.element].label+' · '+boss.name+'</b><br/>'+
          '도전 기회: <b>'+(attempted?'0/1 (이미 도전함)':'1/1')+'</b><br/>난이도 1~10, 승리 시 보석 획득</div>'+
          '<hr class="sep"/>'+
          '<div class="row">'+
            '<div style="flex:1;"><div class="small">난이도</div>'+
              '<select id="dailyStage" class="select">'+
                '<option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option>'+
                '<option value="6">6</option><option value="7">7</option><option value="8">8</option><option value="9">9</option><option value="10">10</option>'+
              '</select>'+
            '</div>'+
            '<div style="flex:1;"><div class="small">출전 캐릭터</div>'+
              '<select id="dailyChar" class="select">'+charOpts+'</select>'+
            '</div>'+
          '</div>'+
          '<div class="row" style="margin-top:10px;">'+
            '<button id="startDaily" class="btn good" '+(attempted?'disabled':'')+'>전투 시작</button>'+
          '</div>'+
          '<div class="hint">카드가 없어도 기본공격으로 전투는 진행됩니다. (덱이 있으면 자동 사용)</div>'+
          '<hr class="sep"/>'+
          '<div class="panel" style="background: rgba(255,255,255,0.02);">'+
            '<h2>최근 결과</h2><div class="note">'+lastHtml+'</div>'+
          '</div>'+
        '</div>'+

        '<div class="panel" style="grid-column: span 5;">'+
          '<h2>덱(카드 5장)</h2>'+
          '<div class="note">카드 탭에서 덱을 변경할 수 있습니다.</div>'+
          '<hr class="sep"/>'+
          '<div class="list" style="max-height:240px;">'+renderDeckList()+'</div>'+
        '</div>'+

        '<div id="battleWrap" style="grid-column: span 12;"></div>'+
      '</div>';

    document.getElementById('dailyChar').addEventListener('change', function(e){
      state.selectedCharId = e.target.value;
      saveState(state);
      render();
    });

    bindTap(document.getElementById('startDaily'), function(){
      var stage = parseInt(document.getElementById('dailyStage').value,10);
      var charId = document.getElementById('dailyChar').value;

      var todayKey = tokyoDateKey();
      if(state.daily.lastAttemptDateKey === todayKey){
        toast('이미 오늘 도전했습니다','일일도전은 하루 1회입니다.');
        return;
      }
      // 시작 시 소모
      state.daily.lastAttemptDateKey = todayKey;
      saveState(state);

      var enemy = buildDailyEnemy(stage, boss);
      var wrap = document.getElementById('battleWrap');
      var ui = mountBattleUI(wrap);
      startBattle('daily', enemy, charId, ui);
    });
  }

  function renderDeckList(){
    var out = '';
    for(var i=0;i<5;i++){
      var n = state.cards.deck[i];
      if(!n){
        out += '<div class="item"><div class="top"><div class="name">슬롯 '+(i+1)+': (없음)</div></div></div>';
      }else{
        var def = CARD_DEFS[n];
        var enh = state.cards.inv[n] ? state.cards.inv[n].enhance : 0;
        var mul = cardMultiplier(n);
        out +=
          '<div class="item"><div class="top">'+
            '<div class="name">'+rarityPill(def.rarity)+' '+escapeHtml(n)+' <span class="small">(+'+enh+')</span></div>'+
            '<div class="meta">'+(def.type==='physical'?'물리':'마법')+' · x'+mul.toFixed(2)+'</div>'+
          '</div></div>';
      }
    }
    return out;
  }

  // ====== 승급 ======
  function buildAscensionEnemy(){
    var tier = state.ascension.tierIndex;
    var diff = tier + 1;

    var base = { hp:2000, mp:100, atk:250, matk:250, def:150, mdef:150 };
    var hpMul = Math.pow(1.55, diff-1);
    var atkMul = Math.pow(1.30, diff-1);
    var defMul = Math.pow(1.22, diff-1);

    return {
      kind:'ascension',
      element:'none',
      name:'창조신 에스테아 (승급 난이도 '+diff+')',
      stats:{
        hp:Math.round(base.hp*hpMul),
        mp:base.mp,
        atk:Math.round(base.atk*atkMul),
        matk:Math.round(base.matk*atkMul),
        def:Math.round(base.def*defMul),
        mdef:Math.round(base.mdef*defMul)
      }
    };
  }

  function renderAscension(){
    var today = tokyoDateKey();
    var attempted = (state.ascension.lastAttemptDateKey === today);

    var tierIdx = state.ascension.tierIndex;
    var tierName = TIER_NAMES[tierIdx] || '—';
    var need = Math.pow(2, tierIdx);
    var bonus = tierBonusMultiplier(state);

    var charOpts = '';
    for(var i=0;i<CHAR_DEFS.length;i++){
      var cd = CHAR_DEFS[i];
      charOpts += '<option value="'+cd.id+'" '+(cd.id===state.selectedCharId?'selected':'')+'>'+ELEMENT[cd.element].emoji+' '+cd.name+'</option>';
    }

    var last = state.ascension.lastResult;
    var lastHtml = '아직 기록이 없습니다.';
    if(last){
      lastHtml = '날짜: <b>'+escapeHtml(last.dateKey)+'</b><br/>결과: <b>'+escapeHtml(last.result)+'</b><br/>당시 티어: <b>'+escapeHtml(String(last.tier))+'</b>';
    }

    mainEl.innerHTML =
      '<div class="grid">'+
        '<div class="panel" style="grid-column: span 7;">'+
          '<h2>승급 도전</h2>'+
          '<div class="note">상대: <b>창조신 에스테아(무)</b><br/>하루 1회 도전 가능 · 승리 시 진행 +1<br/>'+
          '다음 티어까지 필요 승리: <b>'+need+'</b><br/><br/>'+
          '현재 티어: <b>'+escapeHtml(tierName)+'</b> ('+(tierIdx+1)+'/10)<br/>'+
          '티어 보너스: 최종 <b>HP/ATK/MATK x'+bonus.toFixed(2)+'</b><br/>'+
          '진행: <b>'+state.ascension.progressWins+' / '+need+'</b></div>'+
          '<hr class="sep"/>'+
          '<div class="row">'+
            '<div style="flex:1;"><div class="small">출전 캐릭터</div><select id="ascChar" class="select">'+charOpts+'</select></div>'+
            '<div style="flex:1;"><div class="small">도전 가능</div><div class="select" style="display:flex;justify-content:space-between;"><span>'+(attempted?'오늘 이미 도전함':'가능')+'</span><span class="small">'+today+'</span></div></div>'+
          '</div>'+
          '<div class="row" style="margin-top:10px;"><button id="startAsc" class="btn good" '+(attempted?'disabled':'')+'>승급 전투 시작</button></div>'+
          '<hr class="sep"/>'+
          '<div class="panel" style="background: rgba(255,255,255,0.02);"><h2>최근 결과</h2><div class="note">'+lastHtml+'</div></div>'+
        '</div>'+

        '<div class="panel" style="grid-column: span 5;">'+
          '<h2>덱(카드 5장)</h2>'+
          '<div class="note">승급전에서도 동일 덱을 사용합니다.</div>'+
          '<hr class="sep"/>'+
          '<div class="list" style="max-height:240px;">'+renderDeckList()+'</div>'+
        '</div>'+

        '<div id="ascBattleWrap" style="grid-column: span 12;"></div>'+
      '</div>';

    document.getElementById('ascChar').addEventListener('change', function(e){
      state.selectedCharId = e.target.value;
      saveState(state);
      render();
    });

    bindTap(document.getElementById('startAsc'), function(){
      var todayKey = tokyoDateKey();
      if(state.ascension.lastAttemptDateKey === todayKey){
        toast('이미 오늘 도전했습니다','승급 도전은 하루 1회입니다.');
        return;
      }
      state.ascension.lastAttemptDateKey = todayKey;
      saveState(state);

      var enemy = buildAscensionEnemy();
      var charId = document.getElementById('ascChar').value;

      var wrap = document.getElementById('ascBattleWrap');
      var ui = mountBattleUI(wrap);
      startBattle('ascension', enemy, charId, ui);
    });
  }

  // ====== 설정 (이미지 파일 선택 등록 포함) ======
  function renderSettings(){
    var loc = window.location.href;
    var info = 'URL: '+loc+'\n프로토콜: '+window.location.protocol+'\n저장(LocalStorage): '+(storageOK?'가능':'불가(이 환경은 저장이 안 될 수 있음)');

    mainEl.innerHTML =
      '<div class="grid">'+
        '<div class="panel" style="grid-column: span 6;">'+
          '<h2>저장/리셋</h2>'+
          '<div class="row">'+
            '<button id="btnSave" class="btn good">수동 저장</button>'+
            '<button id="btnReset" class="btn bad">데이터 초기화</button>'+
          '</div>'+
          '<hr class="sep"/>'+
          '<h2>내보내기 / 가져오기</h2>'+
          '<div class="row" style="margin-top:8px;">'+
            '<button id="btnExport" class="btn warn">내보내기</button>'+
            '<button id="btnImport" class="btn warn">가져오기</button>'+
          '</div>'+
          '<textarea id="saveBox" rows="10" style="margin-top:10px;" placeholder="여기에 JSON이 표시됩니다."></textarea>'+
          '<hr class="sep"/>'+
          '<h2>진단</h2>'+
          '<div class="log">'+escapeHtml(info)+'</div>'+
        '</div>'+

        '<div class="panel" style="grid-column: span 6;">'+
          '<h2>캐릭터 이미지 등록</h2>'+
          '<div class="note">같은 폴더의 zeek.png 등이 자동 로드 안 될 경우, 여기서 직접 파일을 선택해 등록하면 항상 표시됩니다.<br/>(이미지가 너무 크면 저장공간 제한에 걸릴 수 있어요)</div>'+
          '<hr class="sep"/>'+
          renderImagePickers()+
        '</div>'+
      '</div>';

    bindTap(document.getElementById('btnSave'), function(){
      var ok = saveState(state);
      toast('저장', ok ? '저장 완료' : '저장 실패(이 WebView는 저장이 막혔을 수 있음)');
    });

    bindTap(document.getElementById('btnReset'), function(){
      showModal('초기화 확인', '정말 초기화할까요?\n(되돌릴 수 없습니다)', [
        {text:'취소', kind:'warn', value:'no'},
        {text:'초기화', kind:'bad', value:'yes'}
      ], function(v){
        if(v!=='yes') return;
        if(storageOK){
          try{ localStorage.removeItem(STORAGE_KEY); }catch(e){}
        }
        state = createNewState();
        window.__STATE = state;
        saveState(state);
        toast('초기화 완료','새 게임으로 시작합니다.');
        render();
      });
    });

    bindTap(document.getElementById('btnExport'), function(){
      var box = document.getElementById('saveBox');
      box.value = JSON.stringify(state, null, 2);
      box.focus();
      box.select();
      toast('내보내기','JSON 생성 완료');
    });

    bindTap(document.getElementById('btnImport'), function(){
      var box = document.getElementById('saveBox');
      var text = box.value;
      try{
        var parsed = JSON.parse(text);
        if(!parsed || !parsed.characters){
          showModal('가져오기 실패', '데이터 형식이 올바르지 않습니다.', [{text:'닫기', kind:'warn', value:'close'}], null);
          return;
        }
        // assets 보정
        if(!parsed.assets) parsed.assets = { charImages:{ zeek:null, lumi:null, queen:null, jasmine:null, luna:null } };
        if(!parsed.assets.charImages) parsed.assets.charImages = { zeek:null, lumi:null, queen:null, jasmine:null, luna:null };
        state = parsed;
        window.__STATE = state;
        saveState(state);
        toast('가져오기 완료','데이터 적용됨');
        render();
      }catch(e){
        showModal('가져오기 실패', 'JSON 파싱 오류: '+(e.message||String(e)), [{text:'닫기', kind:'warn', value:'close'}], null);
      }
    });

    // 이미지 파일 input 이벤트 연결
    for(var i=0;i<CHAR_DEFS.length;i++){
      (function(cd){
        var input = document.getElementById('img_'+cd.id);
        if(!input) return;
        input.addEventListener('change', function(){
          if(!input.files || !input.files[0]) return;
          var file = input.files[0];
          var reader = new FileReader();
          reader.onload = function(){
            state.assets.charImages[cd.id] = reader.result; // DataURL
            saveState(state);
            toast('이미지 등록', cd.name+' 이미지가 등록되었습니다.');
            render(); // 반영
          };
          reader.readAsDataURL(file);
        });

        var clearBtn = document.getElementById('img_clear_'+cd.id);
        bindTap(clearBtn, function(){
          state.assets.charImages[cd.id] = null;
          saveState(state);
          toast('이미지 제거', cd.name+' 이미지가 제거되었습니다.');
          render();
        });
      })(CHAR_DEFS[i]);
    }
  }

  function renderImagePickers(){
    var html = '';
    for(var i=0;i<CHAR_DEFS.length;i++){
      var cd = CHAR_DEFS[i];
      var has = state.assets && state.assets.charImages && state.assets.charImages[cd.id];
      html +=
        '<div class="panel" style="background: rgba(255,255,255,0.02); margin-bottom:10px;">'+
          '<div class="row space">'+
            '<div><div class="char-name">'+ELEMENT[cd.element].emoji+' '+cd.name+'</div><div class="small">'+(has?'등록됨(우선 사용)':'미등록(자동 로드 시도)')+'</div></div>'+
            '<button id="img_clear_'+cd.id+'" class="btn bad">제거</button>'+
          '</div>'+
          '<div class="row" style="margin-top:10px;">'+
            '<input id="img_'+cd.id+'" type="file" accept="image/*" />'+
          '</div>'+
          '<div class="hint">자동 후보: '+escapeHtml(cd.id+'.png / '+cd.id+'.PNG / images/... / img/...')+'</div>'+
        '</div>';
    }
    return html;
  }

  // ====== 메인 루프(방치) ======
  function tickIdle(){
    var now = nowMs();
    var dt = clamp((now - (state.lastTickAt || now))/1000, 0, 10);
    state.lastTickAt = now;
    state.resources.xp += xpPerHour(state) * (dt/3600);
    state.resources.gold += goldPerHour(state) * (dt/3600);
  }

  var autosaveAcc = 0;
  setInterval(function(){
    tickIdle();
    renderResourceBar();
    autosaveAcc += 1;
    if(autosaveAcc >= 5){
      autosaveAcc = 0;
      saveState(state);
    }
  }, 1000);

  // 최초 렌더
  render();

})();

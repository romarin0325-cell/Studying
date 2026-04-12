const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = process.cwd();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon'
};

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function createStaticServer(rootDir) {
  return http.createServer((req, res) => {
    const requestUrl = new URL(req.url, 'http://127.0.0.1');
    let pathname = decodeURIComponent(requestUrl.pathname);
    if (pathname === '/') pathname = '/card/index.html';

    const resolvedPath = path.join(rootDir, pathname);
    const normalizedRoot = path.resolve(rootDir);
    const normalizedPath = path.resolve(resolvedPath);
    if (!normalizedPath.startsWith(normalizedRoot)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    let filePath = normalizedPath;
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    if (!fs.existsSync(filePath)) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
}

function buildGeminiResponse(text) {
  return {
    candidates: [
      {
        content: {
          role: 'model',
          parts: [{ text }]
        },
        groundingMetadata: {
          groundingChunks: [
            {
              web: {
                uri: 'https://example.com/phantom',
                title: 'Phantom verification source'
              }
            }
          ],
          webSearchQueries: ['phantom card verification']
        }
      }
    ]
  };
}

async function withPage(browser, baseUrl, relativeUrl, fn) {
  const context = await browser.newContext({ locale: 'ko-KR' });
  await context.route('https://fonts.googleapis.com/**', route => route.abort());
  await context.route('https://fonts.gstatic.com/**', route => route.abort());
  await context.route('https://generativelanguage.googleapis.com/**', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildGeminiResponse('검증용 답변입니다. 팬텀은 어둠 속성 전설 딜러입니다.'))
    });
  });

  const page = await context.newPage();
  await page.goto(`${baseUrl}/${relativeUrl}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof RPG !== 'undefined' && typeof RPG.startGame === 'function');
  await page.waitForFunction(() => {
    const button = document.getElementById('btn-start-new');
    return !button || !button.disabled;
  });

  try {
    return await fn(page);
  } finally {
    await context.close();
  }
}

async function verifyLumiQuestionFlow(page) {
  await page.evaluate(() => {
    Storage.setRaw(Storage.keys.API_KEY, 'test-key');
  });

  await page.click('#btn-title-question');
  await page.waitForFunction(() => document.getElementById('modal-lumi-question').classList.contains('active'));
  await page.fill('#lumi-chat-input', '팬텀은 어떤 카드야?');
  await page.evaluate(() => RPG.sendLumiQuestion());
  await page.waitForFunction(() => {
    return Array.from(document.querySelectorAll('#lumi-chat-log .lumi-chat-bubble.model'))
      .some(node => node.innerText.includes('검증용 답변입니다.'));
  });

  const result = await page.evaluate(() => ({
    userMessages: Array.from(document.querySelectorAll('#lumi-chat-log .lumi-chat-bubble.user')).map(node => node.innerText.trim()),
    modelMessages: Array.from(document.querySelectorAll('#lumi-chat-log .lumi-chat-bubble.model')).map(node => node.innerText.trim()),
    sourceLabels: Array.from(document.querySelectorAll('#lumi-chat-log .lumi-chat-source')).map(node => node.innerText.trim())
  }));

  assert(result.userMessages.some(message => message.includes('팬텀은 어떤 카드야?')), '질문하기 사용자 메시지가 채팅 패널에 남지 않았습니다.');
  assert(result.modelMessages.some(message => message.includes('검증용 답변입니다.')), '질문하기 모델 답변이 채팅 패널에 표시되지 않았습니다.');
  assert(result.sourceLabels.length >= 1, '질문하기 소스 라벨이 렌더링되지 않았습니다.');

  return {
    question: result.userMessages[result.userMessages.length - 1],
    answer: result.modelMessages[result.modelMessages.length - 1],
    sources: result.sourceLabels.length
  };
}

async function verifyMainUiAndMissionFlow(page) {
  await page.evaluate(() => {
    RPG.startGame('new');
    RPG.tempGameType = 'endless';
    RPG.global.unlocked_bonus_cards = [];
    RPG.openModeSelect();
  });

  await page.waitForFunction(() => document.getElementById('modal-mode-select').classList.contains('active'));

  const chaosVisible = await page.evaluate(() => {
    const button = document.getElementById('btn-chaos-roulette');
    return !!button && getComputedStyle(button).display !== 'none';
  });
  assert(chaosVisible, '엔드리스 모드 선택에서 카오스 룰렛 버튼이 노출되지 않았습니다.');

  await page.evaluate(() => RPG.openChaosRoulette());
  const chaosOpened = await page.evaluate(() => document.getElementById('screen-chaos-roulette').classList.contains('active'));
  assert(chaosOpened, '모든 보너스를 모으지 않은 상태에서 카오스 룰렛 화면이 열리지 않았습니다.');

  const preClaim = await page.evaluate(() => {
    RPG.global.chaosTickets = 9;
    RPG.global.chaosTicketVersion = GAME_CONSTANTS.CHAOS_TICKET_VERSION - 1;
    RPG.saveGlobalData();
    RPG.loadGlobalData();

    const invalidatedTickets = RPG.global.chaosTickets;
    const invalidatedVersion = RPG.global.chaosTicketVersion;

    RPG.global.chaosTickets = 4;
    RPG.global.chaosTicketVersion = GAME_CONSTANTS.CHAOS_TICKET_VERSION;
    RPG.global.lastAttendanceDate = null;
    RPG.global.weeklyMission = null;
    RPG.saveGlobalData();
    RPG.loadGlobalData();

    const beforeAttendanceTickets = RPG.global.chaosTickets;
    RPG.trackDailyAttendance();
    const afterAttendanceTickets = RPG.global.chaosTickets;
    const attendanceProgress = RPG.global.weeklyMission.missions.attendance3.progress;

    RPG.registerToeicPracticeAttempt({ countHiddenUnlock: false });
    const toeicProgress = RPG.global.weeklyMission.missions.toeic1.progress;

    RPG.incrementWeeklyMissionProgress('challenge1', 1);
    RPG.global.weeklyMission.missions.attendance3.progress = 3;
    RPG.saveGlobalData();
    RPG.openMonthlyMission();

    return {
      invalidatedTickets,
      invalidatedVersion,
      beforeAttendanceTickets,
      afterAttendanceTickets,
      attendanceProgress,
      toeicProgress,
      weeklyRewardName: document.getElementById('weekly-mission-reward-name').innerText.trim(),
      weeklyMissionText: document.getElementById('weekly-mission-list').innerText
    };
  });

  assert(preClaim.invalidatedTickets === 0, '기존 카오스 티켓 무효화가 적용되지 않았습니다.');
  assert(preClaim.invalidatedVersion > 1, '카오스 티켓 버전 갱신이 적용되지 않았습니다.');
  assert(preClaim.beforeAttendanceTickets === preClaim.afterAttendanceTickets, '출석 추적에서 카오스 티켓이 지급되었습니다.');
  assert(preClaim.attendanceProgress === 1, '출석 추적이 주간 미션 진행도로 반영되지 않았습니다.');
  assert(preClaim.toeicProgress === 1, '실전마법연습 1회 주간 미션이 증가하지 않았습니다.');
  assert(preClaim.weeklyRewardName.includes('카오스 티켓 3장'), '주간 미션 보상 표기가 카오스 티켓 3장으로 표시되지 않았습니다.');
  assert(preClaim.weeklyMissionText.includes('챌린지') && preClaim.weeklyMissionText.includes('실전') && preClaim.weeklyMissionText.includes('출석'), '주간 미션 목록에 신규 미션 3종이 모두 표시되지 않았습니다.');

  await page.evaluate(() => RPG.claimWeeklyMissionReward());
  await page.waitForFunction(() => document.getElementById('modal-info').classList.contains('active'));

  const postClaim = await page.evaluate(() => ({
    chaosTickets: RPG.global.chaosTickets,
    infoTitle: document.getElementById('info-title').innerText.trim(),
    infoContent: document.getElementById('info-content').innerText.trim()
  }));

  assert(postClaim.chaosTickets === 7, '주간 미션 보상 수령 후 카오스 티켓이 3장 지급되지 않았습니다.');
  assert(postClaim.infoTitle.includes('주간 미션 보상'), '주간 미션 보상 안내 모달 제목이 올바르지 않습니다.');
  assert(postClaim.infoContent.includes('카오스 티켓 3장'), '주간 미션 보상 안내 모달에 지급 수량이 표시되지 않았습니다.');

  return {
    chaosRouletteVisible: chaosVisible,
    invalidatedTickets: preClaim.invalidatedTickets,
    attendanceProgress: preClaim.attendanceProgress,
    toeicProgress: preClaim.toeicProgress,
    chaosTicketsAfterClaim: postClaim.chaosTickets
  };
}

async function verifyBeginnerSafetyAndClearReward(page) {
  const result = await page.evaluate(() => {
    RPG.startGame('new');
    RPG.global.unlocked_bonus_cards = ['luna', 'archangel'];

    RPG.tempGameType = 'challenge';
    RPG.initNewGame('chaos');
    const chaosTickets = RPG.state.tickets;

    RPG.tempGameType = 'challenge';
    RPG.initNewGame('origin');
    const hasRumi = RPG.state.inventory.includes('rumi');

    RPG.global.chaosTickets = 0;
    RPG.state.gameType = 'challenge';
    RPG.state.mode = 'origin';
    RPG.checkAllBonusUnlocked = () => true;
    RPG.finishWinBattle('', true, null);

    return {
      chaosTickets,
      hasRumi,
      rewardTicketCount: RPG.global.chaosTickets
    };
  });

  assert(result.chaosTickets === 5, '초보자 챌린지 카오스 시작 시 티켓 5장이 지급되지 않았습니다.');
  assert(result.hasRumi, '초보자 일반 챌린지 시작 시 루미가 지급되지 않았습니다.');
  assert(result.rewardTicketCount === 1, '모든 보너스 획득 후 챌린지 클리어 티켓 보상이 유지되지 않았습니다.');

  return result;
}

async function verifyCombatRules(page) {
  const result = await page.evaluate(() => {
    const originalRandom = Math.random;
    Math.random = () => 0.99;

    function cloneCard(cardId) {
      const proto = RPG.getCardData(cardId);
      return {
        id: proto.id,
        proto,
        name: proto.name,
        maxHp: proto.stats.hp,
        hp: proto.stats.hp,
        mp: 100,
        atk: proto.stats.atk,
        matk: proto.stats.matk,
        def: proto.stats.def,
        mdef: proto.stats.mdef,
        baseDef: proto.stats.def,
        baseMdef: proto.stats.mdef,
        buffs: {},
        pos: 0,
        isDead: false,
        skills: JSON.parse(JSON.stringify(proto.skills)),
        tookDamageThisTurn: false
      };
    }

    function makeDummy(buffs = {}, overrides = {}) {
      return {
        id: 'dummy',
        proto: { id: 'dummy', name: '훈련용 허수아비', trait: { type: 'none' } },
        name: '훈련용 허수아비',
        maxHp: overrides.hp || 99999,
        hp: overrides.hp || 99999,
        mp: 100,
        atk: overrides.atk || 80,
        matk: overrides.matk || 80,
        def: overrides.def || 100,
        mdef: overrides.mdef || 100,
        baseDef: overrides.def || 100,
        baseMdef: overrides.mdef || 100,
        buffs: { ...buffs },
        pos: 0,
        isDead: false,
        skills: [],
        tookDamageThisTurn: false
      };
    }

    function makeRpg(options = {}) {
      const logs = [];
      const enemy = options.enemy || makeDummy();
      const rpg = {
        NORMAL_ATTACK: RPG.NORMAL_ATTACK,
        state: {
          mode: options.mode || 'origin',
          deck: options.deck || [null, null, null],
          artifacts: options.artifacts || []
        },
        battle: {
          fieldBuffs: JSON.parse(JSON.stringify(options.fieldBuffs || [])),
          activeTraits: [...(options.activeTraits || [])],
          delayedEffects: [],
          turn: options.turn || 1,
          enemy,
          players: options.players || [],
          currentPlayerIdx: 0,
          isNewTurn: false
        },
        logs,
        didWin: false,
        hasArtifact(id) {
          return this.state.artifacts.includes(id);
        },
        getCardData(id) {
          return RPG.getCardData(id);
        },
        showBattleScreen() { },
        renderBattleView() { },
        renderBattleControls() { },
        showAlert() { },
        log(message) {
          this.logs.push(String(message));
        },
        winBattle() {
          this.didWin = true;
        },
        loseBattle() { }
      };
      return rpg;
    }

    const allCards = GameUtils.getAllCards();

    const sphinx = RPG.getCardData('sphinx');
    const candyBoy = RPG.getCardData('candy_boy');
    const priest = RPG.getCardData('priest_of_end');

    const sphinxStats = Logic.calculateInitialStats(sphinx, ['sphinx', 'archangel', 'cinderella'], allCards, 0);
    const candyStats = Logic.calculateInitialStats(candyBoy, ['candy_boy', 'archangel', 'ancient_soul'], allCards, 0);
    const priestStats = Logic.calculateInitialStats(priest, ['priest_of_end', 'fallen_angel', 'phantom'], allCards, 0);

    const phantom = cloneCard('phantom');
    const luna = cloneCard('luna');
    const deepLord = cloneCard('deep_lord');
    const fieldBuffs = [{ name: 'sun_bless' }];
    const phantomBaseStats = Logic.calculateStats(phantom, [], 'origin', [], 1);
    const phantomFieldStats = Logic.calculateStats(phantom, fieldBuffs, 'origin', [], 1);
    const lunaBaseStats = Logic.calculateStats(luna, [], 'origin', [], 1);
    const lunaFieldStats = Logic.calculateStats(luna, fieldBuffs, 'origin', [], 1);

    const fallenAngel = cloneCard('fallen_angel');
    const fallenSkill = fallenAngel.skills[2];
    const noBuffDamage = Logic.calculateDamage(fallenAngel, makeDummy(), fallenSkill, [], [], () => { }, 'origin', ['fallen_angel'], 1, []);
    const divineDamage = Logic.calculateDamage(fallenAngel, makeDummy({ divine: 1 }), fallenSkill, [], [], () => { }, 'origin', ['fallen_angel'], 1, []);
    const darknessDamage = Logic.calculateDamage(fallenAngel, makeDummy({ darkness: 1 }), fallenSkill, [], [], () => { }, 'origin', ['fallen_angel'], 1, []);

    const lunaSkill = deepLord.skills[1];
    const lunaTarget = makeDummy();
    const mutableFieldBuffs = [{ name: 'moon_bless' }];
    const lunaDamage = Logic.calculateDamage(deepLord, lunaTarget, lunaSkill, mutableFieldBuffs, [], () => { }, 'origin', ['deep_lord'], 1, []);
    const lunaSourceStats = Logic.calculateStats(deepLord, [{ name: 'moon_bless' }], 'origin', [], 1);
    const lunaTargetStats = Logic.calculateStats(lunaTarget, [{ name: 'moon_bless' }], 'origin', [], 1);
    const expectedLunaDamage = Math.floor(lunaSourceStats.matk * lunaSkill.val * 2.0 * (100 / (100 + lunaTargetStats.mdef)));

    const nightmareMessages = [
      '첫번째 악몽이 시작된다.',
      '두번째 악몽이 시작된다.',
      '세번째 악몽이 시작된다.',
      '네번째 악몽이 시작된다.',
      '마지막 악몽이 시작된다.'
    ];

    const phantomSkill = phantom.skills[1];
    const delayedTarget = makeDummy({}, { hp: 99999, mdef: 100 });
    const delayedRpg = makeRpg({ deck: ['phantom', null, null], enemy: delayedTarget, players: [phantom, null, null], turn: 1 });
    const originalEndPlayerTurn = BattleRuntime.TurnManager.endPlayerTurn;
    BattleRuntime.TurnManager.endPlayerTurn = () => { };
    BattleRuntime.executeSkill(delayedRpg, phantom, delayedTarget, phantomSkill);
    const scheduledTurns = delayedRpg.battle.delayedEffects.map(effect => effect.turn);

    const processedMessages = [];
    for (let turn = 2; turn <= 6; turn += 1) {
      delayedRpg.logs.length = 0;
      delayedRpg.battle.turn = turn;
      BattleRuntime.TurnManager.startPlayerTurn(delayedRpg);
      processedMessages.push(...delayedRpg.logs.filter(message => nightmareMessages.includes(message)));
    }

    const stackedSource = cloneCard('phantom');
    const stackedTarget = makeDummy({}, { hp: 99999, mdef: 100 });
    const stackedRpg = makeRpg({ deck: ['phantom', null, null], enemy: stackedTarget, players: [stackedSource, null, null], turn: 1 });
    BattleRuntime.executeSkill(stackedRpg, stackedSource, stackedTarget, stackedSource.skills[1]);
    BattleRuntime.executeSkill(stackedRpg, stackedSource, stackedTarget, stackedSource.skills[1]);
    stackedRpg.logs.length = 0;
    stackedRpg.battle.turn = 2;
    BattleRuntime.TurnManager.startPlayerTurn(stackedRpg);
    const stackedFirstMessageCount = stackedRpg.logs.filter(message => message === '첫번째 악몽이 시작된다.').length;

    const instantSource = cloneCard('phantom');
    const instantTarget = makeDummy({}, { hp: 99999, mdef: 100 });
    const instantRpg = makeRpg({
      deck: ['phantom', 'time_magician', null],
      enemy: instantTarget,
      activeTraits: ['instant_delayed_skills'],
      players: [instantSource, null, null],
      turn: 1
    });
    BattleRuntime.executeSkill(instantRpg, instantSource, instantTarget, instantSource.skills[1]);
    const instantMessageCount = instantRpg.logs.filter(message => nightmareMessages.includes(message)).length;

    const critSource = cloneCard('sphinx');
    critSource.mp = 80;
    const critTarget = makeDummy();
    const critRpg = makeRpg({
      deck: ['sphinx', null, null],
      enemy: critTarget,
      artifacts: ['lucky_vicky'],
      players: [critSource, null, null],
      turn: 1
    });
    const critSkill = { name: '검증용 강타', type: 'phy', tier: 1, cost: 0, val: 1.0, effects: [{ type: 'force_crit' }] };
    BattleRuntime.executeSkill(critRpg, critSource, critTarget, critSkill);

    const sylphid = cloneCard('sylphid');
    const galeTarget = makeDummy();
    const galeRpg = makeRpg({
      deck: ['sylphid', null, null],
      enemy: galeTarget,
      players: [sylphid, null, null],
      turn: 1
    });
    BattleRuntime.applySkillEffects(galeRpg, sylphid, galeTarget, sylphid.skills[1]);
    const galeBuff = galeRpg.battle.fieldBuffs.find(buff => buff.name === 'gale');

    const refreshedSylphid = cloneCard('sylphid');
    const refreshedRpg = makeRpg({
      deck: ['sylphid', null, null],
      enemy: makeDummy(),
      players: [refreshedSylphid, null, null],
      turn: 2,
      fieldBuffs: [{ name: 'gale', expiresAtTurn: 4, expireLog: '[아티팩트] 질풍 종료' }]
    });
    BattleRuntime.applySkillEffects(refreshedRpg, refreshedSylphid, refreshedRpg.battle.enemy, refreshedSylphid.skills[1]);
    const refreshedGale = refreshedRpg.battle.fieldBuffs.find(buff => buff.name === 'gale');
    const refreshedGaleCount = refreshedRpg.battle.fieldBuffs.length;
    const refreshedGaleLogs = [...refreshedRpg.logs];
    refreshedRpg.logs.length = 0;
    BattleRuntime.expireFieldBuffs(refreshedRpg, 4);
    const galeRemainsOnTurnFour = refreshedRpg.battle.fieldBuffs.some(buff => buff.name === 'gale');
    BattleRuntime.expireFieldBuffs(refreshedRpg, 5);
    const galeRemainsOnTurnFive = refreshedRpg.battle.fieldBuffs.some(buff => buff.name === 'gale');

    const valentineStats = Logic.calculateStats(cloneCard('rumi_valentine'), [{ name: 'valentine' }], 'origin', [], 1);
    const temptationStats = Logic.calculateStats(makeDummy({ curse: 1, temptation: 1 }, { mdef: 100 }), [], 'origin', [], 1);

    const valentineRumi = cloneCard('rumi_valentine');
    const valentineRpg = makeRpg({
      deck: ['rumi_valentine', 'jasmine', null],
      enemy: makeDummy(),
      activeTraits: ['syn_water_light_heart_star'],
      players: [valentineRumi, null, null],
      turn: 1
    });
    BattleRuntime.applySkillEffects(valentineRpg, valentineRumi, valentineRpg.battle.enemy, valentineRumi.skills[1]);
    const valentineBuffNames = valentineRpg.battle.fieldBuffs.map(buff => buff.name).sort();

    const swimsuitRumi = cloneCard('rumi_swimsuit');
    const swimsuitRpg = makeRpg({
      deck: ['rumi_swimsuit', 'jasmine', null],
      enemy: makeDummy(),
      activeTraits: ['syn_water_light_midnight_twinkle'],
      players: [swimsuitRumi, null, null],
      turn: 1
    });
    BattleRuntime.applySkillEffects(swimsuitRpg, swimsuitRumi, swimsuitRpg.battle.enemy, swimsuitRumi.skills[1]);
    const swimsuitBuffNames = swimsuitRpg.battle.fieldBuffs.map(buff => buff.name).sort();

    const dreamSource = cloneCard('trans_lumi');
    const dreamTarget = makeDummy({}, { hp: 99999, mdef: 100 });
    const dreamRpg = makeRpg({
      deck: ['trans_lumi', null, null],
      enemy: dreamTarget,
      players: [dreamSource, null, null],
      turn: 1,
      fieldBuffs: [{ name: 'gale' }, { name: 'arena' }]
    });
    BattleRuntime.executeSkill(dreamRpg, dreamSource, dreamTarget, dreamSource.skills[2]);
    const dreamLogs = [...dreamRpg.logs];

    BattleRuntime.TurnManager.endPlayerTurn = originalEndPlayerTurn;
    Math.random = originalRandom;

    return {
      sphinxDef: sphinxStats.stats.def,
      candyMatk: candyStats.stats.matk,
      priestAtk: priestStats.stats.atk,
      priestDef: priestStats.stats.def,
      priestMatk: priestStats.stats.matk,
      priestMdef: priestStats.stats.mdef,
      priestDelayTurns: priest.skills[2].effects[0].turns,
      priestMultiplier: priest.skills[2].val,
      phantomMatkBase: phantomBaseStats.matk,
      phantomMatkWithField: phantomFieldStats.matk,
      lunaMatkBase: lunaBaseStats.matk,
      lunaMatkWithField: lunaFieldStats.matk,
      noBuffDamage: noBuffDamage.dmg,
      divineDamage: divineDamage.dmg,
      darknessDamage: darknessDamage.dmg,
      divinePostActions: divineDamage.postActions.map(action => action.kind),
      lunaDamage: lunaDamage.dmg,
      expectedLunaDamage,
      lunaFieldBuffCountAfterCalc: mutableFieldBuffs.length,
      lunaPostActions: lunaDamage.postActions.map(action => action.kind),
      scheduledTurns,
      processedMessages,
      stackedDelayedCount: stackedRpg.battle.delayedEffects.length,
      stackedFirstMessageCount,
      instantDelayedCount: instantRpg.battle.delayedEffects.length,
      instantMessageCount,
      instantTargetHpLoss: 99999 - instantTarget.hp,
      luckyVickyMp: critSource.mp,
      galeExpiresAtTurn: galeBuff ? galeBuff.expiresAtTurn : null,
      galeBuffCount: galeRpg.battle.fieldBuffs.length,
      refreshedGaleExpiresAtTurn: refreshedGale ? refreshedGale.expiresAtTurn : null,
      refreshedGaleCount,
      refreshedGaleLogs,
      galeRemainsOnTurnFour,
      galeRemainsOnTurnFive,
      valentineDef: valentineStats.def,
      valentineMdef: valentineStats.mdef,
      temptationMdef: temptationStats.mdef,
      valentineBuffNames,
      swimsuitBuffNames,
      dreamLogs
    };
  });

  assert(result.sphinxDef === 75, `스핑크스 선봉 방어력 증가 수치가 기대값과 다릅니다: ${result.sphinxDef}`);
  assert(result.candyMatk === 105, `캔디보이 마법공격력 50% 상승 수치가 기대값과 다릅니다: ${result.candyMatk}`);
  assert(result.priestAtk === 77 && result.priestDef === 112 && result.priestMatk === 147 && result.priestMdef === 112, '종말의사제 어둠 3장 특성 수치가 기대값과 다릅니다.');
  assert(result.priestDelayTurns === 4 && result.priestMultiplier === 4, '종말의사제 사신강림 데이터가 4턴/4배율로 변경되지 않았습니다.');

  assert(result.phantomMatkBase === result.phantomMatkWithField, '팬텀이 필드버프 면역인데 필드버프 수치를 받았습니다.');
  assert(result.lunaMatkWithField > result.lunaMatkBase, '비면역 카드가 필드버프 수치를 받지 못했습니다.');

  assert(result.divineDamage === result.noBuffDamage, '타락의낙인이 같은 타격에서 새 암흑을 참조했습니다.');
  assert(result.darknessDamage > result.noBuffDamage, '암흑 상태 대상 추가 대미지 특성이 동작하지 않았습니다.');
  assert(result.divinePostActions.includes('remove_target_stack') && result.divinePostActions.includes('add_target_buff'), '타락의낙인 후처리 액션이 누락되었습니다.');

  assert(result.lunaDamage === result.expectedLunaDamage, `필드버프 제거 스킬이 현재 타격에서 필드버프 수치를 유지하지 못했습니다: actual=${result.lunaDamage}, expected=${result.expectedLunaDamage}`);
  assert(result.lunaFieldBuffCountAfterCalc === 1, 'calculateDamage가 실제 필드버프 배열을 훼손했습니다.');
  assert(result.lunaPostActions.includes('remove_first_field_buff'), '필드버프 제거 후처리 액션이 누락되었습니다.');

  assert(JSON.stringify(result.scheduledTurns) === JSON.stringify([2, 3, 4, 5, 6]), `팬텀 나이트메어 예약 턴이 올바르지 않습니다: ${JSON.stringify(result.scheduledTurns)}`);
  assert(JSON.stringify(result.processedMessages) === JSON.stringify([
    '첫번째 악몽이 시작된다.',
    '두번째 악몽이 시작된다.',
    '세번째 악몽이 시작된다.',
    '네번째 악몽이 시작된다.',
    '마지막 악몽이 시작된다.'
  ]), `팬텀 악몽 턴별 메시지 출력이 올바르지 않습니다: ${JSON.stringify(result.processedMessages)}`);
  assert(result.stackedDelayedCount === 8 && result.stackedFirstMessageCount === 2, '팬텀 악몽 중첩 사용 시 첫 턴 2회 발동이 확인되지 않았습니다.');
  assert(result.instantDelayedCount === 0 && result.instantMessageCount === 5 && result.instantTargetHpLoss > 0, '시간의마술사 조합 즉발 처리가 올바르지 않습니다.');

  assert(result.luckyVickyMp === 90, `럭키비키 치명타 MP 회복이 유지되지 않았습니다: ${result.luckyVickyMp}`);
  assert(result.galeExpiresAtTurn === 4 && result.galeBuffCount === 1, `실프스탭 3턴 질풍 부여가 잘못되었습니다: expiresAt=${result.galeExpiresAtTurn}, count=${result.galeBuffCount}`);
  assert(result.refreshedGaleExpiresAtTurn === 5 && result.refreshedGaleCount === 1, `기존 질풍 갱신이 잘못되었습니다: expiresAt=${result.refreshedGaleExpiresAtTurn}, count=${result.refreshedGaleCount}`);
  assert(result.refreshedGaleLogs.some(message => message.includes('지속 턴 갱신')), '기존 질풍 갱신 로그가 남지 않았습니다.');
  assert(result.galeRemainsOnTurnFour === true && result.galeRemainsOnTurnFive === false, '갱신된 질풍의 만료 턴 계산이 잘못되었습니다.');
  assert(result.valentineDef === 120 && result.valentineMdef === 135, `발렌타인 필드버프 수치가 잘못되었습니다: DEF=${result.valentineDef}, MDEF=${result.valentineMdef}`);
  assert(result.temptationMdef === 60, `유혹과 저주 중첩 마법방어 감소가 잘못되었습니다: MDEF=${result.temptationMdef}`);
  assert(JSON.stringify(result.valentineBuffNames) === JSON.stringify(['star_powder', 'valentine']), `루미(발렌타인) 추가 발동이 잘못되었습니다: ${JSON.stringify(result.valentineBuffNames)}`);
  assert(JSON.stringify(result.swimsuitBuffNames) === JSON.stringify(['sun_bless', 'twinkle_party']), `루미(수영복) 추가 발동이 잘못되었습니다: ${JSON.stringify(result.swimsuitBuffNames)}`);
  assert(result.dreamLogs.some(message => message.includes('필드 버프 2개 융합 계산!') && message.includes('질풍(3.0배)') && message.includes('아레나(4.0배)')), '꿈의형태 융합 로그가 필드버프별로 통일되지 않았습니다.');
  assert(!result.dreamLogs.some(message => message.includes('[융합]')), `꿈의형태에 별도 특수 융합 로그가 남아 있습니다: ${result.dreamLogs.join(' | ')}`);
  assert(!result.dreamLogs.some(message => message.includes('초월 효과 발동!')), `순수 배율 버프가 꿈의형태 버프 소모 로그에 포함되었습니다: ${result.dreamLogs.join(' | ')}`);

  return result;
}

async function verifyRemasterSync(page) {
  const result = await page.evaluate(() => {
    RPG.startGame('new');
    RPG.tempGameType = 'endless';
    RPG.global.unlocked_bonus_cards = [];
    RPG.openModeSelect();

    const chaosVisible = (() => {
      const button = document.getElementById('btn-chaos-roulette');
      return !!button && getComputedStyle(button).display !== 'none';
    })();

    RPG.global.weeklyMission = null;
    RPG.global.lastAttendanceDate = null;
    RPG.global.chaosTickets = 0;
    RPG.ensureWeeklyMissionState();
    RPG.trackDailyAttendance();
    RPG.openMonthlyMission();

    RPG.tempGameType = 'challenge';
    RPG.global.unlocked_bonus_cards = [];
    RPG.initNewGame('origin');

    return {
      chaosVisible,
      attendanceProgress: RPG.global.weeklyMission.missions.attendance3.progress,
      weeklyRewardName: document.getElementById('weekly-mission-reward-name').innerText.trim(),
      hasRumi: RPG.state.inventory.includes('rumi')
    };
  });

  assert(result.chaosVisible, '리마스터에서 엔드리스 카오스 룰렛 버튼이 노출되지 않았습니다.');
  assert(result.attendanceProgress === 1, '리마스터에서 주간 출석 미션이 증가하지 않았습니다.');
  assert(result.weeklyRewardName.includes('카오스 티켓 3장'), '리마스터 주간 미션 보상 표기가 올바르지 않습니다.');
  assert(result.hasRumi, '리마스터 초보자 챌린지 안전장치가 적용되지 않았습니다.');

  return result;
}

async function main() {
  const server = createStaticServer(ROOT);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const browser = await chromium.launch({ headless: true });
  const results = [];

  try {
    results.push({
      name: '질문하기 플로',
      details: await withPage(browser, baseUrl, 'card/index.html', verifyLumiQuestionFlow)
    });
    results.push({
      name: '메인 UI 및 주간미션 플로',
      details: await withPage(browser, baseUrl, 'card/index.html', verifyMainUiAndMissionFlow)
    });
    results.push({
      name: '초보 안전장치 및 챌린지 보상',
      details: await withPage(browser, baseUrl, 'card/index.html', verifyBeginnerSafetyAndClearReward)
    });
    results.push({
      name: '전투 규칙 검증',
      details: await withPage(browser, baseUrl, 'card/index.html', verifyCombatRules)
    });
    results.push({
      name: '리마스터 동기화 검증',
      details: await withPage(browser, baseUrl, 'card_remaster/index.html', verifyRemasterSync)
    });
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }

  results.forEach(result => {
    console.log(`[PASS] ${result.name}`);
    console.log(JSON.stringify(result.details, null, 2));
  });
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});

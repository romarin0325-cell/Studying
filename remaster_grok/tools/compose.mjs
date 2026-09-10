import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const cardRoot = path.join(root, '..', 'card');
const srcDir = path.join(root, 'src');

const chrome = `    <svg class="ui-icon-sprite" aria-hidden="true" focusable="false">
        <symbol id="icon-menu" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></symbol>
        <symbol id="icon-back" viewBox="0 0 24 24"><path d="m15 5-7 7 7 7"/></symbol>
        <symbol id="icon-cards" viewBox="0 0 24 24"><path d="m7 4 12 3-3 13-12-3z"/></symbol>
        <symbol id="icon-library" viewBox="0 0 24 24"><path d="M5 4h4v16H5zM10 4h4v16h-4zM15 5l4-1 2 15-4 1z"/></symbol>
        <symbol id="icon-mission" viewBox="0 0 24 24"><path d="M6 3h12v18H6z"/><path d="m9 9 2 2 4-4"/></symbol>
        <symbol id="icon-chat" viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z"/></symbol>
    </svg>
    <canvas id="azure-sky" aria-hidden="true"></canvas>
    <div id="app" data-screen="screen-title">
    <header class="brand-bar" id="brand-bar"><span class="brand-mark">✧</span><span class="brand-name">Azure Archive</span><span class="brand-sub">창공 서고</span></header>
    <div class="container">
        <div id="screen-title" class="screen active">
            <div class="title-stage">
                <img class="title-hero-art" data-image-src="루미.png" alt="">
                <div class="title-copy">
                    <span class="kicker">STARLIGHT ARCANE LIBRARY</span>
                    <h1>창공 서고</h1>
                    <p class="title-en">AZURE ARCHIVE</p>
                    <p class="title-quote">가장 어두운 밤에도, 별은 네 곁에.</p>
                </div>
            </div>
            <div id="title-loading" class="title-loading">서고를 여는 중...</div>
            <div class="title-screen-actions">
                <button id="btn-start-load" class="menu-btn title-cta" onclick="RPG.startGame('load')" disabled>이어하기</button>
                <button id="btn-start-new" class="menu-btn title-ghost" onclick="RPG.startGame('new')" disabled>새로하기</button>
                <nav class="title-dock" aria-label="타이틀 유틸리티">
                    <button id="btn-fortune-cookie" class="menu-btn" disabled><span class="dock-ico">🥠</span>포춘</button>
                    <button id="btn-title-question" class="menu-btn" onclick="RPG.openLumiQuestion()" disabled><span class="dock-ico">✧</span>질문</button>
                    <button id="btn-title-mission" class="menu-btn" onclick="RPG.openMissionHub()" disabled><span class="dock-ico">▣</span>미션</button>
                    <button id="btn-title-music" class="menu-btn" onclick="MusicPlayer.open()" disabled><span class="dock-ico">♪</span>음악</button>
                    <button id="btn-game-fullscreen" class="menu-btn" type="button" onclick="RPG.toggleGameFullscreen()" aria-pressed="false"><span class="dock-ico">⛶</span>전체화면</button>
                </nav>
            </div>
        </div>
        <div id="screen-menu" class="screen">
            <div class="run-hub-scroll">
                <div class="run-status-bar">
                    <div class="run-status-copy"><strong id="hub-mode-name">오리진</strong><span id="hub-run-meta">일반 · Stage 1</span></div>
                    <div class="run-ticket-pill"><span>티켓</span><strong id="ui-tickets">0</strong></div>
                    <button class="icon-button" onclick="RPG.openSystemMenu()" aria-label="시스템 메뉴"><svg><use href="#icon-menu"></use></svg></button>
                </div>
                <div id="next-enemy-preview" class="next-battle-card">
                    <div class="next-battle-copy"><span id="hub-stage-text">Stage 1</span><strong id="next-enemy-text">다음 상대</strong></div>
                    <div class="portrait enemy-preview-portrait"><img id="next-enemy-img" alt="다음 상대"></div>
                    <button class="menu-btn btn-cta-battle" onclick="RPG.startBattleInit()"><span>출격</span><small>현재 덱으로 전투 진입</small></button>
                </div>
                <section class="hub-section">
                    <div class="hub-section-heading"><h2>현재 파티</h2><span>선봉 · 중견 · 대장</span></div>
                    <button id="hub-party-strip" class="hub-party-strip" onclick="RPG.openDeck()" aria-label="덱 구성 열기">
                        <span id="hub-party-slot-0" class="hub-party-slot is-empty" data-role="선봉" data-fallback="-"><img id="hub-party-img-0" alt=""><span class="hub-party-name">비어 있음</span></span>
                        <span id="hub-party-slot-1" class="hub-party-slot is-empty" data-role="중견" data-fallback="-"><img id="hub-party-img-1" alt=""><span class="hub-party-name">비어 있음</span></span>
                        <span id="hub-party-slot-2" class="hub-party-slot is-empty" data-role="대장" data-fallback="-"><img id="hub-party-img-2" alt=""><span class="hub-party-name">비어 있음</span></span>
                    </button>
                </section>
                <section class="hub-section">
                    <div class="hub-section-heading"><h2>준비</h2></div>
                    <div class="hub-action-grid">
                        <div id="menu-gacha-area" class="hub-mode-actions" style="display:flex;">
                            <button id="btn-normal-gacha" class="menu-btn" onclick="RPG.openGacha()">일반 뽑기</button>
                            <button id="btn-challenge-gacha" class="menu-btn accent-epic" onclick="RPG.openChallengeGacha()">도전 뽑기</button>
                        </div>
                        <div id="menu-draft-area" class="hub-mode-actions" style="display:none;">
                            <button class="menu-btn accent-support" onclick="RPG.startDraft()">덱 빌딩</button>
                        </div>
                        <div id="menu-chaos-area" class="hub-mode-actions" style="display:none;">
                            <button id="btn-menu-artifact-check" class="menu-btn accent-gold" onclick="RPG.openArtifactCheck()" style="display:none;">아티팩트</button>
                            <button class="menu-btn accent-danger" onclick="RPG.reshuffleChaosPool()">카오스 셔플</button>
                        </div>
                        <button class="menu-btn" onclick="RPG.openDeck()">덱 구성</button>
                        <button class="menu-btn accent-gold" onclick="RPG.openChaosBlessing()">축복의 제단</button>
                    </div>
                </section>
            </div>
            <nav class="hub-action-dock" aria-label="보조 메뉴">
                <button onclick="RPG.openCollection()"><svg><use href="#icon-cards"></use></svg><span>카드</span></button>
                <button onclick="RPG.openLibrary()"><svg><use href="#icon-library"></use></svg><span>도서관</span></button>
                <button onclick="RPG.openMissionHub()"><svg><use href="#icon-mission"></use></svg><span>미션</span></button>
                <button onclick="RPG.openLumiQuestion()"><svg><use href="#icon-chat"></use></svg><span>질문</span></button>
            </nav>
        </div>
`;

const extraScreens = `        <div id="screen-battle" class="screen">
            <div class="battle-header">
                <div class="battle-header-left">
                    <span>Turn <span id="bt-turn">1</span></span>
                    <button id="btn-battle-artifact-check" class="battle-artifact-btn" onclick="RPG.openArtifactCheck()">아티팩트</button>
                </div>
                <div id="field-buff-box" class="field-buffs" onclick="RPG.showFieldBuffInfo()"></div>
            </div>
            <div class="visual-stage">
                <div id="player-actor-box" class="battle-actor player" onclick="RPG.showBattleStat('player', RPG.battle.currentPlayerIdx)">
                    <div id="p-name">Player</div>
                    <div class="portrait"><img id="p-img"></div>
                    <div class="actor-hp-bar"><div id="p-hp-bar" class="actor-hp-fill"></div></div>
                    <div class="actor-mp-bar"><div id="p-mp-bar" class="actor-mp-fill"></div></div>
                    <div id="p-buffs" class="actor-buffs"></div>
                </div>
                <div class="battle-vs">vs</div>
                <div id="enemy-actor-box" class="battle-actor enemy" onclick="RPG.showBattleStat('enemy', 0)">
                    <div id="e-name">Enemy</div>
                    <div class="portrait"><img id="e-img"></div>
                    <div class="actor-hp-bar"><div id="e-hp-bar" class="actor-hp-fill"></div></div>
                    <div id="e-buffs" class="actor-buffs"></div>
                </div>
            </div>
            <button id="battle-log-toggle" class="battle-log-toggle" type="button" aria-expanded="true">전투 기록</button>
            <div id="battle-log" class="log-container"></div>
            <div id="battle-controls" class="control-panel"></div>
        </div>
    </div>
`;

function mustReplace(html, pattern, replacement, label) {
  const next = html.replace(pattern, replacement);
  if (next === html) throw new Error(`compose failed: ${label}`);
  return next;
}

function compose() {
  let html = fs.readFileSync(path.join(cardRoot, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
  html = mustReplace(html, '<title>Card RPG</title>', '<title>창공 서고 · Azure Archive</title>', 'title');
  html = mustReplace(
    html,
    /<style>[\s\S]*?<\/style>\s*<link rel="stylesheet" href="music_player.css">/,
    `<link rel="stylesheet" href="music_player.css">
    <link rel="stylesheet" href="theme.css">
    <script src="portraits.js"></script>
    <script src="sky.js"></script>
    <script src="shell.js"></script>`,
    'head assets'
  );
  html = mustReplace(html, /<body>[\s\S]*?<div id="screen-factory-draft"/, `<body>\n${chrome}        <div id="screen-factory-draft"`, 'title/hub chrome');
  html = mustReplace(html, /<div id="screen-battle" class="screen">[\s\S]*?<div id="modal-mode-select"/, `${extraScreens}\n    <div id="modal-mode-select"`, 'battle chrome');
  html = mustReplace(
    html,
    `        document.addEventListener('DOMContentLoaded', () => {
            ImageAssets.hydrate(document);
            RPG.bindGameFullscreen();
            RPG.waitForInitialDataLoad();
        });`,
    `        document.addEventListener('DOMContentLoaded', () => {
            if (window.AzureShell) AzureShell.install(RPG, ImageAssets);
            else ImageAssets.hydrate(document);
            RPG.bindGameFullscreen();
            RPG.waitForInitialDataLoad();
        });`,
    'boot hook'
  );
  html = mustReplace(html, '</body>', '    </div>\n</body>', 'app close');
  fs.mkdirSync(srcDir, { recursive: true });
  fs.writeFileSync(path.join(srcDir, 'index.html'), html);
  console.log('composed src/index.html');
}

compose();

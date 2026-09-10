/**
 * Celestial Azure UI Controller & View Enhancer
 * Manages modern Hub navigation dock, vanguard showcase,
 * floating combat numbers, Web Audio interactions, and screen sync.
 */
const AppView = {
    activeTab: 'lobby',

    init() {
        this.injectBottomDock();
        this.enhanceHubLayout();
        this.bindGlobalSounds();
        console.log('[Celestial Azure] AppView initialized successfully.');
    },

    // Audio click binding
    bindGlobalSounds() {
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('button, .menu-btn, .card-item, .dock-tab');
            if (btn && window.SFX && typeof SFX.click === 'function') {
                SFX.click();
            }
        });
    },

    // Bottom Navigation Dock
    injectBottomDock() {
        if (document.getElementById('hub-navigation-dock')) return;

        const dock = document.createElement('nav');
        dock.id = 'hub-navigation-dock';
        dock.className = 'hub-navigation-dock';
        dock.innerHTML = `
            <button class="dock-tab active" data-tab="lobby" onclick="AppView.switchTab('lobby')">
                <span class="dock-icon">🏰</span>
                <span>로비</span>
            </button>
            <button class="dock-tab" data-tab="deck" onclick="AppView.switchTab('deck')">
                <span class="dock-icon">⚔️</span>
                <span>덱 편성</span>
            </button>
            <button class="dock-tab" data-tab="cards" onclick="AppView.switchTab('cards')">
                <span class="dock-icon">🃏</span>
                <span>카드 도감</span>
            </button>
            <button class="dock-tab" data-tab="library" onclick="AppView.switchTab('library')">
                <span class="dock-icon">📖</span>
                <span>서고·학습</span>
            </button>
            <button class="dock-tab" data-tab="sanctuary" onclick="AppView.switchTab('sanctuary')">
                <span class="dock-icon">🔮</span>
                <span>성소·소환</span>
            </button>
        `;

        const container = document.querySelector('.container');
        if (container) {
            container.appendChild(dock);
        }
    },

    syncDockUI(tab) {
        this.activeTab = tab;
        document.querySelectorAll('.dock-tab').forEach(el => {
            el.classList.toggle('active', el.dataset.tab === tab);
        });
    },

    syncDockWithScreen(screenId) {
        const screenToTab = {
            'screen-menu': 'lobby',
            'screen-deck': 'deck',
            'screen-collection': 'cards',
            'screen-library': 'library',
            'screen-study': 'library',
            'screen-toeic': 'library',
            'screen-toeic-select': 'library',
            'screen-toeic-result': 'library'
        };
        const tab = screenToTab[screenId];
        if (tab) {
            this.syncDockUI(tab);
        }
    },

    switchTab(tab) {
        this.syncDockUI(tab);

        if (typeof RPG === 'undefined') return;

        switch (tab) {
            case 'lobby':
                RPG.toMenu();
                break;
            case 'deck':
                RPG.openDeck();
                break;
            case 'cards':
                RPG.openCollection();
                break;
            case 'library':
                RPG.openLibrary();
                break;
            case 'sanctuary':
                this.openSanctuaryModal();
                break;
        }
    },

    // Sanctuary Hub Modal with Dynamic Mode Actions
    openSanctuaryModal() {
        let modal = document.getElementById('modal-sanctuary-hub');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-sanctuary-hub';
            modal.className = 'modal';
            document.body.appendChild(modal);
        }

        const allowed = (typeof RPG !== 'undefined' && RPG.getAllowedModeActions)
            ? RPG.getAllowedModeActions()
            : { canNormalGacha: true, canChallengeGacha: true, canDraft: false, canChaosBlessing: false };

        const mode = (typeof RPG !== 'undefined' && RPG.state) ? RPG.state.mode : 'origin';

        let buttonsHtml = '';
        if (allowed.canNormalGacha) {
            buttonsHtml += `
                <button class="menu-btn" onclick="RPG.openGacha(); AppView.closeSanctuaryModal();" style="border-color: #38bdf8; color: #7dd3fc;">
                    ✨ 일반 소환 (티켓 1장)
                </button>
            `;
        }
        if (allowed.canChallengeGacha) {
            buttonsHtml += `
                <button class="menu-btn" onclick="RPG.openChallengeGacha(); AppView.closeSanctuaryModal();" style="border-color: #c084fc; color: #e879f9;">
                    🔮 도전 소환 (고급 퀴즈 소환)
                </button>
            `;
        }
        if (allowed.canChaosBlessing) {
            buttonsHtml += `
                <button class="menu-btn" onclick="RPG.openChaosBlessing(); AppView.closeSanctuaryModal();" style="border-color: #fbbf24; color: #fde047;">
                    ⚡ 축복의 제단 (카오스 축복)
                </button>
            `;
        }
        if (allowed.canDraft) {
            buttonsHtml += `
                <button class="menu-btn" onclick="if (RPG.startDraft) RPG.startDraft(); AppView.closeSanctuaryModal();" style="border-color: #34d399; color: #6ee7b7;">
                    🃏 덱 빌딩 (드래프트)
                </button>
            `;
        }
        // Fortune Cookie is always available as daily study feature
        buttonsHtml += `
            <button class="menu-btn" id="btn-sanctuary-fortune" onclick="AppView.openFortuneFromSanctuary();" style="border-color: #f472b6; color: #f472b6;">
                🥠 오늘의 포춘쿠키 (리스닝 학습)
            </button>
        `;

        modal.innerHTML = `
            <div class="modal-content" style="max-width: 440px; width: 92%;">
                <h2 style="margin-top: 0; text-align: center; color: var(--primary-light);">🔮 별의 성소 (Sanctuary)</h2>
                <p style="text-align: center; color: #94a3b8; font-size: 0.88rem; margin-bottom: 16px;">
                    [${mode.toUpperCase()}] 별의 인도에 따라 소환과 축복을 진행합니다.
                </p>
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    ${buttonsHtml}
                </div>
                <button class="menu-btn" onclick="AppView.closeSanctuaryModal();" style="margin-top: 18px; width: 100%;">
                    닫기
                </button>
            </div>
        `;

        modal.classList.add('active');
    },

    openFortuneFromSanctuary() {
        this.closeSanctuaryModal();
        if (typeof FortuneCookie !== 'undefined' && typeof FortuneCookie.open === 'function') {
            FortuneCookie.open();
        } else if (window.FortuneCookie && typeof window.FortuneCookie.open === 'function') {
            window.FortuneCookie.open();
        } else {
            alert('포춘쿠키 모듈이 준비되지 않았습니다.');
        }
    },

    closeSanctuaryModal() {
        const modal = document.getElementById('modal-sanctuary-hub');
        if (modal) modal.classList.remove('active');
        // Restore dock active tab to the visible screen
        const activeScreen = document.querySelector('.screen.active');
        if (activeScreen) {
            this.syncDockWithScreen(activeScreen.id);
        }
    },

    // Hub Layout Visual Polish
    enhanceHubLayout() {
        const menuScreen = document.getElementById('screen-menu');
        if (!menuScreen || menuScreen.dataset.enhanced) return;
        menuScreen.dataset.enhanced = 'true';

        // Add class to battle entry button
        const battleBtns = menuScreen.querySelectorAll('button');
        battleBtns.forEach(btn => {
            if (btn.innerText.includes('전투 진입') || (btn.getAttribute('onclick') || '').includes('startBattleInit')) {
                btn.classList.add('btn-sortie');
                btn.innerHTML = '⚔️ 전 투 출 격 (SORTIE)';
            }
        });
    },

    // Render 3-slot vanguard formation showcase in lobby
    renderLobbyVanguard(rpg) {
        let container = document.getElementById('lobby-vanguard-container');
        if (!container) {
            // Find insertion point before Sortie button
            const sortieBtn = document.querySelector('.btn-sortie');
            if (!sortieBtn) return;

            container = document.createElement('div');
            container.id = 'lobby-vanguard-container';
            container.className = 'lobby-vanguard-container';
            sortieBtn.parentElement.insertBefore(container, sortieBtn);
        }

        const deck = (rpg.state && Array.isArray(rpg.state.deck)) ? rpg.state.deck : [null, null, null];
        const slotNames = ['선봉', '중견', '대장'];
        const slotsHtml = slotNames.map((slotTitle, idx) => {
            const cardId = deck[idx];
            const card = cardId ? rpg.getCardData(cardId) : null;
            if (card) {
                const gradeClass = card.grade || 'normal';
                return `
                    <div class="vanguard-slot filled ${gradeClass}" onclick="RPG.openDeck()" title="${card.name} (${slotTitle})">
                        <span class="vanguard-slot-label">${slotTitle}</span>
                        <div class="vanguard-card-mini">
                            <span class="vanguard-card-name">${card.name}</span>
                            <span class="vanguard-card-grade ${gradeClass}">${card.grade.toUpperCase()}</span>
                        </div>
                    </div>
                `;
            } else {
                return `
                    <div class="vanguard-slot empty" onclick="RPG.openDeck()" title="슬롯 비어있음 - 클릭하여 편성">
                        <span class="vanguard-slot-label">${slotTitle}</span>
                        <div class="vanguard-empty-hint">+ 미편성</div>
                    </div>
                `;
            }
        }).join('');

        const isDeckIncomplete = deck.some(c => c === null);
        const warningHtml = isDeckIncomplete ? `
            <div class="vanguard-warning-bar" onclick="RPG.openDeck()">
                <span>⚠️ 출격 전 덱 3장을 모두 편성하세요 [덱 편성]</span>
            </div>
        ` : '';

        container.innerHTML = `
            <div class="vanguard-header">
                <span class="vanguard-title">⚔️ 출전 편대 (Vanguard Formation)</span>
                <button class="vanguard-edit-btn" onclick="RPG.openDeck()">편성 변경</button>
            </div>
            <div class="vanguard-slots-grid">
                ${slotsHtml}
            </div>
            ${warningHtml}
        `;
    },

    // Floating Combat Damage Text
    showDamage(amount, isCrit, x, y) {
        const span = document.createElement('span');
        span.className = 'floating-damage' + (isCrit ? ' crit' : '');
        span.innerText = (amount > 0 ? '-' : '+') + Math.abs(amount) + (isCrit ? ' CRIT!' : '');
        span.style.left = (x || (window.innerWidth / 2)) + 'px';
        span.style.top = (y || (window.innerHeight / 2)) + 'px';
        document.body.appendChild(span);
        setTimeout(() => span.remove(), 900);
    }
};

window.AppView = AppView;
document.addEventListener('DOMContentLoaded', () => {
    AppView.init();
});

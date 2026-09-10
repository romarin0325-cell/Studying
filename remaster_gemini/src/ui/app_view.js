/**
 * Celestial Azure UI Controller & View Enhancer
 * Manages modern Hub navigation dock, vanguard showcase,
 * floating combat numbers, Web Audio interactions, and fallback asset resolution.
 */
const AppView = {
    activeTab: 'lobby',

    init() {
        this.injectBottomDock();
        this.enhanceHubLayout();
        this.bindGlobalSounds();
        this.enhanceImageFallbacks();
        console.log('[Celestial Azure] AppView initialized successfully.');
    },

    // Audio click binding
    bindGlobalSounds() {
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('button, .menu-btn, .card-item, .dock-tab');
            if (btn && window.SFX) {
                SFX.click();
            }
        });
    },

    // Candidate paths for card portraits
    enhanceImageFallbacks() {
        if (typeof ImageAssets !== 'undefined' && ImageAssets.load) {
            const origLoad = ImageAssets.load.bind(ImageAssets);
            ImageAssets.load = (img, entity, options = {}) => {
                if (!img) return;
                origLoad(img, entity, options);

                const origError = img.onerror;
                img.onerror = () => {
                    const rawName = (typeof entity === 'string') ? entity : ((entity && entity.name) ? entity.name : '');
                    if (!rawName) return;
                    const cleanName = rawName.endsWith('.png') ? rawName : (rawName + '.png');
                    
                    const candidates = [
                        '../card/' + cleanName,
                        '../../card/' + cleanName,
                        'card/' + cleanName,
                        './' + cleanName
                    ];

                    let attempt = 0;
                    const tryNext = () => {
                        if (attempt >= candidates.length) {
                            if (origError) origError();
                            return;
                        }
                        const candidate = candidates[attempt++];
                        const testImg = new Image();
                        testImg.onload = () => {
                            img.src = candidate;
                            img.style.display = 'block';
                            if (options.parent && options.toggleParent) options.parent.style.display = '';
                        };
                        testImg.onerror = tryNext;
                        testImg.src = candidate;
                    };
                    tryNext();
                };
            };
        }
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

    switchTab(tab) {
        this.activeTab = tab;
        document.querySelectorAll('.dock-tab').forEach(el => {
            el.classList.toggle('active', el.dataset.tab === tab);
        });

        if (typeof RPG === 'undefined') return;

        switch (tab) {
            case 'lobby':
                RPG.showScreen('screen-menu');
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

    // Sanctuary Hub Modal (Gacha, Blessing Altar, Factory Draft, Fortune Cookie)
    openSanctuaryModal() {
        let modal = document.getElementById('modal-sanctuary-hub');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-sanctuary-hub';
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 440px; width: 92%;">
                    <h2 style="margin-top: 0; text-align: center; color: var(--primary-light);">🔮 별의 성소 (Sanctuary)</h2>
                    <p style="text-align: center; color: #94a3b8; font-size: 0.9rem; margin-bottom: 20px;">
                        신비로운 별의 힘으로 카드를 소환하고 카오스의 축복을 받으세요.
                    </p>
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        <button class="menu-btn" onclick="RPG.openGacha(); document.getElementById('modal-sanctuary-hub').classList.remove('active');" style="border-color: #38bdf8; color: #7dd3fc;">
                            ✨ 일반 뽑기 (티켓 1장)
                        </button>
                        <button class="menu-btn" onclick="RPG.openChallengeGacha(); document.getElementById('modal-sanctuary-hub').classList.remove('active');" style="border-color: #c084fc; color: #e879f9;">
                            🔮 도전 뽑기 (고급 소환)
                        </button>
                        <button class="menu-btn" onclick="RPG.openChaosBlessing(); document.getElementById('modal-sanctuary-hub').classList.remove('active');" style="border-color: #fbbf24; color: #fde047;">
                            ⚡ 축복의 제단 (카오스 축복)
                        </button>
                        <button class="menu-btn" onclick="if (RPG.startDraft) RPG.startDraft(); document.getElementById('modal-sanctuary-hub').classList.remove('active');" style="border-color: #34d399; color: #6ee7b7;">
                            🃏 덱 빌딩 (드래프트 모드)
                        </button>
                        <button class="menu-btn" onclick="if (window.FortuneCookie) FortuneCookie.open(); document.getElementById('modal-sanctuary-hub').classList.remove('active');" style="border-color: #f472b6; color: #f472b6;">
                            🥠 오늘의 포춘쿠키 (리스닝 학습)
                        </button>
                    </div>
                    <button class="menu-btn" onclick="document.getElementById('modal-sanctuary-hub').classList.remove('active');" style="margin-top: 20px; width: 100%;">
                        닫기
                    </button>
                </div>
            `;
            document.body.appendChild(modal);
        }
        modal.classList.add('active');
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

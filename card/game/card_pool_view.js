(function () {
    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text != null) node.textContent = text;
        return node;
    }

    function bindOnce(root, key, type, handler) {
        if (!root) return;
        const store = root._cardPoolHandlers || (root._cardPoolHandlers = {});
        if (store[key]) root.removeEventListener(type, store[key]);
        store[key] = handler;
        root.addEventListener(type, handler);
    }

    const CardPoolView = {
        render(root, model, actions) {
            if (!root || !model) return;
            const title = root.querySelector('#card-pool-editor-title');
            const summary = root.querySelector('#card-pool-editor-summary');
            const body = root.querySelector('#card-pool-editor-body');
            const setsTab = root.querySelector('#card-pool-tab-sets');
            const extrasTab = root.querySelector('#card-pool-tab-extras');
            if (title) title.textContent = '획득 카드풀 편집';
            if (summary) summary.textContent = model.summaryText || '';
            if (setsTab) {
                setsTab.setAttribute('aria-selected', model.tab === 'sets' ? 'true' : 'false');
            }
            if (extrasTab) {
                extrasTab.setAttribute('aria-selected', model.tab === 'extras' ? 'true' : 'false');
            }
            if (!body) return;
            body.replaceChildren();
            if (model.tab === 'sets') this.renderSets(body, model, actions);
            else this.renderExtras(body, model, actions);
        },

        renderSets(body, model, actions) {
            (model.sets || []).forEach(set => {
                const row = el('div', 'card-pool-set-row');
                row.appendChild(el('div', 'card-pool-set-name', set.name + (set.trial ? ' · 시험 기능' : '')));
                row.appendChild(el('div', 'card-pool-set-axis', [set.mainAxis].concat(set.subAxes || []).join(' · ')));
                row.appendChild(el('div', 'card-pool-card-meta', set.compositionText));
                row.appendChild(el('div', 'card-pool-card-status', set.statusText));
                const actionsRow = el('div', 'card-pool-actions');
                const detail = el('button', 'card-pool-row-action', '구성·해금 조건');
                detail.type = 'button';
                detail.addEventListener('click', () => actions.onOpenSetDetail(set.id));
                actionsRow.appendChild(detail);
                const use = el('button', 'card-pool-row-action', set.canUse ? '이 세트 사용' : '선택 불가');
                use.type = 'button';
                use.disabled = !set.canUse;
                if (set.canUse) use.addEventListener('click', () => actions.onSelectSet(set.id));
                actionsRow.appendChild(use);
                row.appendChild(actionsRow);
                body.appendChild(row);
            });
            if (model.detailSet) this.renderSetDetail(body, model, actions);
        },

        renderSetDetail(body, model, actions) {
            const wrap = el('div', 'card-pool-set-detail');
            const filters = el('div', 'card-pool-filter');
            ['all', 'locked', 'normal', 'rare', 'epic', 'legend'].forEach(key => {
                const labels = { all: '전체', locked: '미해금만', normal: '일반', rare: '레어', epic: '에픽', legend: '전설' };
                const btn = el('button', '', labels[key]);
                btn.type = 'button';
                btn.addEventListener('click', () => actions.onSetFilter(key));
                filters.appendChild(btn);
            });
            wrap.appendChild(filters);
            (model.detailCards || []).forEach(card => {
                wrap.appendChild(this.cardRow(card, {
                    onDetail: () => actions.onCardDetail(card.id)
                }));
            });
            body.appendChild(wrap);
        },

        renderExtras(body, model, actions) {
            const search = el('input', 'card-pool-search');
            search.type = 'search';
            search.placeholder = '카드 검색';
            search.value = model.search || '';
            search.addEventListener('input', () => actions.onSearch(search.value));
            body.appendChild(search);
            const filters = el('div', 'card-pool-filter');
            [{ id: 'all', label: '전체 후보' }, { id: 'selected', label: '선택됨' }, { id: 'base', label: '기본 포함 카드 보기' }].forEach(item => {
                const btn = el('button', '', item.label);
                btn.type = 'button';
                btn.addEventListener('click', () => actions.onExtraFilter(item.id));
                filters.appendChild(btn);
            });
            body.appendChild(filters);
            const tools = el('div', 'card-pool-actions');
            const clear = el('button', 'card-pool-row-action', '선택 비우기');
            clear.type = 'button';
            clear.addEventListener('click', () => actions.onClearExtras());
            const random = el('button', 'card-pool-row-action', '랜덤 15장');
            random.type = 'button';
            random.addEventListener('click', () => actions.onRandomExtras());
            tools.appendChild(clear);
            tools.appendChild(random);
            body.appendChild(tools);
            const grid = el('div', 'card-pool-extra-grid');
            (model.extraCards || []).forEach(card => {
                grid.appendChild(this.cardRow(card, {
                    onDetail: () => actions.onCardDetail(card.id),
                    onToggle: card.canToggle ? () => actions.onToggleExtra(card.id) : null,
                    selected: card.selected
                }));
            });
            body.appendChild(grid);
        },

        cardRow(card, options) {
            const row = el('div', 'card-pool-card-row' + (options.selected ? ' is-selected' : '') + (card.inBase ? ' is-base' : ''));
            if (typeof ImageAssets !== 'undefined' && ImageAssets.createPortrait) {
                row.appendChild(ImageAssets.createPortrait(card.data || { name: card.name, id: card.id }));
            } else {
                row.appendChild(el('div', 'portrait'));
            }
            const text = el('div', 'card-pool-card-text');
            const nameBtn = el('button', 'card-pool-card-name', card.name);
            nameBtn.type = 'button';
            nameBtn.addEventListener('click', options.onDetail);
            text.appendChild(nameBtn);
            text.appendChild(el('div', 'card-pool-card-meta', card.metaText));
            text.appendChild(el('div', 'card-pool-card-status', card.statusText));
            if (options.onToggle) {
                const toggle = el('button', 'card-pool-row-action', card.selected ? '제외' : '추가');
                toggle.type = 'button';
                toggle.addEventListener('click', options.onToggle);
                text.appendChild(toggle);
            } else if (card.inBase) {
                text.appendChild(el('div', 'card-pool-card-status', '기본 포함 · 추가 슬롯 미사용'));
            }
            row.appendChild(text);
            return row;
        },

        bindChrome(root, actions) {
            bindOnce(root.querySelector('#card-pool-tab-sets'), 'sets', 'click', () => actions.onTab('sets'));
            bindOnce(root.querySelector('#card-pool-tab-extras'), 'extras', 'click', () => actions.onTab('extras'));
            bindOnce(root.querySelector('#card-pool-editor-cancel'), 'cancel', 'click', () => actions.onCancel());
            bindOnce(root.querySelector('#card-pool-editor-save'), 'save', 'click', () => actions.onSave());
            bindOnce(root.querySelector('#card-pool-editor-close'), 'close', 'click', () => actions.onClose());
        }
    };

    window.CardPoolView = CardPoolView;
})();

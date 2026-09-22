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
            if (title) title.textContent = model.tab === 'sets' ? '세트 편집' : '덱 편집';
            root.dataset.editorTab = model.tab;
            if (summary) summary.textContent = model.summaryText || '';
            if (setsTab) {
                setsTab.setAttribute('aria-selected', model.tab === 'sets' ? 'true' : 'false');
            }
            if (extrasTab) {
                extrasTab.setAttribute('aria-selected', model.tab === 'extras' ? 'true' : 'false');
            }
            if (!body) return;
            const viewKey = model.tab + ':' + (model.detailSet ? model.detailSet.id : '') + ':' + model.filter;
            const scrollTop = body.dataset.viewKey === viewKey ? body.scrollTop : 0;
            const searchFocused = document.activeElement === body.querySelector('.card-pool-search');
            const focusedCard = document.activeElement?.closest('[data-card-id]')?.dataset.cardId;
            const focusedClass = document.activeElement?.className;
            const selection = searchFocused ? [document.activeElement.selectionStart, document.activeElement.selectionEnd] : null;
            body.replaceChildren();
            if (model.tab === 'sets') this.renderSets(body, model, actions);
            else this.renderExtras(body, model, actions);
            body.dataset.viewKey = viewKey;
            body.scrollTop = scrollTop;
            if (searchFocused) {
                const search = body.querySelector('.card-pool-search');
                search?.focus({ preventScroll: true });
                if (search && selection) search.setSelectionRange(...selection);
            } else if (focusedCard) {
                const row = [...body.querySelectorAll('[data-card-id]')].find(item => item.dataset.cardId === focusedCard);
                const button = row && [...row.querySelectorAll('button')].find(item => item.className === focusedClass);
                button?.focus({ preventScroll: true });
            }
        },

        renderSets(body, model, actions) {
            if (model.detailSet) {
                this.renderSetDetail(body, model, actions);
                return;
            }
            (model.sets || []).forEach(set => {
                const row = el('div', 'card-pool-set-row' + (set.selected ? ' is-selected' : ''));
                const heading = el('div', 'card-pool-set-heading');
                heading.appendChild(el('div', 'card-pool-set-name', set.name));
                heading.appendChild(el('span', 'card-pool-set-status', set.statusText));
                row.appendChild(heading);
                const actionsRow = el('div', 'card-pool-actions');
                const detail = el('button', 'card-pool-row-action', '구성 · 해금 ' + set.readyCount + '/' + set.total);
                detail.type = 'button';
                detail.addEventListener('click', () => actions.onOpenSetDetail(set.id));
                actionsRow.appendChild(detail);
                const use = el('button', 'card-pool-row-action', set.selected ? '선택됨' : (set.canUse ? '사용' : '미해금'));
                use.type = 'button';
                use.setAttribute('aria-pressed', String(set.selected));
                use.disabled = !set.canUse;
                if (set.canUse) use.addEventListener('click', () => actions.onSelectSet(set.id));
                actionsRow.appendChild(use);
                row.appendChild(actionsRow);
                body.appendChild(row);
            });
        },

        renderSetDetail(body, model, actions) {
            const wrap = el('div', 'card-pool-set-detail');
            const back = el('button', 'card-pool-row-action', '‹ 세트 목록');
            back.type = 'button';
            back.addEventListener('click', actions.onCloseSetDetail);
            wrap.appendChild(back);
            wrap.appendChild(el('h4', 'card-pool-detail-title', model.detailSet.name));
            const filters = el('div', 'card-pool-filter');
            ['all', 'locked', 'normal', 'rare', 'epic', 'legend'].forEach(key => {
                const labels = { all: '전체', locked: '미해금만', normal: '일반', rare: '레어', epic: '에픽', legend: '전설' };
                const btn = el('button', '', labels[key]);
                btn.type = 'button';
                btn.setAttribute('aria-pressed', String(model.filter === key));
                btn.addEventListener('click', () => actions.onSetFilter(key));
                filters.appendChild(btn);
            });
            wrap.appendChild(filters);
            if (!model.detailCards.length) wrap.appendChild(el('p', 'card-pool-empty', model.filter === 'locked' ? '모든 카드를 해금했습니다.' : '해당 카드가 없습니다.'));
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
            search.setAttribute('aria-label', '카드 검색');
            search.value = model.search || '';
            search.addEventListener('input', event => { if (!event.isComposing) actions.onSearch(search.value); });
            search.addEventListener('compositionend', () => actions.onSearch(search.value));
            body.appendChild(search);
            const filters = el('div', 'card-pool-filter');
            [{ id: 'all', label: '전체' }, { id: 'selected', label: '선택됨' }, { id: 'base', label: '기본 포함' }].forEach(item => {
                const btn = el('button', '', item.label);
                btn.type = 'button';
                btn.setAttribute('aria-pressed', String(model.filter === item.id));
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
                    onToggle: !card.inBase ? () => actions.onToggleExtra(card.id) : null,
                    selected: card.selected,
                    compact: true
                }));
            });
            body.appendChild(grid);
            if (!model.extraCards.length) body.appendChild(el('p', 'card-pool-empty', '해당 카드가 없습니다.'));
        },

        cardRow(card, options) {
            const row = el('div', 'card-pool-card-row' + (options.selected ? ' is-selected' : '') + (card.inBase ? ' is-base' : ''));
            row.dataset.cardId = card.id;
            if (options.compact) row.classList.add('is-compact');
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
            if (!options.compact) text.appendChild(el('div', 'card-pool-card-status', card.statusText));
            if (options.onToggle) {
                const toggle = el('button', 'card-pool-row-action', card.selected ? '제외' : '추가');
                toggle.type = 'button';
                toggle.disabled = !card.canToggle;
                toggle.setAttribute('aria-pressed', String(card.selected));
                toggle.setAttribute('aria-label', card.name + (card.selected ? ' 제외' : ' 추가'));
                toggle.addEventListener('click', options.onToggle);
                text.appendChild(toggle);
            } else if (options.compact && card.inBase) {
                text.appendChild(el('div', 'card-pool-base-label', '기본 포함'));
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

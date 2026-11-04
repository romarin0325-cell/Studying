/* Presentation hooks only. Rules, datasets and serialization live in card/game. */
const Legacy = {
  ready:false,
  transferReturn:null,
  transferFromMenu:false,
  transferFocusTop:null,
  transferFocusReturns:new WeakMap(),
  notify(message) { RPG.showAlert(message); },
  openTransfer() {
    this.transferReturn = document.activeElement;
    this.transferFromMenu = document.getElementById('modal-menu').classList.contains('active');
    document.getElementById('modal-menu').classList.remove('active');
    document.getElementById('modal-legacy-transfer').classList.add('active');
    document.getElementById('legacy-export').focus();
  },
  closeTransfer() {
    document.getElementById('modal-legacy-transfer').classList.remove('active');
    if (this.transferFromMenu) document.getElementById('modal-menu').classList.add('active');
    if (this.transferReturn?.isConnected) this.transferReturn.focus();
  },
  exportSave() { CardProgressTransfer.exportSave(message => this.notify(message)); },
  transferDialog() {
    if (!document.getElementById('modal-legacy-transfer').classList.contains('active')) return null;
    return [...document.querySelectorAll('#modal-legacy-transfer.active,#modal-confirm.active,#modal-info.active')]
      .sort((a,b) => Number(getComputedStyle(a).zIndex) - Number(getComputedStyle(b).zIndex)).at(-1);
  },
  transferControls(modal) {
    return [...modal.querySelectorAll('button:not(:disabled),input:not(:disabled),a[href],[tabindex="0"]')]
      .filter(node => node.getClientRects().length);
  },
  syncTransferFocus() {
    const next = this.transferDialog();
    const previous = this.transferFocusTop;
    if (next === previous) return;
    this.transferFocusTop = next;
    if (!next) return;
    let target;
    if (previous && Number(getComputedStyle(previous).zIndex) > Number(getComputedStyle(next).zIndex)) {
      target = this.transferFocusReturns.get(previous);
    } else {
      this.transferFocusReturns.set(next, document.activeElement);
    }
    if (!target || !next.contains(target) || !target.getClientRects().length) target = this.transferControls(next)[0];
    target?.focus();
  },
  init() {
    const sync = RPG.syncGameFullscreenButton.bind(RPG);
    RPG.syncGameFullscreenButton = () => {
      sync();
      const button = document.getElementById('btn-game-fullscreen');
      const label = button.textContent.replace('⛶', '').trim();
      button.setAttribute('aria-label', label);
      button.title = label;
      button.textContent = RPG.getGameFullscreenElement() ? '⛶−' : '⛶';
    };
    RPG.syncGameFullscreenButton();
    document.getElementById('legacy-import').addEventListener('change', event => {
      const input = event.target;
      CardProgressTransfer.importFile(input.files[0], {
        notify:message => this.notify(message),
        reset:() => { input.value = ''; }
      });
    });
    new MutationObserver(() => this.syncTransferFocus()).observe(document.body, {subtree:true, attributes:true, attributeFilter:['class']});
    document.addEventListener('keydown', event => {
      const top = this.transferDialog();
      if (!top) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        if (top.id === 'modal-confirm') document.getElementById('confirm-no').click();
        else if (top.id === 'modal-info') RPG.closeInfoModal();
        else this.closeTransfer();
      } else if (event.key === 'Tab') {
        const controls = this.transferControls(top);
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey && (document.activeElement === first || !top.contains(document.activeElement))) {
          event.preventDefault(); last?.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !top.contains(document.activeElement))) {
          event.preventDefault(); first?.focus();
        }
      }
    });
    this.ready = true;
  }
};
document.addEventListener('DOMContentLoaded', () => Legacy.init());

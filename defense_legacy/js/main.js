import { GameApp } from './app/GameApp.js';
import { ASSET_MANIFEST } from './content/assets.js';
import { validateContent } from './content/validateContent.js';

function showFatalError(error) {
  console.error(error);
  const root = document.querySelector('#scene-root');
  if (!root) return;
  root.innerHTML = `<section class="fatal-error"><h1>전장을 열지 못했어</h1><p>${String(error?.message ?? error)}</p><button type="button" onclick="location.reload()">다시 시도</button></section>`;
}

function boot() {
  try {
    validateContent({ throwOnError: true, assets: ASSET_MANIFEST });
    const app = new GameApp();
    app.start();
    globalThis.__heroDefenseV2App = app;
  } catch (error) {
    showFatalError(error);
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();

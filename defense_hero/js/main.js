import { GameApp } from "./app/GameApp.js";

const app = new GameApp({
  root: document.querySelector("#scene-root"),
  modalRoot: document.querySelector("#modal-root"),
  toast: document.querySelector("#toast"),
  backButton: document.querySelector("#back-button"),
  homeButton: document.querySelector("#home-button"),
  sceneKicker: document.querySelector("#scene-kicker"),
});

window.__heroDefenseDebug = {
  app,
  getState: () => app.getDebugState(),
  completeStage: () => app.debugCompleteStage(),
  failStage: () => app.debugFailStage(),
  setTimeScale: (value) => app.debugSetTimeScale(value),
};

app.init().catch((error) => {
  console.error("Hero Core Defense failed to initialize", error);
  document.querySelector("#scene-root").innerHTML = `
    <section class="scene title-scene">
      <div class="title-panel">
        <p class="eyebrow">SYSTEM ERROR</p>
        <h1>별빛 연결이 끊겼습니다</h1>
        <p class="lede">${String(error?.message ?? error)}</p>
        <button class="primary-button" type="button" onclick="location.reload()">다시 연결</button>
      </div>
    </section>`;
});

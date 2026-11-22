export function openCredits(openSheet, onClose) {
  openSheet('크레딧', `<div class="meta-sheet">
    <section>
      <h4>게임</h4>
      <p>「다음은 너」 RELAYMARE</p>
    </section>
    <section>
      <h4>전투 규칙</h4>
      <p>원작 카드 게임의 규칙을 그대로 사용</p>
    </section>
    <section>
      <h4>글꼴</h4>
      <p>Galmuri 9·11·14 — quiple, SIL Open Font License 1.1</p>
      <p class="credits-license-url">https://cdn.jsdelivr.net/npm/galmuri@2.40.3/dist/LICENSE.txt</p>
      <p>주아(Jua) — The Jua Project Authors, SIL Open Font License 1.1</p>
      <p>Noto Sans KR — Adobe·Google, SIL Open Font License 1.1</p>
    </section>
    <section>
      <h4>그림</h4>
      <p>원작 일러스트를 바탕으로 도트 그래픽 제작</p>
    </section>
    <section>
      <h4>소리</h4>
      <p>배경음과 효과음은 게임 안에서 합성</p>
    </section>
  </div>`, { onClose });
}

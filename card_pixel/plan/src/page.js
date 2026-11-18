/* Client script of the renewal plan page. `A` (assets) is injected by build-plan.mjs. */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const mount = (id, html) => { const n = document.getElementById(id); if (n) n.innerHTML = html; return n; };
  const sp = (name, pose, h) => {
    const m = A.sp[name + '-' + (pose || 'idle')];
    const k = (h || m.h) / m.h;
    return '<img alt="" src="' + m.src + '" width="' + Math.round(m.w * k) + '" height="' + Math.round(m.h * k) + '">';
  };
  const mini = i => '<img alt="" src="' + A.minis[i % A.minis.length] + '">';

  /* ---------- nav highlight ---------- */
  (function () {
    const links = [...document.querySelectorAll('.nav a')];
    if (!('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(es => {
      es.forEach(e => { if (e.isIntersecting) links.forEach(l => l.classList.toggle('on', l.getAttribute('href') === '#' + e.target.id)); });
    }, { rootMargin: '-45% 0px -50% 0px' });
    document.querySelectorAll('.chapter').forEach(c => io.observe(c));
  })();

  /* ---------- first-action path ---------- */
  mount('v-path', (function () {
    const now = ['여정 시작하기', '무한 / 도전', '모드 선택', '입장', '확인: 예', '확인: 예', '저장 알림 닫기', '뽑기', '획득 확인', '선봉 칸', '카드 선택', '편성 완료', '전투 출전'];
    return '<div class="vis"><h4>첫 행동까지 누르는 횟수</h4>' +
      '<p class="pathlabel">지금 (최단 경로, 직접 셈)</p><div class="pathrow">' +
      now.map((s, i) => '<span class="step"><i>' + (i + 1) + '</i>' + s + '</span>').join('') +
      '<span class="step act"><i>14</i>첫 행동</span></div>' +
      '<p class="pathlabel">리뉴얼</p><div class="pathrow"><span class="step go"><i>1</i>프롤로그 전투의 스킬 버튼 = 첫 행동</span></div>' +
      '<p class="note">지금 경로는 카드 1장만 뽑아 한 칸으로 출전하는 가장 짧은 길이다. 티켓 20장을 다 쓰고 3칸을 채우면 55번.</p></div>';
  })());

  /* ---------- core loop ---------- */
  mount('v-loop', '<div class="vis"><h4>코어 루프</h4><div class="loop">' +
    '<span class="n home">거점</span><span class="ar">▶</span><span class="n">던전 · 난이도 선택</span><span class="ar">▶</span>' +
    '<span class="n">출발 편성<br>대표 동료 1 + 동행 명단</span><span class="ar">▶</span>' +
    '<span class="n">보스</span><span class="ar">▶</span><span class="n">귀환<br>영입 · 결산</span><span class="ar">▶</span><span class="n home">거점</span></div>' +
    '<div class="loop"><div class="inner" data-label="× 10층 (출발 편성과 보스 사이)">' +
    '<span class="n">문 고르기</span><span class="ar">▶</span><span class="n">출전 순서</span><span class="ar">▶</span><span class="n">릴레이 전투</span><span class="ar">▶</span><span class="n">보상</span><span class="ar">↺</span></div></div></div>');

  /* ---------- first five minutes ---------- */
  mount('v-tl', (function () {
    const t = [['0:00', '프롤로그 전투가 이미 시작돼 있다'], ['0:25', '선봉이 쓰러지고 조각이 다음 동료에게'], ['0:45', '배율이 쌓이는 필살'], ['1:00', '첫 깨우기: 셋 중 하나'], ['1:30', '새벽의 숲 1층, 첫 문'], ['4:30', '5층 문지기, 3대3 릴레이전'], ['5:00', '클리어, 첫 영입'], ['5:30', '거점이 열린다']];
    return '<div class="vis"><h4>첫 5분</h4><div class="tl">' + t.map((x, i) => '<div class="' + (i === 1 || i === 6 ? 'key' : '') + '"><b>' + x[0] + '</b>' + x[1] + '</div>').join('') + '</div></div>';
  })());

  /* ---------- doors mock ---------- */
  (function () {
    const host = document.getElementById('v-doors'); if (!host) return;
    const R = {
      '전투': ['전', '적 1~2명과 싸운다. 문에 보상이 보인다.'],
      '정예': ['정', '적 2명, 보상 두 배.'],
      '문지기': ['문', '그림자 셋의 릴레이 팀. 그 던전의 연계를 적이 먼저 보여 준다.'],
      '보스': ['왕', '던전의 주인. 필살 카운트다운이 보인다.'],
      '소환의 샘': ['샘', '결정으로 동료를 깨운다.'],
      '혼돈의 제단': ['제', '무작위 3명이 축복을 받는다. 세 번까지 다시 굴린다.'],
      '기억의 샘': ['기', '쓰러진 동료 한 명이 돌아온다.'],
      '꿈장수': ['상', '결정으로 유물·깨우기를 산다. 동료를 결정으로 환원한다.'],
      '보물방': ['보', '유물 1개.'],
      '사건': ['사', '캐릭터가 나오는 짧은 일화와 선택지 2~3개.'],
      '시련의 방': ['시', '조건부 전투. 이기면 큰 보상.']
    };
    const F = [
      [['전투', '결정']],
      [['전투', '결정'], ['전투', '깨우기']],
      [['전투', '결정'], ['소환의 샘', ''], ['사건', '']],
      [['정예', '유물'], ['전투', '결정'], ['혼돈의 제단', '']],
      [['문지기', '유물 3택 + 쉼터']],
      [['전투', '깨우기'], ['사건', ''], ['꿈장수', '']],
      [['정예', '유물'], ['전투', '결정'], ['소환의 샘', '']],
      [['시련의 방', '큰 보상'], ['전투', '결정'], ['혼돈의 제단', '']],
      [['기억의 샘', ''], ['보물방', '유물']],
      [['보스', '귀환 · 영입']]
    ];
    let f = 0, picks = [];
    function render() {
      const strip = F.map((x, i) => '<span class="' + (i < f ? 'done' : i === f ? 'cur' : '') + (i === 4 || i === 9 ? ' fix' : '') + '">' + (i + 1) + '</span>').join('');
      let mid;
      if (f < F.length) {
        mid = '<div class="doors">' + F[f].map((d, i) => '<button class="door' + (F[f].length === 1 ? ' fixed' : '') + '" data-i="' + i + '"><span class="arch">' + R[d[0]][0] + '</span><span class="t">' + d[0] + '</span><span class="d">' + R[d[0]][1] + '</span>' + (d[1] ? '<span class="r">보상: ' + d[1] + '</span>' : '') + '</button>').join('') + '</div>';
      } else {
        mid = '<div class="doors"><div class="door fixed" style="cursor:default;max-width:420px"><span class="arch">귀</span><span class="t">귀환</span><span class="d">살아남은 동료 중 한 명을 영입한다.</span><span class="r">영입 1명</span></div></div><p style="text-align:center;margin:12px 0 0"><button class="btn" id="doors-again">처음부터</button></p>';
      }
      host.innerHTML = '<div class="vis"><h4>원정 한 판 체험 · ' + (f < F.length ? (f + 1) + '층 / 10' + (F[f].length === 1 ? ' (고정)' : ' — 문을 고른다') : '클리어') + '</h4><div class="floors">' + strip + '</div>' + mid +
        '<div class="doorlog">' + (picks.length ? picks.join(' ▶ ') : '문을 누르면 다음 층으로 간다.') + '</div><p class="note">구조 체험용 목업. 전투와 보상은 실제로 진행되지 않는다.</p></div>';
      host.querySelectorAll('button.door').forEach(b => b.onclick = () => { picks.push((f + 1) + '층 ' + F[f][+b.dataset.i][0]); f++; render(); });
      const again = $('#doors-again', host); if (again) again.onclick = () => { f = 0; picks = []; render(); };
    }
    render();
  })();

  /* ---------- phone mockups ---------- */
  const phone = (name, inner) => '<div class="phw"><div class="phs"><div class="ph">' + inner + '</div></div><p class="cap">' + name + '<br>배치 설명용 목업, 최종 디자인 아님</p></div>';
  const P = {};
  P.doors = phone('세 갈래 문',
    '<div class="top"><span>홍련 화산</span><small>4층 / 10 · 결정 5</small></div>' +
    '<div class="dots">' + Array.from({ length: 10 }, (_, i) => '<i class="' + (i < 3 ? 'f' : '') + (i === 4 || i === 9 ? ' k' : '') + '"></i>').join('') + '</div>' +
    '<div class="scene corr">' +
    '<div class="pd" style="left:12px">' + sp('red_dragon', 'idle', 134) + '</div><div class="pd sel" style="left:139px">' + sp('golem', 'idle', 100) + '</div><div class="pd" style="left:266px"><span class="q">?</span></div>' +
    '<div class="pl" style="left:7px"><b>정예</b>그림자 레드드래곤 외 1<br><u>보상: 유물</u></div>' +
    '<div class="pl" style="left:134px"><b>전투</b>야생 골렘<br><u>보상: 결정 +1</u></div>' +
    '<div class="pl" style="left:261px"><b>혼돈의 제단</b>무작위 3명 축복<br><u>세 번 굴림</u></div>' +
    '<div class="party">' + sp('luna', 'idle', 64) + sp('ash', 'idle', 64) + sp('red_dragon', 'idle', 64) + '</div></div>' +
    '<div class="pbtn" style="margin-top:22px">이 문으로</div>');
  P.summon = phone('골라 깨우기',
    '<div class="top"><span>골라 깨우기</span><small>결정 3</small></div>' +
    '<div class="cand"><div class="pic">' + sp('red_dragon', 'idle', 106) + '</div><div><div class="nm">레드드래곤</div><span class="gr g-epic">에픽</span> <span style="font-size:14px">불 · 딜러</span><div class="ln">선봉이면 물리 공격력 +50%</div></div></div>' +
    '<div class="cand sel"><div class="pic">' + sp('luna', 'idle', 106) + '</div><div><div class="nm">루나</div><span class="gr g-legend">전설</span> <span style="font-size:14px">어둠 · 딜러</span><div class="ln">필드버프가 없으면 회피·치명 +25</div></div></div>' +
    '<div class="cand"><div class="pic">' + sp('golem', 'idle', 106) + '</div><div><div class="nm">골렘</div><span class="gr g-rare">레어</span> <span style="font-size:14px">자연 · 밸런서</span><div class="ln">덱에 자연 3장 이상이면 물리 공격력·방어력 +30%</div></div></div>' +
    '<div class="pbtn">깨운다</div><div class="sbtn">깨우기 · 결정 1 · 무작위</div>');
  P.prep = phone('출발 편성',
    '<div class="top"><span>출발 편성</span><small>홍련 화산 · 여정</small></div><div class="pad" style="padding-bottom:0">' +
    '<div class="ttl" style="margin-top:4px">대표 동료</div></div>' +
    '<div class="cand sel" style="height:124px;margin-top:0"><div class="pic" style="height:104px">' + sp('ash', 'idle', 98) + '</div><div><div class="nm">애쉬</div><span class="gr g-epic">에픽</span><div class="ln">출발 멤버로 확정</div></div></div>' +
    '<div class="pad" style="padding-top:0;padding-bottom:0"><div class="ttl">동행 명단 6 / 10</div></div>' +
    '<div class="grid" style="grid-template-columns:repeat(5,1fr)">' + Array.from({ length: 10 }, (_, i) => i < 6 ? '<i>' + mini(i + 2) + '</i>' : '<i class="emp"></i>').join('') + '</div>' +
    '<div class="pad" style="padding-top:0;padding-bottom:0"><div class="ttl">봉인 2 / 3</div></div>' +
    '<div class="grid" style="grid-template-columns:repeat(5,1fr)">' + '<i class="seal sil">' + mini(12) + '</i><i class="seal sil">' + mini(15) + '</i><i class="emp"></i>' + '</div>' +
    '<div class="pad" style="font:14px/1.4 var(--body);color:#cfc6e6;padding-bottom:0">전설 이상은 3칸까지</div>' +
    '<div class="pbtn">출발</div>');
  P.info = phone('던전 정보',
    '<div class="top"><span>홍련 화산</span><small>10층</small></div>' +
    '<div class="panel">가르치는 것<br><b style="font-weight:400;font-size:19px">작열을 쌓고 터뜨리기</b></div>' +
    '<div class="row" style="margin:6px 16px;justify-content:space-between;align-items:center"><div style="width:120px;height:120px;background:#0d0a1c;border:4px solid var(--coral);display:flex;align-items:center;justify-content:center;font-size:60px;color:var(--coral)">?</div><div style="flex:1;font-size:15px;line-height:1.6">보스<br><span style="color:var(--coral)">아직 만나지 못했다</span><br><span style="font:13px/1.4 var(--body);color:#cfc6e6">문지기 격파 0 / 1</span></div></div>' +
    '<div class="pad" style="padding-bottom:0"><div class="ttl" style="margin-top:6px">출현 동료 26 / 40 발견</div></div>' +
    '<div class="grid" style="grid-template-columns:repeat(8,1fr);gap:3px">' + Array.from({ length: 40 }, (_, i) => '<i class="' + (i < 26 ? '' : 'sil') + '">' + mini(i) + '</i>').join('') + '</div>' +
    '<div class="pbtn" style="margin-top:20px">편성하러</div>');
  P.hub = phone('거점',
    '<div class="top"><span>꿈의 관측소</span><small>수첩 3장</small></div>' +
    '<div class="hubsky"><div class="party" style="bottom:118px;gap:18px">' + sp('luna', 'idle', 96) + sp('ash', 'idle', 96) + sp('red_dragon', 'idle', 96) + '</div></div>' +
    '<div class="pbtn" style="margin-top:-96px;position:relative">원정</div>' +
    '<div class="icons"><span>동료</span><span>수첩</span><span>유물</span><span>기록</span></div>' +
    '<div class="panel" style="margin-top:16px">수첩 3장 · 문지기 격파 0 / 1</div>');
  P.ret = phone('귀환',
    '<div class="top"><span>귀환</span><small>홍련 화산 클리어</small></div>' +
    '<div class="pad" style="padding-bottom:0"><div class="ttl" style="margin-top:4px">살아남은 동료</div></div>' +
    '<div class="row" style="margin:0 16px"><div class="surv pick">' + sp('luna', 'idle', 96) + '<br><span style="color:var(--gold)">영입 가능</span></div><div class="surv">' + sp('ash', 'idle', 96) + '<br>대표 동료</div></div>' +
    '<div class="pad" style="padding-bottom:0"><div class="ttl">쓰러진 동료</div></div>' +
    '<div class="row" style="margin:0 16px;justify-content:flex-start;gap:14px"><span class="fallen">' + sp('red_dragon', 'hurt', 64) + '</span><span style="font-size:15px;line-height:1.5">레드드래곤<br>10층</span></div>' +
    '<div class="panel">최고 한 방 <b style="font-weight:400;font-size:22px">945</b><br><span style="font:14px/1.4 var(--body)">애쉬 · 아마겟돈</span></div>' +
    '<div class="pbtn">루나를 영입한다</div>');
  mount('v-ph-doors', '<div class="phones">' + P.doors + '</div>');
  mount('v-ph-summon', '<div class="phones">' + P.summon + '</div>');
  mount('v-ph-pool', '<div class="phones">' + P.prep + P.info + '</div>');
  mount('v-ph-return', '<div class="phones">' + P.ret + '</div>');
  mount('v-ph-hub', '<div class="phones">' + P.hub + '</div>');

  /* ---------- pool bars ---------- */
  mount('v-pool', (function () {
    const cells = (arr) => '<div class="cells">' + arr.map(c => '<i class="' + c + '"></i>').join('') + '</div>';
    const rep = (n, c) => Array.from({ length: n }, () => c);
    return '<div class="vis"><h4>소환 풀의 구성 (칸 하나 = 캐릭터 한 명)</h4><div class="pool">' +
      '<div class="lbl">A안 — 던전 기본 40 + 동료 10</div>' + cells(rep(40, '').concat(rep(10, 'c'))) +
      '<div class="lbl">B안 — 공용 기본 45 + 추가 15, 기본 캐릭터 비활성화</div>' + cells(rep(37, '').concat(rep(8, 'off'), rep(15, 'c'))) +
      '<div class="lbl">결정안 — 던전 기본 40 (그중 최대 10 봉인 가능) + 대표 동료 1 + 동행 10</div>' + cells(rep(30, '').concat(rep(10, 'x'), ['l'], rep(10, 'c'))) +
      '</div><div class="key"><span><i style="background:var(--violet)"></i>던전 기본 풀</span><span><i style="background:var(--aqua)"></i>내가 넣는 동료 (가중치 2배)</span><span><i style="background:var(--gold)"></i>대표 동료 (출발 확정)</span><span><i style="background:repeating-linear-gradient(45deg,#4a3f6b 0 3px,var(--violet) 3px 5px)"></i>봉인할 수 있는 칸</span><span><i style="background:#3a3152;border-top:2px solid var(--coral)"></i>꺼 둔 칸</span></div></div>';
  })());

  /* ---------- pixel route viewer ---------- */
  (function () {
    const host = document.getElementById('v-routes'); if (!host) return;
    const names = { ash: '애쉬', luna: '루나', red_dragon: '레드드래곤', guardian: '가디언' };
    const routes = { R1: 'R1 단순 축소 (64px)', R2: 'R2 외곽선 + 32색 (64px)', R4: 'R4 이미지 생성 (96px)' };
    host.innerHTML = '<div class="vis"><h4>경로 비교 보기</h4><div class="ctrl">' +
      '<select class="btn" id="rv-c">' + Object.keys(names).map(k => '<option value="' + k + '">' + names[k] + '</option>').join('') + '</select>' +
      '<select class="btn" id="rv-r"><option value="all">나란히</option>' + Object.keys(routes).map(k => '<option value="' + k + '">' + routes[k] + '</option>').join('') + '</select>' +
      '<select class="btn" id="rv-p"><option value="idle">R4 포즈: 대기</option><option value="attack">R4 포즈: 공격</option><option value="hurt">R4 포즈: 피격</option></select>' +
      '<select class="btn" id="rv-b"><option value="#1b1530">어두운 배경</option><option value="#9ad0c2">밝은 배경</option><option value="#3a2434">전투 무대 색</option></select>' +
      '<select class="btn" id="rv-s"><option value="2">2배</option><option value="3" selected>3배</option><option value="4">4배</option></select></div>' +
      '<div class="rstage" id="rv-stage"></div><p class="note">R1·R2는 디펜스 SD 시트의 오른쪽 보기를 줄인 것이고, R4는 같은 시트를 참조로 새로 생성해 96px 규격으로 자른 것이다. 가디언은 R4를 만들지 않았다. 같은 배율로 발 높이를 맞춰 놓았다.</p></div>';
    const g = id => document.getElementById(id);
    function draw() {
      const c = g('rv-c').value, r = g('rv-r').value, p = g('rv-p').value, b = g('rv-b').value, s = +g('rv-s').value;
      const list = r === 'all' ? ['R1', 'R2', 'R4'] : [r];
      const st = g('rv-stage'); st.style.background = b; st.style.color = b === '#9ad0c2' ? '#2b2140' : '#f3e9d2';
      st.innerHTML = list.map(k => {
        let img;
        if (k === 'R4') { const m = A.sp[c + '-' + p]; img = m ? '<img alt="" src="' + m.src + '" width="' + m.w * s + '" height="' + m.h * s + '">' : '<div class="none">미생성</div>'; }
        else { const src = A.pilot[c] && A.pilot[c][k]; img = src ? '<img alt="" src="' + src.src + '" width="' + src.w * s + '" height="' + src.h * s + '">' : '<div class="none">없음</div>'; }
        return '<figure>' + img + '<figcaption>' + routes[k] + '</figcaption></figure>';
      }).join('');
    }
    ['rv-c', 'rv-r', 'rv-p', 'rv-b', 'rv-s'].forEach(id => g(id).onchange = draw);
    draw();
  })();

  /* ---------- battle demo ---------- */
  (function () {
    const host = document.getElementById('v-battle'); if (!host) return;
    host.innerHTML = '<div class="demo"><h4>전투 연출 목업 — 같은 전투, 두 가지 화면</h4>' +
      '<div class="ctrl"><button class="btn" id="bd-play">일시정지</button><button class="btn" id="bd-reset">처음부터</button><button class="btn" id="bd-speed">속도 1x</button><button class="btn" id="bd-sound">소리 켜기</button><span class="sep"></span>' +
      '<button class="btn" data-view="new">리뉴얼 연출</button><button class="btn" data-view="now">지금 (글자 로그)</button><button class="btn" data-view="both">나란히</button></div>' +
      '<div class="views">' +
      '<div class="col new" id="bd-new"><h5>리뉴얼 연출</h5><div class="stage" id="bd-stage" style="box-sizing:content-box"><canvas id="bd-cv" width="240" height="168"></canvas>' +
      '<div class="hud h-field"><i></i><i></i><i></i></div><div class="hud h-turn" id="bd-turn">1턴</div>' +
      '<div class="hud h-ally"><span id="bd-an">레드드래곤 · 선봉</span><div class="bar"><i id="bd-ahp" style="width:100%"></i></div><div class="bar mp"><i id="bd-amp" style="width:100%"></i></div><small id="bd-anum">HP 420 · MP 100</small></div>' +
      '<div class="hud h-en">악몽 골렘 <small>자연</small><div class="bar en"><i id="bd-ehp" style="width:100%"></i></div><small id="bd-enum">1,800 / 1,800</small><br><span class="intent" id="bd-int">다음: 물리 강타</span><span class="cd" id="bd-cd">필살 2턴</span><span class="burn" id="bd-burn"></span></div>' +
      '<div id="bd-fx"></div></div>' +
      '<div class="tallybar" id="bd-tally"></div><div class="acts" id="bd-acts"></div></div>' +
      '<div class="col now" id="bd-now"><h5>지금의 화면 구성 (재현)</h5><div class="nowbox"><div class="hd">ENCOUNTER &nbsp; <b id="bn-turn">TURN 1</b></div>' +
      '<div class="vs"><div class="cardph"><span id="bn-an">레드드래곤</span><i></i><div class="hpb"><u id="bn-ahp" style="width:100%"></u></div></div><b style="font-style:italic">VS</b><div class="cardph">악몽 골렘<i></i><div class="hpb e"><u id="bn-ehp" style="width:100%"></u></div></div></div>' +
      '<div class="lg" id="bn-log"></div><div class="bt" id="bn-bt"></div></div></div>' +
      '</div><p class="note">연출 목업. 수치는 실제 스킬 데이터와 대미지식(공격력 × 배율 × 100 / (100 + 방어))으로 계산한 예시이며 적 방어 60, 상성 우위, 치명 1회를 가정했다. 실제 엔진을 돌린 것은 아니다. "지금" 화면은 현재 게임의 전투 화면 구성(카드 그림 두 장, 막대, 글자 로그, 버튼 넷)을 본떠 같은 사건을 보여 준다.</p></div>';

    const stage = $('#bd-stage'), cv = $('#bd-cv'), ctx = cv.getContext('2d'), fxLayer = $('#bd-fx');
    const H = 168, BASE = 150; let W = 240, U = 3;
    let view = window.innerWidth >= 1040 ? 'both' : 'new';
    const IMG = {}, WHITE = {};

    function layout() {
      const avail = $('.views', host).clientWidth;
      const side = view === 'both' && avail >= 1000;
      const colW = side ? avail - 316 : avail;
      W = colW < 480 ? 200 : 240;
      U = colW < 480 ? Math.floor(colW / W * 100) / 100 : Math.max(1, Math.min(3, Math.floor(colW / W)));
      cv.width = W; cv.height = H; cv.style.width = W * U + 'px'; cv.style.height = H * U + 'px';
      stage.style.width = W * U + 'px'; stage.style.height = H * U + 'px'; stage.style.setProperty('--u', U + 'px');
      $('#bd-new').style.width = (W * U + 6) + 'px';
      $('#bd-now').style.width = Math.min(300, avail) + 'px';
      $('#bd-new').style.display = view === 'now' ? 'none' : '';
      $('#bd-now').style.display = view === 'new' ? 'none' : '';
      host.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('on', b.dataset.view === view));
      ctx.imageSmoothingEnabled = false;
    }
    host.querySelectorAll('[data-view]').forEach(b => b.onclick = () => { view = b.dataset.view; layout(); });
    window.addEventListener('resize', layout);

    /* sound */
    let ac = null, soundOn = false;
    function tone(freq, dur, type, vol, slide) {
      if (!soundOn || !ac) return;
      const o = ac.createOscillator(), g = ac.createGain(); o.type = type || 'square'; o.frequency.value = freq;
      if (slide) o.frequency.linearRampToValueAtTime(slide, ac.currentTime + dur);
      g.gain.value = vol || .05; g.gain.linearRampToValueAtTime(0, ac.currentTime + dur);
      o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + dur);
    }
    function noise(dur, vol) {
      if (!soundOn || !ac) return;
      const n = ac.sampleRate * dur | 0, buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const s = ac.createBufferSource(), g = ac.createGain(); g.gain.value = vol || .08; s.buffer = buf; s.connect(g); g.connect(ac.destination); s.start();
    }
    const sfx = {
      tick: n => tone(520 * Math.pow(2, n / 6), .06, 'square', .04),
      hit: big => { noise(big ? .25 : .1, big ? .14 : .08); tone(big ? 90 : 140, big ? .25 : .1, 'triangle', .1, 50); },
      warn: () => tone(110, .45, 'sawtooth', .06, 80),
      shatter: () => [0, 1, 2, 3].forEach(i => setTimeout(() => tone(1200 - i * 180, .09, 'square', .035), i * 70)),
      relay: () => [0, 1, 2].forEach(i => setTimeout(() => tone(620 + i * 160, .09, 'square', .04), i * 80)),
      win: () => [0, 1, 2, 3].forEach(i => setTimeout(() => tone([523, 659, 784, 1047][i], .14, 'square', .045), i * 110))
    };

    /* virtual clock */
    const clock = { t: 0, speed: 1, slow: 1, playing: true, visible: true, waiters: [], tweens: [] };
    let runId = 0;
    const CANCEL = { cancel: true };
    function wait(sec) { return new Promise((res, rej) => clock.waiters.push({ at: clock.t + sec, res, rej })); }
    function tween(obj, to, dur) {
      const from = {}; for (const k in to) from[k] = obj[k];
      return new Promise((res, rej) => clock.tweens.push({ obj, from, to, dur, t: 0, res, rej }));
    }
    function cancelAll() {
      const w = clock.waiters, t = clock.tweens; clock.waiters = []; clock.tweens = [];
      w.forEach(x => x.rej(CANCEL)); t.forEach(x => x.rej(CANCEL));
    }
    function step(real, force) {
      if (!force && (!clock.playing || !clock.visible)) return 0;
      const dt = real * clock.speed * clock.slow; clock.t += dt;
      for (let i = clock.tweens.length - 1; i >= 0; i--) {
        const w = clock.tweens[i]; w.t += dt; const k = Math.min(1, w.t / w.dur);
        for (const p in w.to) w.obj[p] = w.from[p] + (w.to[p] - w.from[p]) * k;
        if (k >= 1) { clock.tweens.splice(i, 1); w.res(); }
      }
      for (let i = clock.waiters.length - 1; i >= 0; i--) { const w = clock.waiters[i]; if (w.at <= clock.t) { clock.waiters.splice(i, 1); w.res(); } }
      return dt;
    }

    /* stage state */
    let ac_, parts, shake, flashA, dark, order, gems;
    const mk = (sprite, fx, s) => ({ sprite, pose: 'idle', fx, s, ox: 0, oy: 0, alpha: 1, white: 0, vis: true, dim: s < 1, phase: Math.random() * 6 });
    function resetState() {
      ac_ = { luna: mk('luna', .065, .5), ash: mk('ash', .17, .5), rd: mk('red_dragon', .36, 1), golem: mk('golem', W === 200 ? .74 : .775, 1) };
      order = ['luna', 'ash', 'rd', 'golem']; parts = []; shake = 0; flashA = 0; dark = 0; gems = 0; clock.slow = 1;
      fxLayer.innerHTML = ''; $('#bd-tally').innerHTML = ''; $('#bd-burn').textContent = '';
      setTurn(1); setAlly('레드드래곤 · 선봉', 420, 420, 100); setEnemy(1800); intent('물리 강타', false); countdown('필살 2턴');
      $('#bn-log').innerHTML = ''; $('#bn-an').textContent = '레드드래곤'; $('#bn-ahp').style.width = '100%'; $('#bn-ehp').style.width = '100%';
      actions(RD, -1, -1);
    }
    const X = a => a.fx * W + a.ox;

    /* HUD helpers */
    const fmt = n => n.toLocaleString('en-US');
    function setTurn(n) { $('#bd-turn').textContent = n + '턴'; $('#bn-turn').textContent = 'TURN ' + n; }
    function setAlly(name, hp, max, mp) {
      $('#bd-an').textContent = name; $('#bd-ahp').style.width = Math.max(0, hp / max * 100) + '%'; $('#bd-amp').style.width = mp + '%';
      $('#bd-anum').textContent = 'HP ' + hp + ' · MP ' + mp; $('#bn-ahp').style.width = Math.max(0, hp / max * 100) + '%';
    }
    function setEnemy(hp) { $('#bd-ehp').style.width = hp / 18 + '%'; $('#bd-enum').textContent = fmt(hp) + ' / 1,800'; $('#bn-ehp').style.width = hp / 18 + '%'; }
    function intent(text, ult) { const e = $('#bd-int'); e.textContent = '다음: ' + text; e.classList.toggle('ult', !!ult); e.style.display = text ? '' : 'none'; }
    function countdown(text) { const e = $('#bd-cd'); e.textContent = text; e.style.display = text ? '' : 'none'; }
    function log(line) { const d = document.createElement('div'); d.textContent = line; const l = $('#bn-log'); l.appendChild(d); l.scrollTop = l.scrollHeight; }
    function dmg(text, x, y, cls) {
      const d = document.createElement('div'); d.className = 'dmg ' + (cls || ''); d.textContent = text;
      d.style.left = x * U + 'px'; d.style.top = y * U + 'px'; fxLayer.appendChild(d); setTimeout(() => d.remove(), 1400);
    }
    function banner(tag, text) { const b = document.createElement('div'); b.className = 'hud banner'; b.innerHTML = '<b>' + tag + '</b>' + text; fxLayer.appendChild(b); return b; }
    const RD = [['가드', '보조 · MP 10', '피해 50% 감소'], ['파이어브레스', '마법 · MP 30', '150'], ['드래곤크로', '물리 · MP 20', '471'], ['일반공격', 'MP 0', '117']];
    const AS = [['회피태세', '보조 · MP 10', ''], ['드림파이어', '마법 · MP 30', '78'], ['아마겟돈', '물리 · MP 30 · HP 50% 소모 · 자신 기절', '630'], ['일반공격', 'MP 0', '90']];
    function actions(list, hl, press) {
      $('#bd-acts').innerHTML = list.map((a, i) => '<div class="act' + (i === hl ? ' hl' : '') + (i === press ? ' press' : '') + '">' + (a[2] ? '<em>' + (/^\d/.test(a[2]) ? '예상 ' + a[2] : a[2]) + '</em>' : '') + '<b>' + a[0] + '</b><small>' + a[1] + '</small></div>').join('');
      $('#bn-bt').innerHTML = list.map(a => '<span>' + a[0] + '<small>' + a[1].replace(/^.*?(MP \d+).*$/, '$1') + '</small></span>').join('');
    }
    async function tally(steps, sum, record) {
      const bar = $('#bd-tally'); bar.innerHTML = '';
      for (let i = 0; i < steps.length; i++) { const s = document.createElement('span'); s.textContent = steps[i]; bar.appendChild(s); sfx.tick(i); await wait(.18); }
      const s = document.createElement('span'); s.className = 'sum'; s.textContent = '= ' + sum; bar.appendChild(s); sfx.tick(steps.length + 1); await wait(.3);
      if (record) { const r = document.createElement('span'); r.className = 'rec'; r.textContent = '신기록'; bar.appendChild(r); sfx.tick(steps.length + 4); await wait(.25); }
    }

    /* particles */
    function spark(x, y, n, colors, pow) {
      for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, v = (pow || 60) * (.3 + Math.random() * .7); parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, g: 160, life: .25 + Math.random() * .35, c: colors[i % colors.length], s: Math.random() < .3 ? 2 : 1 }); }
    }
    function fly(x0, y0, x1, y1, dur, c, arc, s, img) { parts.push({ bz: 1, t: 0, dur, x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: Math.min(y0, y1) - (arc || 30), c, s: s || 1, img, x: x0, y: y0 }); }
    function updateParts(dt) {
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        if (p.bz) { p.t += dt / p.dur; const t = Math.min(1, p.t), u = 1 - t; p.x = u * u * p.x0 + 2 * u * t * p.cx + t * t * p.x1; p.y = u * u * p.y0 + 2 * u * t * p.cy + t * t * p.y1; if (p.t >= 1) { parts.splice(i, 1); if (p.done) p.done(); } }
        else { p.life -= dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.life <= 0) parts.splice(i, 1); }
      }
    }

    /* drawing */
    function drawBg(now) {
      ctx.fillStyle = '#140d1f'; ctx.fillRect(-8, -8, W + 16, H + 16);
      ctx.fillStyle = '#24152b'; ctx.fillRect(0, 16, W, 98);
      ctx.fillStyle = '#1b1022';
      for (let y = 16; y < 114; y += 14) { ctx.fillRect(0, y, W, 1); for (let x = ((y - 16) / 14 % 2 ? 0 : 13); x < W; x += 26) ctx.fillRect(x, y, 1, 14); }
      const cols = [Math.round(W * .23), Math.round(W * .62)];
      for (const px of cols) { ctx.fillStyle = '#170d1d'; ctx.fillRect(px, 16, 14, 98); ctx.fillStyle = '#2e1a33'; ctx.fillRect(px + 2, 16, 3, 98); }
      const f = (now / 170 | 0) % 2;
      for (const px of cols) { const tx = px + 7; ctx.fillStyle = 'rgba(255,150,60,.10)'; ctx.fillRect(tx - 14, 44, 29, 30); ctx.fillStyle = '#6b4a2a'; ctx.fillRect(tx - 1, 62, 3, 9); ctx.fillStyle = '#ff8a3a'; ctx.fillRect(tx - 2, 55 + f, 5, 7 - f); ctx.fillStyle = '#ffe07a'; ctx.fillRect(tx - 1, 58 + f, 3, 3); }
      ctx.fillStyle = '#5a2230'; ctx.fillRect(0, 110, W, 4); ctx.fillStyle = '#8a3a2e'; ctx.fillRect(0, 113, W, 1);
      ctx.fillStyle = '#3a2434'; ctx.fillRect(0, 114, W, H - 114); ctx.fillStyle = '#4d3044'; ctx.fillRect(0, 114, W, 2);
      ctx.fillStyle = '#2e1c2b';
      for (let y = 126; y < H; y += 13) ctx.fillRect(0, y, W, 1);
      for (let x = 8; x < W; x += 36) { ctx.fillRect(x, 116, 1, 10); ctx.fillRect(x + 18, 127, 1, 12); ctx.fillRect(x + 7, 140, 1, 12); ctx.fillRect(x + 25, 153, 1, 15); }
    }
    function drawActor(a, now) {
      if (!a.vis || a.alpha <= 0.01) return;
      const key = a.sprite + '-' + a.pose, m = A.sp[key], img = a.white > 0 ? WHITE[key] : IMG[key]; if (!img) return;
      const bob = a.pose === 'idle' ? Math.round(Math.sin(now / 420 + a.phase) * .6) : 0;
      const cx = Math.round(X(a)), w = Math.round(m.w * a.s), h = Math.round(m.h * a.s);
      const sw = Math.round(m.w * a.s * .6);
      ctx.globalAlpha = .38 * a.alpha; ctx.fillStyle = '#000'; ctx.fillRect(cx - (sw >> 1), BASE - 1, sw, 2); ctx.fillRect(cx - (sw >> 1) + 2, BASE + 1, sw - 4, 1);
      ctx.globalAlpha = a.alpha * (a.dim ? .8 : 1);
      ctx.drawImage(img, Math.round(X(a) - m.cx * a.s), Math.round(BASE + a.oy - (m.fy + 1) * a.s) + bob, w, h);
      ctx.globalAlpha = 1;
    }
    function draw(now) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (shake > 0.3) ctx.translate(Math.round((Math.random() * 2 - 1) * shake), Math.round((Math.random() * 2 - 1) * shake * .6));
      drawBg(now);
      for (const id of order) drawActor(ac_[id], now);
      for (const p of parts) {
        if (p.img) ctx.drawImage(p.img, Math.round(p.x - p.img.width / 2), Math.round(p.y - p.img.height / 2));
        else if (p.sl) {
          const n = Math.min(26, Math.round((1 - p.life / p.max) * 60));
          for (let k = 0; k < 3; k++) for (let j = 0; j < n; j++) { ctx.fillStyle = j > n - 6 ? '#fff' : '#ffc857'; ctx.fillRect((p.x + 12 + k * 9 - j) | 0, (p.y - 4 + k * 3 + j * 1.6) | 0, 2, 2); }
        }
        else if (p.gem) { ctx.fillStyle = '#4fd8c8'; ctx.fillRect(p.x - 1 | 0, p.y - 3 | 0, 3, 7); ctx.fillRect(p.x - 3 | 0, p.y - 1 | 0, 7, 3); ctx.fillStyle = '#d6fff7'; ctx.fillRect(p.x - 1 | 0, p.y - 2 | 0, 1, 2); }
        else { ctx.fillStyle = p.c; ctx.fillRect(p.x | 0, p.y | 0, p.s, p.s); }
      }
      if (dark > 0) { ctx.fillStyle = 'rgba(30,0,10,' + dark + ')'; ctx.fillRect(-8, -8, W + 16, H + 16); }
      if (flashA > 0) { ctx.fillStyle = 'rgba(255,255,255,' + flashA + ')'; ctx.fillRect(-8, -8, W + 16, H + 16); }
    }

    /* actions */
    function front(id) { order = order.filter(x => x !== id).concat(id); }
    function hurt(t, o) {
      t.pose = 'hurt'; t.white = .09; t.ox = (t === ac_.golem ? 1 : -1) * 4; shake = o.shake || 2; if (o.flash) flashA = .85;
      spark(X(t), BASE - 44, o.big ? 26 : 12, o.colors || ['#fff', '#ffc857', '#ff6b5e'], o.big ? 110 : 60);
      dmg(o.text, X(t), BASE - 96 - (o.big ? 12 : 0), o.cls); sfx.hit(o.big);
      tween(t, { ox: 0 }, .25).catch(() => { });
    }
    async function strike(a, t, o) {
      front(a === ac_.golem ? 'golem' : (a === ac_.rd ? 'rd' : 'ash'));
      const dir = a === ac_.golem ? -1 : 1;
      a.pose = o.pose || 'attack'; await tween(a, { ox: dir * (o.lunge || 12) }, .1);
      if (o.slash) parts.push({ sl: 1, x: X(t) + 4, y: BASE - 74, life: .26, max: .26, vx: 0, vy: 0, g: 0 });
      hurt(t, o); await wait(o.hold || .24);
      await tween(a, { ox: 0 }, .14); a.pose = 'idle'; await wait(.12);
      if (!o.keepHurt) t.pose = 'idle';
    }

    async function script() {
      resetState();
      const g = ac_.golem, rd = ac_.rd, ash = ac_.ash, luna = ac_.luna;
      log('전투 개시! 적: 악몽 골렘'); log('=== 1턴 ===');
      await wait(1.0);
      actions(RD, 2, -1); await wait(.6);
      await tally(['공격력 105', '선봉 +50% = 157', '드래곤크로 ×2.0', 'HP 100% ×2.0', '상성 ×1.2'], '471');
      log('HP 100% 특수 효과! 위력 2배!');
      actions(RD, -1, 2);
      await strike(rd, g, { text: '471 ▲', cls: 'up', shake: 4, pose: 'idle', slash: true, lunge: 30, hold: .28 });
      setEnemy(1329); setAlly('레드드래곤 · 선봉', 420, 420, 80); log('레드드래곤의 드래곤크로! 471 피해.');
      actions(RD, -1, -1); await wait(.55);
      log('--- 적 턴 ---');
      await strike(g, rd, { text: '168', cls: 'foe', shake: 2 });
      setAlly('레드드래곤 · 선봉', 252, 420, 80); log('악몽 골렘의 강타! 168 피해.');
      countdown('필살 1턴'); intent('대지 붕괴 (필살)', true); tween({ get v() { return dark; }, set v(x) { dark = x; } }, { v: .28 }, .4).catch(() => { }); sfx.warn();
      await wait(.9);
      setTurn(2); log('=== 2턴 ===');
      $('#bd-tally').innerHTML = ''; actions(RD, 1, -1); await wait(.6); actions(RD, -1, 1);
      front('rd'); rd.pose = 'attack';
      for (let i = 0; i < 26; i++) fly(X(rd) + 44, BASE - 52, X(g) - 10 + Math.random() * 20, BASE - 60 + Math.random() * 30, .28 + Math.random() * .25, ['#ffe07a', '#ff8a3a', '#ff6b5e'][i % 3], 6, i % 4 ? 1 : 2);
      await wait(.34);
      hurt(g, { text: '150 ▲', cls: 'up', shake: 2, colors: ['#ffe07a', '#ff8a3a'] });
      await wait(.4); rd.pose = 'idle'; g.pose = 'idle';
      setEnemy(1179); setAlly('레드드래곤 · 선봉', 252, 420, 50); $('#bd-burn').textContent = '작열 1';
      log('레드드래곤의 파이어브레스! 150 피해.'); log('악몽 골렘에게 [작열] 1스택.');
      actions(RD, -1, -1); await wait(.6);
      log('--- 적 턴 ---'); sfx.warn(); flashA = .35; await wait(.45);
      await strike(g, rd, { text: '대지 붕괴 430', cls: 'big foe', shake: 6, big: true, lunge: 20, hold: .3, keepHurt: true });
      setAlly('레드드래곤 · 선봉', 0, 420, 50); log('악몽 골렘의 대지 붕괴! 430 피해.'); log('레드드래곤 쓰러짐!');
      countdown(''); intent('물리 강타', false);
      /* relay */
      clock.slow = .45; await wait(.2);
      sfx.shatter();
      for (let i = 0; i < 44; i++) fly(X(rd) - 14 + Math.random() * 28, BASE - 10 - Math.random() * 70, X(ash), BASE - 24, .55 + Math.random() * .45, ['#4fd8c8', '#ffc857', '#fff'][i % 3], 26 + Math.random() * 30, i % 5 ? 1 : 2);
      await tween(rd, { alpha: 0 }, .22); rd.vis = false; clock.slow = 1;
      tween({ get v() { return dark; }, set v(x) { dark = x; } }, { v: 0 }, .5).catch(() => { });
      const bn = banner('계승', '애쉬 — 아군이 쓰러지면 물리 반격 ×3.0'); sfx.relay();
      await wait(.75);
      front('ash'); ash.pose = 'attack'; ash.white = .08;
      fly(X(ash) + 14, BASE - 26, X(g), BASE - 48, .3, '#ff8a3a', 14, 1, IMG['ash-fx']);
      await wait(.3);
      hurt(g, { text: '반격 270 ▲', cls: 'up', shake: 3 });
      setEnemy(909); log('[특성] 애쉬: 물리 반격! 270 피해.');
      await wait(.45); ash.pose = 'idle'; g.pose = 'idle';
      await wait(.35); bn.remove();
      /* the line steps forward */
      ash.dim = false;
      tween(luna, { fx: .17 }, .35).catch(() => { });
      await tween(ash, { fx: .36, s: 1 }, .35);
      spark(X(ash), BASE, 10, ['#6b5566', '#8c7486'], 30);
      setAlly('애쉬 · 중견', 420, 420, 100); $('#bn-an').textContent = '애쉬'; actions(AS, -1, -1);
      setTurn(3); log('=== 3턴 ==='); $('#bd-tally').innerHTML = '';
      await wait(.5); actions(AS, 2, -1); await wait(.5);
      await tally(['공격력 120', '아마겟돈 ×7.0', '치명 ×1.5', '상성 ×1.2'], '945', true);
      log('치명타!'); actions(AS, -1, 2);
      await strike(ash, g, { text: '945', cls: 'big', shake: 8, big: true, flash: true, lunge: 26, hold: .34, keepHurt: true });
      setEnemy(0); setAlly('애쉬 · 중견', 210, 420, 70); $('#bd-burn').textContent = ''; log('애쉬의 아마겟돈! 945 피해.');
      g.white = .12; spark(X(g), BASE - 40, 40, ['#3a2f58', '#8b6cff', '#15112a'], 90);
      await tween(g, { alpha: 0, oy: 6 }, .5); g.vis = false; intent('', false);
      actions(AS, -1, -1); log('전투 승리!'); sfx.win();
      await wait(.35);
      for (let i = 0; i < 2; i++) { const p = { bz: 1, t: 0, dur: .7 + i * .15, x0: X(g) - 6 + i * 12, y0: BASE - 30, x1: W / 2, y1: 60, cx: X(g), cy: 20, gem: 1, x: 0, y: 0 }; parts.push(p); }
      await wait(.8);
      const loot = document.createElement('div'); loot.className = 'hud h-loot'; loot.innerHTML = '꿈의 결정 +2<small>루나 생존 — 영입 후보</small>'; fxLayer.appendChild(loot);
      await wait(2.4);
    }
    async function runLoop() {
      const my = ++runId; cancelAll();
      try { while (my === runId) await script(); } catch (e) { if (e !== CANCEL) throw e; }
    }

    /* controls */
    $('#bd-play').onclick = function () { clock.playing = !clock.playing; this.textContent = clock.playing ? '일시정지' : '재생'; stage.classList.toggle('paused', !clock.playing); };
    $('#bd-reset').onclick = () => { if (!clock.playing) $('#bd-play').click(); runLoop(); };
    $('#bd-speed').onclick = function () { clock.speed = clock.speed === 1 ? 2 : 1; this.textContent = '속도 ' + clock.speed + 'x'; this.classList.toggle('on', clock.speed === 2); };
    $('#bd-sound').onclick = function () {
      soundOn = !soundOn; this.textContent = soundOn ? '소리 끄기' : '소리 켜기'; this.classList.toggle('on', soundOn);
      if (soundOn && !ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { soundOn = false; } }
    };
    if ('IntersectionObserver' in window) new IntersectionObserver(es => { clock.visible = es[0].isIntersecting; }).observe(host);

    let last = performance.now();
    function sim(real, force) {
      const dt = step(real, force);
      if (dt > 0) { updateParts(dt); shake = Math.max(0, shake - dt * 22); flashA = Math.max(0, flashA - dt * 4.5); for (const k in ac_) if (ac_[k].white > 0) ac_[k].white -= dt; }
    }
    function frame(now) {
      const real = Math.min(.05, (now - last) / 1000); last = now;
      sim(real, false);
      if (ac_) draw(now);
      requestAnimationFrame(frame);
    }
    /* Review hook: step the demo by a fixed amount of demo time, for checking a frame when the page is not animating. */
    window.__battleDemo = {
      async advance(sec) {
        for (let n = Math.round(sec / .02); n > 0; n--) { sim(.02, true); for (let k = 0; k < 8; k++) await null; }
        draw(performance.now()); return Math.round(clock.t * 100) / 100;
      },
      pause() { clock.playing = false; }
    };
    Promise.all(Object.keys(A.sp).map(k => new Promise(res => {
      const im = new Image();
      im.onload = () => {
        IMG[k] = im; const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d');
        x.drawImage(im, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); WHITE[k] = c; res();
      };
      im.onerror = res; im.src = A.sp[k].src;
    }))).then(() => { layout(); requestAnimationFrame(frame); runLoop(); });
  })();
})();

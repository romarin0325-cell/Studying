// These checks are cumulative. New requests add checks; they do not replace old ones.
// A policy change invalidates old review receipts, even if the pixels are unchanged.
export const inheritedCheckIds = Object.freeze([
  'original-design','frozen-style','anatomical-head','face-shape-expression',
  'directional-registration','body-proportions','equipment-handedness',
  'silhouette-perceived-size','outline-weight','shading-material',
  'cast-consistency','game-size-readability','portrait-alignment',
  'seams-contact','independent-detector','source-integrity','package-integrity',
]);
const check=(id,title,task,evidence,automatic=false)=>({id,title,task,evidence,automatic,required:true});
export const policy = {
  id:'star-garden-sd-cumulative',version:1,
  source:'Existing SD_CAST_GUIDE / ART_PIPELINE plus the cumulative instructions in this conversation; reconstructed 2026-11-08, not a claim that these gates existed previously.',
  stages:[
    {id:'inputs',title:'A · 원화·규격 확정',task:'원화·컨셉·동결 화풍·구조·같은 체형 동료를 직접 확인하고 입력과 불변 조건을 고정한다.'},
    {id:'generation',title:'B · 새 생성물 수집',task:'고정한 작업 지시와 실제 참조로 생성하고 도구 출력·수정 범위·출처를 기록한다.'},
    {id:'anatomy',title:'C · 생성 원본 측정',task:'귀·머리카락·모자·장비를 제외한 두개골·눈·턱·관절·발을 네 방향에서 기록한다.'},
    {id:'pack',title:'D · 공통 배율·전처리',task:'전신 등방 배율 하나, 방향별 발 정렬만 허용한다. 알파32 이상 잘림·손실은 실패시킨다.'},
    {id:'review',title:'E · 독립 검사·고정 비교 자료',task:'imgutils/ONNX 검사를 실제 파일에 실행하거나 동일 해시 측정을 검증해 재사용한다. 머리·신체·동료·원화·윤곽·64/96px·초상화 검수책을 만든다.'},
    {id:'decision',title:'F · 모든 필수 항목 판정',task:'기존 항목을 포함한 전체 검수를 수행한다. 경고·미검토가 있으면 통과시키지 않는다.'},
    {id:'release',title:'G · 검수본 패키지',task:'현재 파일·정책·판정의 지문이 모두 유효할 때만 배포 후보를 내보낸다. 게임 적용·PR은 별도다.'},
  ],
  frame:{cell:512,atlas:1024,sole:[256,480],frontSkull:[160,150],profileSkull:[144,150],bodyBelowChin:{short:176,medium:188,tall:200}},
  warningLimits:{headWidthPx:10,headHeightPx:10,eyeY:8,chinY:8,shouldersY:10,hipsY:10,soleY:3,bodyRatio:0.10},
  clippingAlpha:32,
  allowedTransforms:['one-isotropic-scale-for-the-whole-character','whole-view-translation'],
  prohibited:['accessory-bounds-auto-fit','per-direction-scale','anisotropic-stretch','head-only-or-limb-stretch','TPS-face-warp','normalization-as-independent-proof'],
  refinement:'Prefer local regeneration on the new painting with protected accepted regions. If a whole regenerated painting is selected, invalidate all anatomy, appearance, direction and style reviews. A seamless composite and a pixel-preserved face are separate checks. Do not silently fall back to a whole painting while keeping old passes.',
  checks:[
    check('original-design','원화의 의상·정체성','원본 의상 구조·색·재질·장식·실루엣을 네 방향과 대조한다. 기존 SD 픽셀 수정을 원화 기반 신규 제작이라고 부르지 않는다.',['originals','four-views']),
    check('frozen-style','공통 화풍 참조','동결된 화풍을 계속 사용한다. 새 후보를 다음 후보의 새 화풍 기준으로 교체하지 않는다.',['style','cast']),
    check('anatomical-head','실제 머리 크기','두개골·얼굴 기준의 폭·높이·깊이를 네 방향과 동료 옆에서 확인한다. 모자·머리카락·귀·뿔은 제외한다. 기울기는 회전축으로 본다. 정규화 수치만으로 합격시키지 않는다. 독립 검출의 경고도 실제 얼굴과 대조해 해석한다.',['head','measurements','cast','independent-audit']),
    check('face-shape-expression','얼굴 형태·표정','눈 간격·눈~턱·볼·턱선과 개인적인 눈매·미소·미세 각도를 본다. 납작함·찌그러짐·세로 늘어짐을 숫자로 덮지 않는다.',['head','originals']),
    check('directional-registration','상하좌우 신체 정렬','공통 바닥에서 눈·턱·목·어깨·골반·발의 위치와 회전 시 덩치를 비교한다. 좌우 일치만으로 정면까지 맞았다고 판정하지 않는다.',['four-views','measurements']),
    check('body-proportions','머리 대비 몸·몸통·다리','두개골 높이 대비 턱 아래·어깨~골반·골반~발·어깨 폭과 전체 등신을 같은 체형군 옆에서 본다. 코트 끝·무기 끝을 관절·발로 세지 않는다.',['measurements','four-views','cast']),
    check('equipment-handedness','장비의 손·가림','물리 무기·검집·우산·장식의 해부학적 좌우와 가까운 팔/먼 팔의 가림, 손과 물건의 접촉을 본다. 반전 후 장비는 별도로 복구한다.',['four-views','originals']),
    check('silhouette-perceived-size','체감 머리·덩치','모자·머리 부피를 실제 두개골과 분리해서 체감 크기·무게·균형을 판단한다. 전체 외곽을 맞춰 몸을 자동 축소하지 않는다.',['cast','sizes']),
    check('outline-weight','외곽선의 무게','턱·소매·발을 같은 원본 배율로 대조한다. 512px 셀 외곽 약1.5~2.5px를 목표로 하되 검은 옷·그림자·속눈썹을 선 두께로 오인하지 않는다.',['line-samples','sizes','style']),
    check('shading-material','명암·재질·광택','그림자 경계·채도·하이라이트 크기와 밀도·금속/천/피부의 재질을 같은 화풍 참조와 비교한다.',['cast','style','line-samples']),
    check('cast-consistency','다른 동료와 전체 인상','같은 체형군과 공통 바닥·배율에서 머리/몸·의상 부피·표정·포즈·화풍이 한 전장으로 읽히는지 판단한다.',['cast','sizes']),
    check('game-size-readability','64·96px의 네 방향','64/96px, 밝고 어두운 바닥의 모든 방향을 실제로 본다. 상세 확대만으로 작은 크기 가독성을 대신하지 않는다.',['sizes']),
    check('portrait-alignment','초상화 크기·시각적 중앙','실제 두개골 측정과 UI 크롭을 분리한다. 전신과 파생 초상화를 보고 얼굴이 자연스럽게 중앙에 읽히는지 판단한다. 실제 게임의 모든 사용처는 적용 단계에서 따로 확인한다.',['portrait','head']),
    check('seams-contact','연결부·형태 품질','목·머리카락·손·장비·의상 경계의 끊김, 중복 선, 떠 있는 손, 잘린 부위를 확대와 실제 크기로 확인한다. 보호 픽셀 일치가 자연스러운 연결을 증명하지는 않는다.',['four-views','head','sizes']),
    check('independent-detector','독립 검사 실행·원시 경고','기존 imgutils/ONNX 얼굴·머리 검출과 LPIPS·SSIM·CCIP를 실제 출력에 실행한다. 같은 파일·코드·환경의 해시가 맞을 때만 재사용한다. 경고를 보존하고 얼굴 박스를 두개골의 정답으로 쓰지 않는다.',['independent-audit'],true),
    check('source-integrity','원본·입력·수정 이력','참조·정확한 프롬프트·생성 원본·선택·보호 마스크·수정 범위를 해시로 연결한다. 과거 생성 전 기록을 사후 기록으로 소급 위장하지 않는다.',['provenance'],true),
    check('package-integrity','전처리·패키지 보존','알파32 잘림, 공통 등방 배율, 방향별 추출, 투명도, PNG/WebP 보이는 픽셀과 초상화 출처를 확인한다.',['package'],true),
  ],
};

export function validatePolicy(p){
  const ids=p.checks.map(c=>c.id);
  if(new Set(ids).size!==ids.length)throw new Error('Duplicate quality-check ID');
  for(const id of inheritedCheckIds){const c=p.checks.find(c=>c.id===id);if(!c||c.required!==true)throw new Error('Inherited mandatory check removed or disabled: '+id);}
  for(const c of p.checks)if(!c.task||!Array.isArray(c.evidence)||!c.evidence.length)throw new Error('Incomplete check: '+c.id);
  if(p.clippingAlpha>32)throw new Error('The inherited alpha32 clipping check cannot be weakened');
  return p;
}
validatePolicy(policy);

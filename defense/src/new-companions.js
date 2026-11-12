// Shared collectible identities and per-unit combat forms. Forms never enter the summon pool.
const portraitCenters={gold_dragon:[250,209],demon_king:[255,220],miracle_larva:[255,222],miracle_cocoon:[256,214],miracle_wing:[255,210],abyss_wing:[255,217]};
const art=id=>({atlas:'unit-'+id,row:0,columns:2,foot:.9375,scale:1,directional:true,portrait:{x:portraitCenters[id][0],y:portraitCenters[id][1],size:250}});
export const MIRACLE_FORMS=Object.freeze({
  miracle_larva:{name:'미라클라바',damage:43.2,interval:1.3,range:490,radius:64,shape:'splash',attack:'leaf',color:'#a9df9b',art:art('miracle_larva'),trait:{type:'eclose',text:'필살기 사용 시 미라클윙 또는 어비스윙으로 우화합니다. 합성 시 미라클코쿤이 됩니다.'}},
  miracle_cocoon:{name:'미라클코쿤',damage:36,interval:1.8,range:230,radius:230,shape:'pulse',attack:'silk',color:'#d9d1f2',art:art('miracle_cocoon'),trait:{type:'eclose',text:'자기 칸 주변(반경 230)의 적을 공격합니다. 필살기 사용 시 미라클윙 또는 어비스윙으로 우화합니다.'}},
  miracle_wing:{name:'미라클윙',damage:52,interval:1.25,range:520,radius:72,shape:'splash',attack:'prism',color:'#f4d883',art:art('miracle_wing'),trait:{type:'critAura',text:'상하좌우 동료의 치명타 확률이 +20%p 증가합니다. 합성 시 미라클코쿤이 됩니다.'}},
  abyss_wing:{name:'어비스윙',damage:38,interval:1.25,range:520,radius:72,shape:'splash',attack:'venom',color:'#d28ee9',art:art('abyss_wing'),trait:{type:'abyss',text:'기본 공격 시 적을 2초간 25% 감속시키고 8초간 중독 1중첩을 부여합니다. 합성 시 미라클코쿤이 됩니다.'}},
});
export const NEW_HEROES=[
  {id:'gold_dragon',name:'골드드래곤',title:'용의 둥지의 금빛 군주',color:'#efc466',art:art('gold_dragon'),damage:44,interval:1.7,range:620,radius:55,shape:'cross',attack:'gold',heightGroup:'tall',role:'개전 포격 · 십자',trait:{type:'goldOpening',text:'기본 공격이 자기 행과 열 전체를 십자로 관통합니다. 매 웨이브 시작 후 10초간 공격력이 100% 증가합니다.'},skill:{name:'얼티밋브레스',cost:80,type:'ultimate_breath',text:'5초간 별빛을 모은 뒤 하늘에서 광선을 내려 반경 180 범위에 공격력 22배 피해를 줍니다.'}},
  {id:'demon_king',name:'마왕',title:'검은 안개 숲의 주인',color:'#b48be5',art:art('demon_king'),damage:38,interval:1.4,range:520,radius:24,shape:'beam',attack:'dark',heightGroup:'medium',role:'디버프 회수 · 관통',trait:{type:'critDamage',text:'기본 공격이 일직선으로 관통하며, 치명타 피해가 +50%p(기본 150% → 200%) 증가합니다.'},skill:{name:'데스핸드',cost:70,type:'deathhand',text:'적이 가장 밀집한 반경 180 범위에 공격력 4배 피해를 줍니다. 대상에게 걸린 디버프(감속·노출·기절·빙결·성광·중독·화상) 1종당 피해가 +4배씩 증가하며, 디버프는 유지됩니다.'}},
  {id:'miracle_larva',title:'아직 펼치지 않은 기적',...MIRACLE_FORMS.miracle_larva,heightGroup:'short',role:'우화 · 범위',skill:{name:'기적의우화',cost:50,type:'miracle_eclose',text:'전장의 모든 미라클라바와 미라클코쿤이 각각 50% 확률로 미라클윙 또는 어비스윙으로 우화합니다. 모든 형태는 서로 합성이 가능하며 합성 결과는 항상 미라클코쿤이 됩니다.'}},
];
export const NEW_ASSET_PATHS={...Object.fromEntries(['gold_dragon','demon_king',...Object.keys(MIRACLE_FORMS)].map(id=>['unit-'+id,'./assets/cast-v2/'+id+'.webp'])),'gold-breath':'./assets/merge/gold-breath.webp'};

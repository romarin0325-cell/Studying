# Card source inventory

Code takes precedence over documentation. Node vm evaluated data.js including appended expansion and generated special overrides (card_pixel/scripts/build-sprites.mjs:25, card/game/data.js:1313, card/game/data.js:1743). Battle-only forms are included for completeness; they are not represented as collectible.

## 1. ROSTER

| id | name | grade | element | role | pool | trait type and summary | skills name(type,cost) | source |
|---|---|---|---|---|---|---|---|---|
| deep_lord | 심해의주인 | legend | water | dealer | base CARDS | syn_water_3_atk_matk: 덱에 물 3장 이상 시 물리 공격력·마법 공격력 50% 증가 | 배리어(sup,10), 월광해류(mag,30), 심연의포옹(phy,20) | card/game/data.js:20 |
| queen | 여왕 | legend | nature | looter | base CARDS | looter: 이 카드로 승리시 추가 드로우 | 배리어(sup,10), 피날레(mag,30), 로열블룸(sup,20) | card/game/data.js:30 |
| luna | 루나 | legend | dark | dealer | base CARDS | cond_no_field_buff_eva_crit: 필드 버프가 없을 시 회피율/치명타 25%증가 | 회피태세(sup,10), 이클립스(phy,30), 다크메테오(mag,30) | card/game/data.js:40 |
| gold_dragon | 골드드래곤 | legend | light | dealer | base CARDS | pos_stat_boost: 대장 배치시 물리 공격력·마법 공격력 35%증가 | 가드(sup,10), 얼티밋브레스(mag,30), 드래곤크로(phy,20) | card/game/data.js:50 |
| rumi | 루미 | legend | water | buffer | base CARDS | syn_water_nature: 덱에 물과 자연이 있을 경우, 문라이트세레나 발동 시 트윙클파티 추가 발동 | 밀키웨이엑스터시(mag,30), 문라이트세레나(sup,20), 매직가드(sup,10) | card/game/data.js:60 |
| jasmine | 자스민 | legend | light | buffer | base CARDS | cond_divine_3_dmg: 디바인 3스택 이상인 적에게 피해 2배 | 배리어(sup,10), 더홀리(mag,20), 여신강림(sup,30) | card/game/data.js:70 |
| world_tree | 세계수 | legend | nature | buffer | base CARDS | syn_nature_3_all: 덱이 전부 자연일 시 물리 공격력·마법 공격력·물리 방어력·마법 방어력 30% 증가 | 가드(sup,10), 대지의분노(mag,20), 가이아포스(phy,30) | card/game/data.js:80 |
| zeke | 지크 | legend | fire | balancer | base CARDS | death_field_sun: 사망시 태양의축복 부여 | 가드(sup,10), 이그니스스매시(mag,20), 라그나로크(phy,30) | card/game/data.js:90 |
| time_ruler | 시간의지배자 | legend | dark | debuffer | base CARDS | pos_stat_boost: 중견 배치시 마법 공격력 30%증가 | 매직가드(sup,10), 종언의예고(mag,30), 섀도우트위스트(sup,30) | card/game/data.js:100 |
| frozen_witch | 혹한의마녀 | legend | water | debuffer | base CARDS | death_dmg_debuff: 사망시 적에게 걸려있는 디버프 1종당 위력 1배로 마법 피해 | 매직가드(sup,10), 블리자드(mag,30), 프로스트(mag,30) | card/game/data.js:110 |
| behemoth | 베히모스 | legend | nature | balancer | base CARDS | behemoth_trait: 적의 디버프가 3종 이상일 때 피해 1.5배 / 스킬 사용시 20% 확률로 | 가드(sup,10), 대지분쇄(phy,30), 어스퀘이크(mag,30) | card/game/data.js:120 |
| storm_sage | 폭풍의현자 | epic | nature | debuffer | base CARDS | syn_nature_3_matk: 덱에 자연 3장 이상 시 마법 공격력 50% 증가 | 배리어(sup,10), 러스트브리즈(mag,20), 팬텀게일(mag,30) | card/game/data.js:132 |
| shadow_stalker | 그림자추적자 | epic | dark | looter | base CARDS | looter: 이 카드로 승리시 추가 드로우 | 회피태세(sup,10), 암살(phy,20), 어쌔신네일(phy,30) | card/game/data.js:142 |
| mawang | 마왕 | epic | fire | dealer | base CARDS | cond_debuff_3_dmg: 적의 디버프가 3종 이상이면 주는 피해 1.5배 | 회피태세(sup,10), 데스핸드(phy,20), 데몬브레스(mag,20) | card/game/data.js:152 |
| red_dragon | 레드드래곤 | epic | fire | dealer | base CARDS | pos_stat_boost: 선봉일시 물리 공격력 50%증가 | 가드(sup,10), 파이어브레스(mag,30), 드래곤크로(phy,20) | card/game/data.js:162 |
| lightning_sage | 번개의현자 | epic | light | dealer | base CARDS | death_dmg_mag: 사망시 마법 공격력 300%피해 | 배리어(sup,10), 레인오브썬더(mag,30), 썬더스톰(mag,20) | card/game/data.js:172 |
| flame_sage | 화염의현자 | epic | fire | buffer | base CARDS | syn_fire_3_crit: 덱에 불 3장 이상 시 치명타율 30% 증가 | 매직가드(sup,10), 프로미넌스(mag,20), 태양의축복(sup,30) | card/game/data.js:182 |
| avalanche_maid | 아발란체메이드 | epic | water | balancer | base CARDS | syn_water_3_ice_age: 덱에 물 3장 이상 시 아이스에이지 최대배율 대폭 증가 | 배리어(sup,10), 빙하의일격(phy,20), 아이스에이지(mag,30) | card/game/data.js:192 |
| archangel | 대천사 | epic | light | balancer | base CARDS | syn_light_dark_matk_mdef: 덱에 빛과 어둠이 있을 경우 마법 공격력/마법 방어력 50% 증가 | 매직가드(sup,10), 성역전개(sup,20), 홀리레이(mag,20) | card/game/data.js:202 |
| pudding_princess | 푸딩프린세스 | epic | water | balancer | base CARDS | cond_silence_dmg: 침묵 걸린 적에게 피해 1.5배 | 배리어(sup,10), 푸딩러쉬(phy,20), 푸딩파라다이스(mag,30) | card/game/data.js:212 |
| ghost_king | 고스트킹 | epic | dark | debuffer | base CARDS | syn_dark_3_matk: 덱에 어둠 3장 이상 시 마법 공격력 50% 증가 | 회피태세(sup,10), 고스트소울(mag,20), 네더커스(sup,20) | card/game/data.js:222 |
| fairy_queen | 페어리퀸 | epic | light | debuffer | base CARDS | death_debuff: 사망시 적에게 기절 부여 | 배리어(sup,10), 스피릿왈츠(mag,20), 이터널위스퍼(mag,30) | card/game/data.js:232 |
| baby_dragon | 베이비드래곤 | rare | fire | looter | base CARDS | looter: 이 카드로 승리시 추가 드로우 | 가드(sup,10), 베이비브레스(mag,10), 드래곤크로(phy,20) | card/game/data.js:244 |
| chaos_mage | 혼돈의마법사 | rare | dark | dealer | base CARDS | pos_stat_boost: 선봉배치시 마법 공격력 50%증가 | 매직가드(sup,10), 카오스카니발(mag,30), 다크니스(mag,20) | card/game/data.js:254 |
| fenrir | 펜리르 | rare | water | dealer | base CARDS | pos_stat_boost: 대장 배치시 물리 방어력/마법 방어력 30%증가 | 회피태세(sup,10), 프로스트팽(phy,20), 윈터하울링(mag,30) | card/game/data.js:264 |
| night_rabbit | 밤토끼 | rare | dark | dealer | base CARDS | syn_snow_rabbit: 눈토끼 혹은 은토끼가 덱에 있을시 물리 공격력·물리 방어력 50% 증가 | 배리어(sup,10), 깡총깡총(phy,20), 문라이트(mag,20) | card/game/data.js:274 |
| light_elemental | 라이트엘리멘탈 | rare | light | buffer | base CARDS | pos_stat_boost: 중견 배치시 마법 공격력 30%증가 | 매직가드(sup,10), 문라이트세레나(sup,20), 선라이트플레임(mag,20) | card/game/data.js:284 |
| cream_maid | 생크림메이드 | rare | light | buffer | base CARDS | cond_twinkle_all: 트윙클파티 상태에서 물리/마법 공격력 50%증가 | 배리어(sup,10), 크림샷(mag,20), 크림익스플로전(mag,20) | card/game/data.js:294 |
| golem | 골렘 | rare | nature | balancer | base CARDS | syn_nature_3_golem: 덱에 자연 3장 이상 시 물리 공격력/물리 방어력 30% 증가 | 가드(sup,10), 차지어택(phy,20), 콜로세움(sup,30) | card/game/data.js:304 |
| void_knight | 공허의기사 | rare | dark | balancer | base CARDS | cond_corrosion_dmg: 부식상태의 적에게 피해 1.5배 | 회피태세(sup,10), 강타(phy,20), 급소베기(phy,20) | card/game/data.js:314 |
| sphinx | 스핑크스 | rare | nature | debuffer | base CARDS | pos_stat_boost: 선봉 배치시 물리 방어력 50%증가 | 매직가드(sup,10), 샌드스톰(mag,20), 수수께끼(sup,10) | card/game/data.js:324 |
| silent_librarian | 침묵의사서 | rare | water | debuffer | base CARDS | death_dmg_mag: 사망시 적에게 300% 마법 피해 | 배리어(sup,10), 사일런트(mag,20), 위크니스(sup,10) | card/game/data.js:334 |
| mirage | 신기루 | rare | fire | debuffer | base CARDS | death_debuff: 사망시 암흑 부여 | 회피태세(sup,10), 미라지프레임(mag,30), 팬텀러쉬(phy,30) | card/game/data.js:344 |
| marshmallow | 마시멜로 | normal | fire | balancer | base CARDS | death_sun_bless_chance: 사망시 50%확률로 태양의축복 부여 | 회피태세(sup,10), 기습(phy,10), 멜팅허그(mag,20) | card/game/data.js:356 |
| kobold | 코볼트 | normal | nature | looter | base CARDS | looter: 이 카드로 승리시 추가 드로우 | 회피태세(sup,10), 기습(phy,10), 강타(phy,20) | card/game/data.js:366 |
| werebear | 웨어베어 | normal | nature | dealer | base CARDS | pos_rear_atk: 대장 배치시 물리 공격력 30%증가 | 회피태세(sup,10), 베어러쉬(phy,10), 강타(phy,20) | card/game/data.js:376 |
| vampire | 뱀파이어 | normal | dark | dealer | base CARDS | cond_silence_dmg: 침묵상태 적에게 피해 1.5배 | 회피태세(sup,10), 블러드드레인(mag,10), 다크니스(mag,20) | card/game/data.js:386 |
| snow_rabbit | 눈토끼 | normal | water | dealer | base CARDS | syn_night_rabbit: 밤토끼 혹은 은토끼가 덱에 있을시 마법 공격력·마법 방어력 50% 증가 | 배리어(sup,10), 스노우샷(mag,20), 실버스톰(mag,20) | card/game/data.js:396 |
| silver_rabbit | 은토끼 | normal | light | dealer | base CARDS | syn_silver_rabbit: 눈토끼 혹은 밤토끼가 덱에 있을시 물리 공격력·마법 공격력 50% 증가 | 헤븐리루어(mag,20), 깡총깡총(phy,20), 배리어(sup,10) | card/game/data.js:406 |
| fairy | 페어리 | normal | light | buffer | base CARDS | pos_stat_boost: 선봉 배치시 마법 방어력 20%증가 | 배리어(sup,10), 에너지볼(mag,10), 스타파우더(sup,20) | card/game/data.js:416 |
| candy_boy | 캔디보이 | normal | light | buffer | base CARDS | syn_light_fire_atk: 덱에 빛과 불이 있을 경우 마법 공격력 50% 증가 | 가드(sup,10), 캔디버스트(mag,10), 캔디파라다이스(sup,20) | card/game/data.js:426 |
| slime | 슬라임 | normal | water | balancer | base CARDS | slime_synergy_boost: 덱에 있는 다른 슬라임 하나당 물리 공격력/물리 방어력 30% 증가 | 회피태세(sup,10), 산성액(mag,10), 강타(phy,20) | card/game/data.js:436 |
| mummy | 미이라 | normal | nature | balancer | base CARDS | mid_party_mdef_boost: 중견 배치시 덱 전체 마법 방어력 15% 증가 | 회피태세(sup,10), 기습(phy,10), 바인드(sup,10) | card/game/data.js:446 |
| mimic | 미믹 | normal | dark | looter | base CARDS | looter: 이 카드로 승리 시 추가 드로우 | 가드(sup,10), 기습(phy,10), 다크니스(mag,20) | card/game/data.js:456 |
| jack_o_lantern | 잭오랜턴 | normal | fire | debuffer | base CARDS | pos_stat_boost: 선봉 배치시 마법 공격력 20%증가 | 회피태세(sup,10), 저주의불꽃(mag,20), 침묵의불꽃(sup,10) | card/game/data.js:466 |
| rumi_bunny | 루미(바니) | event | dark | balancer | base CARDS | party_stat_boost: 파티 전체 물리 공격력 30%상승 | 매직가드(sup,10), 미드나잇쇼(phy,30), 커튼콜(phy,20) | card/game/data.js:478 |
| rumi_maid | 루미(메이드) | event | nature | balancer | base CARDS | party_stat_boost: 파티 전체 물리 방어력 30%상승 | 매직가드(sup,10), 특제생크림(sup,30), 달콤한유혹(mag,30) | card/game/data.js:488 |
| rumi_miko | 루미(무녀) | event | fire | balancer | base CARDS | party_stat_boost: 파티 전체 마법 공격력 30%상승 | 매직가드(sup,10), 파마부(mag,30), 화염부(sup,30) | card/game/data.js:498 |
| rumi_fairy | 루미(페어리) | event | light | balancer | base CARDS | party_stat_boost: 파티 전체 마법 방어력 30%상승 | 매직가드(sup,10), 요정의장난(mag,30), 요정의축복(sup,30) | card/game/data.js:508 |
| rumi_wedding | 루미(웨딩) | event | water | balancer | base CARDS | party_stat_boost: 파티 전체 물리 공격력·마법 공격력·물리 방어력·마법 방어력 15%상승 | 매직가드(sup,10), 하트샤워(mag,30), 순백의축복(sup,30) | card/game/data.js:518 |
| phoenix | 피닉스 | legend | fire | buffer | bonus | syn_fire_3_crit_burn: 덱에 불 3장 이상 시 치명타율 50% 증가 / 일반 공격 시 | 매직가드(sup,10), 메테오임팩트(phy,30), 샤이닝플레임(mag,30) | card/game/data.js:532 |
| gray | 그레이 | legend | dark | dealer | bonus | crit_ignore_def_add: 치명타 발생시 물리 방어력·마법 방어력 50% 관통 | 회피태세(sup,10), 영혼절단(mag,30), 차원절단(phy,30) | card/game/data.js:542 |
| phantom | 팬텀 | legend | dark | dealer | bonus | field_buff_immune: 이 카드는 필드 버프를 받지 않는다 | 회피태세(sup,10), 나이트메어(mag,20), 소울디스트로이어(mag,30) | card/game/data.js:552 |
| cinderella | 신데렐라 | legend | light | debuffer | bonus | ignore_def_mdef_by_stack: 작열 1스택당 물리 방어력 10% 무시 / 디바인 1스택당 마법 방어력 10% | 매직가드(sup,10), 크리스탈킥(phy,20), 미드나잇스펠(mag,30) | card/game/data.js:577 |
| sakura | 사쿠라 | legend | fire | debuffer | bonus | cond_target_elements_dmg: 자연/어둠속성 적에게 피해 1.5배 | 매직가드(sup,10), 봉인부(mag,30), 폭염부(mag,30) | card/game/data.js:587 |
| galaxy_whale | 은하고래 | legend | light | dealer | bonus | syn_light_3_matk_mdef: 덱에 빛 3장 이상 시 마법 공격력/마법 방어력 50% 증가 | 배리어(sup,10), 슈퍼노바펄스(mag,30), 앱솔루트라이트(mag,30) | card/game/data.js:597 |
| ancient_dragon | 에인션트드래곤 | legend | nature | debuffer | bonus | death_multi_debuff: 사망시 적에게 약화, 부식, 저주, 침묵, 기절 부여 | 가드(sup,10), 드래곤크로(phy,20), 에인션트브레스(mag,30) | card/game/data.js:607 |
| red_moon | 레드문 | legend | fire | dealer | bonus | death_dmg_phy: 사망 시 적에게 600% 물리 피해 | 가드(sup,10), 데이브레이커(phy,30), 이터널플레임(mag,30) | card/game/data.js:617 |
| ancient_soul | 에인션트소울 | legend | fire | dealer | bonus | normal_attack_burn_divine: 일반공격시 적에게 작열, 디바인 부여 | 회피태세(sup,10), 성염(mag,20), 영혼수확(mag,30) | card/game/data.js:628 |
| priest_of_end | 종말의사제 | epic | dark | buffer | bonus | syn_dark_3_all_stats: 덱이 전부 어둠일 시 물리 공격력·마법 공격력·물리 방어력·마법 방어력 40% 증가 | 배리어(sup,10), 매직가드(sup,10), 사신강림(mag,30) | card/game/data.js:640 |
| unicorn | 유니콘 | epic | light | looter | bonus | looter: 이 카드로 승리 시 추가 드로우 | 매직가드(sup,10), 홀리차지(phy,20), 실버문베일(sup,30) | card/game/data.js:650 |
| mushroom_king | 머쉬룸킹 | epic | nature | dealer | bonus | cond_earth_def_mdef: 대지의축복 상태에서 물리 방어력/마법 방어력 50% 증가 | 가드(sup,10), 그랜드슬램(phy,30), 스포어미스트(mag,30) | card/game/data.js:660 |
| jellyfish_princess | 젤리피쉬프린세스 | epic | water | debuffer | bonus | on_hit_random_debuff: 해파리독: 피격 시 적에게 ‘부식·약화·침묵·저주·기절’ 중 무작위 1종 부여 | 가드(sup,10), 오로라텐타클(mag,20), 크리스탈레퀴엠(phy,30) | card/game/data.js:670 |
| eclipse_queen | 이클립스퀸 | epic | dark | balancer | bonus | syn_dark_3_party_atk: 덱이 전부 어둠일 시 파티 전체 물리 공격력 50% 증가 | 회피태세(sup,10), 섀도우코로나(phy,20), 녹턴윙스(mag,20) | card/game/data.js:680 |
| crystal_dancer | 수정의무희 | epic | water | dealer | bonus | on_evasion_stun: 회피 성공 시 상대에게 기절 부여 | 회피태세(sup,10), 댄싱대거(phy,20), 하트브레이커(mag,30) | card/game/data.js:690 |
| sun_priestess | 태양의무녀 | epic | nature | buffer | bonus | death_field_buff_count_dmg: 사망시 적용중인 필드 버프수 x2배율 피해 | 배리어(sup,10), 풍요의축제(sup,30), 태양의춤(mag,20) | card/game/data.js:701 |
| hellhound | 헬하운드 | rare | fire | balancer | bonus | death_twinkle: 사망 시 필드 버프 트윙클파티 발동 | 가드(sup,10), 섀도우러쉬(mag,20), 헬바이트(phy,20) | card/game/data.js:713 |
| siren | 세이렌 | rare | water | buffer | bonus | syn_water_2_moon_twinkle: 덱에 물 2장 이상 시, 실버문베일 발동 시 트윙클파티 추가 발동 | 매직가드(sup,10), 실버문베일(sup,30), 타이달스크림(mag,20) | card/game/data.js:723 |
| fallen_angel | 타천사 | rare | dark | dealer | bonus | cond_darkness_dmg: 암흑 상태의 적에게 피해 1.5배 | 배리어(sup,10), 다크레이(mag,20), 타락의낙인(phy,20) | card/game/data.js:733 |
| forget_me_not | 물망초 | rare | nature | buffer | bonus | death_field_buff: 사망 시 필드 버프 대지의축복 부여 | 매직가드(sup,10), 블루메모리(sup,20), 미드나잇가든(mag,30) | card/game/data.js:743 |
| aurora | 아우로라 | rare | water | looter | bonus | looter: 이 카드로 승리 시 추가 드로우 | 리버설(sup,20), 리플렉션(sup,20), 라비린스(mag,20) | card/game/data.js:753 |
| time_magician | 시간의마술사 | rare | dark | balancer | bonus | instant_delayed_skills: 덱의 지연 스킬이 즉시 발동 | 가드(sup,10), 엑셀레이터(mag,20), 데스클록(mag,30) | card/game/data.js:763 |
| cotton_candy_sheep | 솜사탕양 | rare | water | balancer | bonus | death_debuff: 사망시 상대에게 기절 부여 | 가드(sup,10), 자장가(phy,20), 솜사탕(mag,30) | card/game/data.js:774 |
| shadow_cat | 섀도우캣 | normal | dark | debuffer | bonus | death_debuff: 사망 시 암흑 부여 | 회피태세(sup,10), 사일런트스텝(phy,20), 베놈슬래시(phy,20) | card/game/data.js:786 |
| snow_penguin | 눈꽃펭귄 | normal | water | debuffer | bonus | death_debuff: 사망 시 적에게 약화 부여 | 가드(sup,10), 제트슬라이드(phy,30), 콜드웨이크(mag,20) | card/game/data.js:796 |
| desert_fox | 사막여우 | normal | fire | debuffer | bonus | death_debuff: 사망 시 적에게 작열 3스택 부여 | 가드(sup,10), 황금폭풍(mag,20), 모래돌진(phy,20) | card/game/data.js:806 |
| blessing_tail | 블레싱테일 | normal | light | buffer | bonus | death_debuff: 사망 시 적에게 디바인 3스택 부여 | 매직가드(sup,10), 홀리블레싱(sup,30), 폭스플레임(mag,20) | card/game/data.js:816 |
| sunflower | 해바라기 | normal | nature | dealer | bonus | cond_sun_matk_mdef: 태양의축복 상태에서 마법 공격력/마법 방어력 100%증가 | 배리어(sup,10), 솔라플레어(mag,30), 어쓰블라썸(phy,20) | card/game/data.js:826 |
| joker | 조커 | normal | nature | balancer | bonus | joker_wild: 이 카드는 모든 속성, 모든 이름으로 취급 | 가드(sup,10), 레인보우룰렛(sup,100), 와일드카드(sup,100) | card/game/data.js:836 |
| doom_luther | 둠 | legend | dark | looter | bonus expansion | looter: 이 카드로 승리 시 추가 드로우 | 진실의거울(phy,20), 허실의거울(mag,20), 갓킬러(phy,20) | card/game/data.js:849 |
| cure_master | 큐어마스터 | legend | water | balancer | bonus expansion | cure_master_trait: 덱에 물 3장 이상 시 마법 방어력 50% 증가 / 일반 공격 | 레모네이드(sup,30), 멜트다운(mag,20), 굿나잇키스(mag,30) | card/game/data.js:859 |
| cherry_prince | 체리프린스 | legend | fire | dealer | bonus expansion | burn_stack_phy_pen: 작열 1스택당 적의 물리 방어력 30% 관통 | 체리로열가드(sup,20), 블러썸피어스(phy,20), 루비스타카토(mag,30) | card/game/data.js:869 |
| sylphid | 실피드 | legend | nature | dealer | bonus expansion | opening_atk_matk: 3턴 이내 물리 공격력/마법 공격력 50% 증가 | 회피태세(sup,10), 실프스탭(phy,20), 템페스트크로(mag,30) | card/game/data.js:879 |
| harmonius | 하모니어스 | legend | light | dealer | bonus expansion | dessert_kingdom_synergy_boost: 덱에 있는 자신을 제외한 디저트킹덤 카드 하나당 물리 공격력/마법 공격력 50% 증가 | 가드(sup,10), 스위트드롭(phy,20), 시트러스윙크(mag,20) | card/game/data.js:889 |
| alchemist | 연금술사 | epic | water | buffer | bonus expansion | reverse_atk_matk_party: 덱의 모든 카드의 물리공격과 마법공격이 뒤바뀐다 | 매직가드(sup,10), 금단의실험(mag,30), 은빛마법진(sup,30) | card/game/data.js:899 |
| santa | 산타 | epic | light | buffer | bonus expansion | syn_light_3_party_def_mdef: 덱이 전부 빛일 시 파티 전체 물리 방어력/마법 방어력 30% 증가 | 배리어(sup,10), 프레젠트(sup,30), 징글벨(mag,30) | card/game/data.js:909 |
| guardian | 가디언 | epic | nature | balancer | bonus expansion | guardian_hidden_trait: 선봉 배치 시 물리 공격력 30% 증가 / 덱 전체의 [가드] 스킬 | 가드(sup,10), 배틀필드(sup,20), 판게아리버스(mag,30) | card/game/data.js:919 |
| ash | 애쉬 | epic | fire | dealer | bonus expansion | ally_death_base_atk_phy: 애쉬가 생존해 있을 경우, 아군 사망 시 자신의 기본 물리 공격력 기준 | 회피태세(sup,10), 아마겟돈(phy,30), 드림파이어(mag,30) | card/game/data.js:929 |
| legendary_captain | 전설의선장 | rare | water | balancer | bonus expansion | death_debuff: 사망 시 적에게 기절 부여 | 가드(sup,10), 앵커체인(phy,20), 선상결투(sup,20) | card/game/data.js:939 |
| ember_tiger | 엠버타이거 | rare | fire | balancer | bonus expansion | party_normal_attack_dmg: 덱 전체의 일반 공격 피해 2배 | 가드(sup,10), 와일드러쉬(phy,30), 블레이즈크로(mag,30) | card/game/data.js:949 |
| executor | 처형인 | normal | nature | balancer | bonus expansion | opening_atk_def: 전투 시작 후 3턴간 물리 공격력/물리 방어력 50% 증가 | 가드(sup,10), 워크라이(sup,20), 섀도우길로틴(mag,20) | card/game/data.js:959 |
| black_swan | 블랙스완 | normal | dark | dealer | bonus expansion | syn_dark_full_party_crit: 덱이 전부 어둠일 시 파티 전체 치명타율 20% 증가 | 회피태세(sup,10), 흑조의속삭임(phy,20), 운명의무도(mag,30) | card/game/data.js:969 |
| prism_twin | 프리즘트윈 | rare | light | balancer | bonus expansion | self_normal_atk_dmg_boost: 이 카드의 일반 공격 피해 2배 | 회피태세(sup,10), 프리즘셔플(mag,20), 일루미네이션(mag,30) | card/game/data.js:981 |
| underdog | 언더독 | normal | nature | dealer | bonus expansion | cond_same_grade_leader_boost: 덱 전체가 같은 등급이고 대장 배치 시 물리 공격력/마법 공격력 100% 증가 | 퍼펙트머슬(sup,30), 빅쇼(sup,20), 기가크러셔(mag,30) | card/game/data.js:991 |
| sugar_powder | 슈가파우더 | normal | light | dealer | bonus expansion | dessert_kingdom_crit_eva_boost: 디저트킹덤 카드 전체 치명타율/회피율 20% 증가 | 가드(sup,10), 그랜드케이크(mag,30), 캔디메테오(phy,30) | card/game/data.js:1001 |
| skull_dragon | 스컬드래곤 | rare | dark | dealer | bonus expansion | leader_self_atk_party_def_down: 대장 배치 시 자기 물리 공격력 100% 증가, 덱 전체 물리 방어력 | 가드(sup,10), 드래곤크로(phy,20), 스컬브레스(mag,30) | card/game/data.js:1011 |
| dragon_miko | 용혈의무녀 | epic | fire | balancer | bonus expansion | death_dmg_mag_stun_cond: 덱에 드래곤이 존재할 경우 사망 시 500% 마법 피해와 기절 부여 | 매직가드(sup,10), 스파클(mag,30), 버닝스피릿(mag,20) | card/game/data.js:1021 |
| perfect_aurora | 퍼펙트아우로라 | legend | water | debuffer | bonus expansion | field_buff_immune: 이 카드는 필드 버프를 받지 않는다 | 진실의거울(phy,20), 허실의거울(mag,20), 퍼펙트플랜(mag,30) | card/game/data.js:1031 |
| flare_ribbon | 플레어리본 | normal | fire | buffer | bonus expansion | cond_same_grade_skill_buff: 덱 전체가 같은 등급일 경우 리듬하이 발동 시 태양의축복 추가 부여 | 가드(sup,10), 리듬하이(sup,30), 스파클래쉬(mag,20) | card/game/data.js:1041 |
| entropy | 앤트로피 | rare | nature | dealer | bonus expansion | chaos_blessing_double: 혼돈의 축복 효과가 2배로 적용된다 | 매직가드(sup,10), 노바레퀴엠(phy,30), 화이트노이즈(mag,30) | card/game/data.js:1051 |
| tinker_bell | 팅커벨 | rare | light | debuffer | bonus expansion | death_dmg_mag_stun_same_grade: 덱 전체가 같은 등급일 경우 사망 시 500% 마법 피해와 기절 부여 | 매직가드(sup,10), 픽시더스트(mag,20), 네버랜드(mag,30) | card/game/data.js:1061 |
| gumiho | 구미호 | epic | dark | dealer | bonus expansion | cond_same_grade_matk_boost: 덱 전체가 같은 등급일 경우 마법 공격력 100% 증가 | 회피태세(sup,10), 여우불(mag,20), 요화천벌(mag,30) | card/game/data.js:1071 |
| venom | 베놈 | legend | nature | debuffer | bonus expansion | death_dmg_phy_debuff: 사망시 400% 물리 피해 + 부식 | 가드(sup,10), 플래이그(mag,20), 베놈허그(phy,30) | card/game/data.js:1081 |
| dainichi_nyorai | 대일여래 | legend | light | balancer | bonus expansion | death_clear_field_add_buff: 사망시 모든 필드 버프를 제거하고 대지의축복 부여 | 오지관제(sup,10), 일체지광(mag,20), 파쇄륜(phy,30) | card/game/data.js:1091 |
| discipline_captain | 선도부장 | normal | nature | balancer | bonus expansion | vanguard_all_grade_party_def_mdef: 선봉 배치 및 덱 전체 일반등급 시 덱 전체 물리 방어력/마법 방어력 | 가드(sup,10), 잔소리(phy,20), 기강확립(mag,20) | card/game/data.js:1103 |
| supernova | 초신성 | legend | fire | dealer | bonus expansion | death_dmg_phy_debuff: 사망 시 적에게 400% 물리 피해와 작열 3스택 부여 | 가드(sup,10), 파이널버스트(phy,30), 코어멜트다운(mag,30) | card/game/data.js:1113 |
| shooting_star_boy | 별똥별소년 | normal | light | dealer | bonus expansion | opening_self_atk_party_mdef_down: 등장 후 2턴간 물리 공격력 100% 증가 / 덱 전체 마법 방어력 | 배리어(sup,10), 스타폴대쉬(phy,20), 슈팅플레어(mag,20) | card/game/data.js:1123 |
| victoria | 빅토리아 | legend | light | buffer | bonus expansion | leader_field_stat_double: 대장 배치 시 아레나를 제외한 필드 버프의 능력치 효과를 2배로 받음 | 디바인아머(sup,20), 에태르랜스(mag,20), 기적의증명(sup,30) | card/game/data.js:1133 |
| holy_night | 홀리밤 | normal | light | dealer | bonus expansion | death_dmg_phy: 사망 시 적에게 300% 물리 피해 | 회피태세(sup,10), 샤이닝팝(phy,20), 라스트캐럴(phy,30) | card/game/data.js:1143 |
| paladin | 팔라딘 | epic | light | balancer | bonus expansion | pos_stat_boost: 중견 배치 시 물리 공격력 100% 증가 | 디바인아머(sup,20), 홀리그라운드(mag,30), 듀얼브레이커(mag,20) | card/game/data.js:1153 |
| mad_scientist | 매드사이언티스트 | rare | nature | balancer | bonus expansion | party_all_stats_mana_cost: 덱 전체 물리 공격력·마법 공격력·물리 방어력·마법 방어력 30% 증가 / 스킬 MP | 가드(sup,10), 익스페리먼트(mag,20), 다크인젝션(phy,20) | card/game/data.js:1163 |
| grand_merchant | 대상인 | rare | light | balancer | bonus expansion | death_next_ally_max_mana: 사망 시 다음 아군의 최대 MP와 현재 MP 20 증가 | 회피태세(sup,10), 마나콜렉트(sup,10), 골드러쉬(mag,30) | card/game/data.js:1173 |
| comet_tracker | 혜성추적자 | rare | fire | balancer | bonus expansion | vanguard_delayed_mana_restore: 선봉 배치 시 덱의 지연 스킬이 실제 발동할 때 시전자가 MP 10 | 매직가드(sup,10), 코멧트래킹(mag,30), 코멧플레임(mag,30) | card/game/data.js:1183 |
| prophet | 예언자 | legend | water | buffer | bonus expansion | field_kaleidoscope_each_turn: 매 턴 시작 시 모든 필드 버프를 무작위로 변경 | 매직가드(sup,10), 샤이닝오라클(sup,20), 슈퍼내추럴(sup,30) | card/game/data.js:1193 |
| fireworks_girl | 폭죽소녀 | epic | fire | dealer | bonus expansion | death_dmg_phy_same_grade: 덱 전체가 같은 등급일 경우 사망 시 적에게 800% 물리 피해 | 회피태세(sup,10), 페스티벌나이트(phy,30), 스파클캐논(mag,20) | card/game/data.js:1203 |
| astrologer | 점성술사 | epic | water | buffer | bonus expansion | alternate_party_atk_matk_turn: 덱 전체가 홀수 턴에는 물리 공격력 50% 감소·마법 공격력 50% 증가, 짝수 | 매직가드(sup,10), 스텔라리딩(sup,30), 솔라브레이커(mag,20) | card/game/data.js:1220 |
| sun_moon_sword_maiden | 일월검희 | legend | light | dealer | bonus expansion | alternate_skill_type_mana: 이전에 사용한 스킬과 다른 타입의 스킬 사용 시 MP 10 회복 | 회피태세(sup,10), 솔라크레센토(phy,30), 루나크레센토(mag,30) | card/game/data.js:1230 |
| succubus | 서큐버스 | rare | dark | debuffer | bonus expansion | death_debuff: 사망 시 적에게 침묵 부여 | 매직가드(sup,10), 페이탈핑크(mag,30), 다크판타지(mag,30) | card/game/data.js:1240 |
| trauma | 트라우마 | epic | dark | dealer | bonus expansion | leader_hp_cost_on_skill: 스킬 발동 시 대장 HP 35% 소모 | 회피태세(sup,10), 스티그마(mag,30), 마인드브레이커(mag,30) | card/game/data.js:1250 |
| great_detective | 명탐정 | epic | water | balancer | bonus expansion | deck_turn_modulo_force_crit: 덱 전체가 5의 배수 턴에 반드시 치명타 | 회피태세(sup,10), 루시드플래시(phy,30), 파이널앤서(mag,30) | card/game/data.js:1260 |
| blue_moon_priest | 푸른달의사제 | legend | water | buffer | bonus expansion | vanguard_moon_bless_every_3_turns: 선봉 배치 시 3의 배수 턴마다 달의축복 부여 | 매직가드(sup,10), 창조의기도(mag,30), 파괴의기도(mag,30) | card/game/data.js:1270 |
| brulee_witch | 브륄레위치 | epic | nature | debuffer | bonus expansion | death_twinkle: 사망 시 필드 버프 트윙클파티 발동 | 버닝시럽(phy,30), 홀리글레이즈(mag,30), 매직가드(sup,10) | card/game/data.js:1282 |
| miracle_larva | 미라클라바 | epic | nature | balancer | bonus expansion | cond_earth_def_mdef: 대지의축복 상태에서 물리 방어력/마법 방어력 50% 증가 | 가드(sup,10), 변태(sup,10), 실크바인드(mag,10) | card/game/data.js:1292 |
| toffee_apple | 토피애플 | rare | dark | debuffer | bonus expansion | cond_silence_def_mdef: 침묵 상태에서 물리 방어력/마법 방어력 50% 증가 | 가드(sup,10), 애프터테이스트(mag,30), 슈거노이즈(mag,20) | card/game/data.js:1302 |
| trans_executor | 종언의집행자 | transcendence | dark | debuffer | transcendence | pos_stat_boost: 중견 배치시 마법 공격력·마법 방어력 30%증가 | 매직가드(sup,10), 이터널리와인드(sup,30), 인과역전(mag,30) | card/game/data.js:1825 |
| trans_yeon_rabbit | 연토끼 | transcendence | fire | dealer | transcendence | rabbit_synergy_boost: 자신 덱에 있는 토끼의 수 만큼 물리 공격력·마법 공격력이 50%증가 | 배리어(sup,10), 홍련각(mag,30), 천화낙영(phy,30) | card/game/data.js:1835 |
| trans_luna_jasmine | 루나&자스민 | transcendence | light | balancer | transcendence | luna_jasmine_trait: 디바인 3스택 이상인 적에게 피해 2배 / 여신강림 상태에서 회피율/치명타 25% 증가 | 회피태세(sup,10), 여신강림(sup,30), 루나블레이드(mag,30) | card/game/data.js:1845 |
| trans_cinderella | 신데렐라(미라클폼) | transcendence | light | debuffer | transcendence | ignore_def_mdef_by_stack: 작열 1스택당 물리 방어력 15% 무시 / 디바인 1스택당 마법 방어력 15% | 배리어(sup,10), 샤터링비트(phy,20), 미라클스펠(mag,30) | card/game/data.js:1855 |
| trans_chaos_lord | 카오스로드 | transcendence | nature | balancer | transcendence | all_advantage: 이 카드는 모든 적에게 상성 유리 피해를 준다. | 가드(sup,10), 프리즘브레이커(mag,30), 데스티니룰렛(sup,10) | card/game/data.js:1865 |
| trans_behemoth | 베히모스(해방) | transcendence | nature | dealer | transcendence | behemoth_liberated_trait: 적의 디버프가 3종 이상일 때 피해 1.5배 / 스킬 사용 시 20% | 가드(sup,10), 월드브레이커(phy,30), 제로그라비티(mag,30) | card/game/data.js:1875 |
| trans_lumi | 루미(꿈의형태) | transcendence | water | buffer | transcendence | normal_attack_mana_restore: 일반 공격 시 MP 20 회복 | 매직가드(sup,10), 코스믹하모니(mag,30), 꿈의형태(mag,30) | card/game/data.js:1885 |
| trans_gray | 사신그레이 | transcendence | dark | dealer | bonus transcendence | crit_ignore_def_add: 치명타 발생시 물리 방어력·마법 방어력 50% 관통 | 회피태세(sup,10), 보이드이터(mag,30), 디멘션제로(phy,30) | card/game/data.js:1898 |
| trans_thor | 뇌신토르 | transcendence | light | dealer | bonus transcendence | cond_sanctuary_atk_def: 성역 상태에서 물리 공격력, 물리 방어력 100% 증가 | 매직가드(sup,10), 묠니르(phy,30), 썬더러쉬(mag,30) | card/game/data.js:1908 |
| trans_ares | 투신아레스 | transcendence | fire | dealer | bonus transcendence | syn_fire_3_atk_boost: 덱에 불 3장 이상 시 물리 공격력 100% 증가 | 앱솔루트아머(sup,30), 테라소드(phy,30), 마그마이럽션(mag,30) | card/game/data.js:1926 |
| trans_poseidon | 해신포세이돈 | transcendence | water | balancer | bonus transcendence | guard_stun_double_dmg: 가드 성공 시 적에게 기절 부여 / 기절 상태의 적에게 피해 2배 | 가드(sup,10), 트라이던트(phy,30), 어비스프레셔(mag,30) | card/game/data.js:1940 |
| trans_flora | 플로라 | transcendence | nature | buffer | bonus transcendence | syn_nature_3_party_def_mdef: 덱이 전부 자연일 시 파티 전체 물리 방어력/마법 방어력 50% 증가 | 가드(sup,10), 제네시스블룸(sup,30), 블러썸템페스트(mag,30) | card/game/data.js:1954 |
| luna_valentine | 루나(발렌타인) | legend | dark | dealer | special variant of luna | cond_no_field_buff_eva_crit: 필드 버프가 없을 시 회피율/치명타 25%증가 | 회피태세(sup,10), 이클립스(phy,30), 스위트커스(mag,30) | card/game/data.js:1437 |
| jasmine_valentine | 자스민(발렌타인) | legend | light | buffer | special variant of jasmine | cond_divine_3_dmg: 디바인 3스택 이상인 적에게 피해 2배 | 배리어(sup,10), 벨벳인챈트(mag,20), 여신강림(sup,30) | card/game/data.js:1438 |
| rumi_valentine | 루미(발렌타인) | legend | water | balancer | special variant of rumi | syn_water_light_heart_star: 덱에 물과 빛이 있을 경우, 하트오버드라이브 발동 시 스타파우더 추가 발동 | 초콜릿샤워(mag,30), 하트오버드라이브(sup,20), 매직가드(sup,10) | card/game/data.js:1439 |
| luna_swimsuit | 루나(수영복) | legend | dark | dealer | special variant of luna | cond_no_field_buff_eva_crit: 필드 버프가 없을 시 회피율/치명타 25%증가 | 회피태세(sup,10), 루나틱스플래시(mag,30), 나이트메어비치(phy,30) | card/game/data.js:1440 |
| jasmine_swimsuit | 자스민(수영복) | legend | light | buffer | special variant of jasmine | death_field_buff_count_dmg: 사망 시 적용 중인 필드 버프 수 x2배율 피해 | 배리어(sup,10), 스플래시미라지(mag,30), 코랄블룸(sup,30) | card/game/data.js:1441 |
| rumi_swimsuit | 루미(수영복) | legend | water | buffer | special variant of rumi | syn_water_light_midnight_twinkle: 덱에 물과 빛이 있을 경우, 미드나잇판타지 발동 시 트윙클파티 추가 발동 | 소다블래스트(mag,30), 미드나잇판타지(sup,30), 매직가드(sup,10) | card/game/data.js:1442 |
| zeke_swimsuit | 지크(수영복) | legend | fire | balancer | special variant of zeke | death_field_sun: 사망시 태양의축복 부여 | 가드(sup,10), 워터멜론크래시(phy,20), 코코넛드롭(phy,30) | card/game/data.js:1443 |
| luna_halloween | 루나(할로윈) | legend | dark | dealer | special variant of luna | cond_no_field_buff_eva_crit: 필드 버프가 없을 시 회피율/치명타 25%증가 | 회피태세(sup,10), 펌킨크래시(phy,30), 러브포션(mag,30) | card/game/data.js:1444 |
| zeke_halloween | 지크(할로윈) | legend | fire | balancer | special variant of zeke | death_field_sun: 사망시 태양의축복 부여 | 가드(sup,10), 에인션트버닝(mag,30), 본디지허그(phy,30) | card/game/data.js:1445 |
| rumi_halloween | 루미(할로윈) | legend | water | debuffer | special variant of rumi | death_multi_debuff_custom: 사망 시 적에게 저주, 부식, 기절 부여 | 호핑스매시(phy,30), 탈리스만씰(mag,30), 매직가드(sup,10) | card/game/data.js:1446 |
| luna_christmas | 루나(크리스마스) | legend | dark | dealer | special variant of luna | weekday_crit_bonus: 토요일 치명타율 35% 증가 | 회피태세(sup,10), 홀리메테오(mag,30), 캔디크러쉬(phy,30) | card/game/data.js:1447 |
| jasmine_christmas | 자스민(크리스마스) | legend | light | balancer | special variant of jasmine | ally_light_death_base_matk_mag: 자스민이 생존해 있을 경우, 덱의 빛속성 카드 사망 시 자신의 기본 마법 | 매직가드(sup,10), 얼티밋기프트(sup,30), 미라클페스티벌(mag,30) | card/game/data.js:1448 |
| rumi_christmas | 루미(크리스마스) | legend | water | dealer | special variant of rumi | crit_ignore_def_add: 치명타 발생시 물리 방어력·마법 방어력 50% 관통 | 매직가드(sup,10), 스타라이트캐롤(mag,30), 오로라이그니션(mag,30) | card/game/data.js:1449 |
| snow_rabbit_valentine | 눈토끼(발렌타인) | normal | water | dealer | special variant of snow_rabbit | syn_rabbit_valentine_snow: 밤토끼 혹은 은토끼가 덱에 있을 경우 소다키스 사용시 발렌타인 발동 | 배리어(sup,10), 소다키스(mag,30), 실버스톰(mag,20) | card/game/data.js:1451 |
| night_rabbit_valentine | 밤토끼(발렌타인) | rare | dark | dealer | special variant of night_rabbit | syn_rabbit_valentine_night: 눈토끼 혹은 은토끼가 덱에 있을 경우 딥키스 사용시 발렌타인 발동 | 배리어(sup,10), 딥키스(mag,30), 문라이트(mag,20) | card/game/data.js:1452 |
| silver_rabbit_valentine | 은토끼(발렌타인) | normal | light | dealer | special variant of silver_rabbit | syn_rabbit_valentine_silver: 눈토끼 혹은 밤토끼가 덱에 있을 경우 화이트키스 사용시 발렌타인 발동 | 배리어(sup,10), 화이트키스(mag,30), 헤븐리루어(mag,20) | card/game/data.js:1453 |
| snow_rabbit_halloween | 눈토끼(할로윈) | normal | water | dealer | special variant of snow_rabbit | halloween_rabbit_peer_boost: 선봉 배치시 덱의 밤토끼/은토끼 마법 공격력·마법 방어력 50% 증가 | 배리어(sup,10), 스노우샷(mag,20), 실버스톰(mag,20) | card/game/data.js:1454 |
| night_rabbit_halloween | 밤토끼(할로윈) | rare | dark | dealer | special variant of night_rabbit | halloween_rabbit_peer_boost: 선봉 배치시 덱의 눈토끼/은토끼 물리 공격력·물리 방어력 50% 증가 | 배리어(sup,10), 깡총깡총(phy,20), 문라이트(mag,20) | card/game/data.js:1455 |
| silver_rabbit_halloween | 은토끼(할로윈) | normal | light | dealer | special variant of silver_rabbit | halloween_rabbit_peer_boost: 선봉 배치시 덱의 눈토끼/밤토끼 물리 공격력·마법 공격력 50% 증가 | 헤븐리루어(mag,20), 깡총깡총(phy,20), 배리어(sup,10) | card/game/data.js:1456 |
| snow_rabbit_swimsuit | 눈토끼(수영복) | normal | water | dealer | special variant of snow_rabbit | syn_night_rabbit: 밤토끼 혹은 은토끼가 덱에 있을시 마법 공격력·마법 방어력 50% 증가 | 배리어(sup,10), 콜드스플래시(mag,30), 서머판타지(mag,30) | card/game/data.js:1457 |
| night_rabbit_swimsuit | 밤토끼(수영복) | rare | dark | dealer | special variant of night_rabbit | syn_snow_rabbit: 눈토끼 혹은 은토끼가 덱에 있을시 물리 공격력·물리 방어력 50% 증가 | 배리어(sup,10), 미드나잇다이빙(phy,30), 루나세레나데(mag,30) | card/game/data.js:1458 |
| silver_rabbit_swimsuit | 은토끼(수영복) | normal | light | dealer | special variant of silver_rabbit | syn_silver_rabbit: 눈토끼 혹은 밤토끼가 덱에 있을시 물리 공격력·마법 공격력 50% 증가 | 배리어(sup,10), 실버서핑(phy,30), 선샤인로맨스(mag,30) | card/game/data.js:1459 |
| snow_rabbit_christmas | 눈토끼(크리스마스) | normal | water | dealer | special variant of snow_rabbit | christmas_rabbit_trio: 밤토끼와 은토끼가 모두 덱에 있으면 물리 공격력·마법 공격력·물리 방어력·마법 방어력 50% 증가 | 배리어(sup,10), 울트라판타지(mag,30), 실버스톰(mag,20) | card/game/data.js:1460 |
| night_rabbit_christmas | 밤토끼(크리스마스) | rare | dark | dealer | special variant of night_rabbit | christmas_rabbit_trio_crit: 눈토끼와 은토끼가 모두 덱에 있으면 덱 전체 치명타 20% 증가 | 배리어(sup,10), 울트라바이올렛(mag,30), 문라이트(mag,20) | card/game/data.js:1461 |
| silver_rabbit_christmas | 은토끼(크리스마스) | normal | light | dealer | special variant of silver_rabbit | syn_christmas_rabbit_trio_gift: 눈토끼와 밤토끼가 모두 덱에 있으면 울트라기프트 사용시 성역+달의축복 추가 발동 | 배리어(sup,10), 울트라기프트(mag,30), 헤븐리루어(mag,20) | card/game/data.js:1462 |
| mirror_cocoon | 미러코쿤 | epic | nature | balancer | battle-only form | cond_earth_def_mdef: 대지의축복 상태에서 물리 방어력/마법 방어력 50% 증가 | 리버설(sup,20), 변태(sup,20), 리플렉션(sup,20) | card/game/data.js:1317 |
| aurora_wing | 오로라윙 | epic | nature | balancer | battle-only form | cond_earth_def_mdef: 대지의축복 상태에서 물리 방어력/마법 방어력 50% 증가 | 가드(sup,10), 미라클파우더(mag,20), 뷰티토네이도(phy,30) | card/game/data.js:1327 |
| abyss_wing | 어비스윙 | epic | nature | balancer | battle-only form | cond_earth_def_mdef: 대지의축복 상태에서 물리 방어력/마법 방어력 50% 증가 | 가드(sup,10), 카오스파우더(mag,20), 베놈더스트(mag,30) | card/game/data.js:1337 |

### Grade x element

| | dark | fire | light | nature | water | total |
|---|---:|---:|---:|---:|---:|---:|
| epic | 6 | 6 | 6 | 9 | 7 | 34 |
| event | 1 | 1 | 1 | 1 | 1 | 5 |
| legend | 9 | 9 | 11 | 6 | 11 | 46 |
| normal | 4 | 4 | 11 | 8 | 7 | 34 |
| rare | 12 | 5 | 5 | 5 | 6 | 33 |
| transcendence | 2 | 2 | 3 | 3 | 2 | 12 |

### Grade x role

| | balancer | buffer | dealer | debuffer | looter | total |
|---|---:|---:|---:|---:|---:|---:|
| epic | 12 | 6 | 9 | 5 | 2 | 34 |
| event | 5 | 0 | 0 | 0 | 0 | 5 |
| legend | 8 | 10 | 18 | 8 | 2 | 46 |
| normal | 6 | 4 | 18 | 4 | 2 | 34 |
| rare | 11 | 4 | 10 | 6 | 2 | 33 |
| transcendence | 3 | 2 | 5 | 2 | 0 | 12 |

### Pool x grade

| | epic | event | legend | normal | rare | transcendence | total |
|---|---:|---:|---:|---:|---:|---:|---:|
| base CARDS | 11 | 5 | 11 | 12 | 11 | 0 | 50 |
| battle-only form | 3 | 0 | 0 | 0 | 0 | 0 | 3 |
| bonus | 7 | 0 | 9 | 6 | 7 | 0 | 29 |
| bonus expansion | 13 | 0 | 13 | 8 | 11 | 0 | 45 |
| bonus transcendence | 0 | 0 | 0 | 0 | 0 | 5 | 5 |
| special variant | 0 | 0 | 13 | 8 | 4 | 0 | 25 |
| transcendence | 0 | 0 | 0 | 0 | 0 | 7 | 7 |

## 2. KEYWORD CLUSTERS

Definition-level index by effect IDs and trait types; matching references may include effects that create or consume a mechanic. The split of enablers and payoffs, and indirect trait interactions, is UNVERIFIED.
- burn: 골드드래곤, 지크, 레드드래곤, 화염의현자, 베이비드래곤, 라이트엘리멘탈, 신기루, 마시멜로, 캔디보이, 잭오랜턴, 루미(무녀), 피닉스, 신데렐라, 사쿠라, 에인션트드래곤, 레드문, 에인션트소울, 태양의무녀, 헬하운드, 사막여우, 체리프린스, 엠버타이거, 용혈의무녀, 구미호, 베놈, 초신성, 별똥별소년, 혜성추적자, 폭죽소녀, 브륄레위치, 연토끼, 신데렐라(미라클폼), 투신아레스, 지크(할로윈), 루미(크리스마스), 어비스윙.
- divine: 자스민, 번개의현자, 대천사, 고스트킹, 페어리퀸, 생크림메이드, 페어리, 루미(페어리), 루미(웨딩), 신데렐라, 사쿠라, 은하고래, 에인션트소울, 유니콘, 타천사, 물망초, 블레싱테일, 산타, 팅커벨, 구미호, 베놈, 대일여래, 홀리밤, 명탐정, 푸른달의사제, 브륄레위치, 신데렐라(미라클폼), 뇌신토르, 자스민(발렌타인), 루나(크리스마스), 자스민(크리스마스), 루미(크리스마스), 어비스윙.
- darkness/corrosion: 루나, 시간의지배자, 혹한의마녀, 폭풍의현자, 그림자추적자, 마왕, 아발란체메이드, 고스트킹, 펜리르, 밤토끼, 공허의기사, 스핑크스, 신기루, 눈토끼, 은토끼, 슬라임, 루미(바니), 팬텀, 신데렐라, 사쿠라, 젤리피쉬프린세스, 이클립스퀸, 타천사, 아우로라, 시간의마술사, 섀도우캣, 사막여우, 체리프린스, 전설의선장, 처형인, 블랙스완, 퍼펙트아우로라, 구미호, 베놈, 빅토리아, 매드사이언티스트, 서큐버스, 트라우마, 브륄레위치, 토피애플, 종언의집행자, 루나&자스민, 신데렐라(미라클폼), 루나(발렌타인), 루나(수영복), 루나(할로윈), 루미(할로윈), 눈토끼(할로윈), 밤토끼(할로윈), 은토끼(할로윈), 눈토끼(수영복), 밤토끼(수영복), 어비스윙.
- stun: 루나, 혹한의마녀, 베히모스, 페어리퀸, 골렘, 사쿠라, 젤리피쉬프린세스, 수정의무희, 솜사탕양, 눈꽃펭귄, 큐어마스터, 애쉬, 전설의선장, 언더독, 용혈의무녀, 퍼펙트아우로라, 팅커벨, 종언의집행자, 베히모스(해방), 해신포세이돈, 루나(수영복), 루미(할로윈), 루나(크리스마스).
- death: 지크, 혹한의마녀, 번개의현자, 페어리퀸, 침묵의사서, 신기루, 마시멜로, 에인션트드래곤, 레드문, 태양의무녀, 헬하운드, 물망초, 솜사탕양, 섀도우캣, 눈꽃펭귄, 사막여우, 블레싱테일, 애쉬, 전설의선장, 용혈의무녀, 팅커벨, 베놈, 대일여래, 초신성, 홀리밤, 대상인, 폭죽소녀, 서큐버스, 브륄레위치, 자스민(수영복), 지크(수영복), 지크(할로윈), 루미(할로윈), 자스민(크리스마스).
- basic attack: 에인션트소울, 엠버타이거, 루미(꿈의형태).
- dragon: 골드드래곤, 레드드래곤, 베이비드래곤, 에인션트드래곤, 스컬드래곤, 용혈의무녀.
- rabbit: 밤토끼, 눈토끼, 은토끼, 연토끼, 눈토끼(발렌타인), 밤토끼(발렌타인), 은토끼(발렌타인), 눈토끼(할로윈), 밤토끼(할로윈), 은토끼(할로윈), 눈토끼(수영복), 밤토끼(수영복), 은토끼(수영복), 눈토끼(크리스마스), 밤토끼(크리스마스), 은토끼(크리스마스).
- dessert: 푸딩프린세스, 생크림메이드, 마시멜로, 캔디보이, 솜사탕양, 하모니어스, 슈가파우더, 브륄레위치, 토피애플.
- looter: 여왕, 그림자추적자, 베이비드래곤, 코볼트, 미믹, 유니콘, 아우로라, 둠.
- delayed: 시간의지배자, 베히모스, 그레이, 종말의사제, 시간의마술사, 블레싱테일, 해바라기, 연금술사, 가디언, 프리즘트윈, 퍼펙트아우로라, 베놈, 빅토리아, 혜성추적자, 폭죽소녀, 트라우마, 푸른달의사제, 토피애플, 종언의집행자, 베히모스(해방), 뇌신토르, 루나(수영복), 자스민(크리스마스).
- position: 골드드래곤, 시간의지배자, 레드드래곤, 혼돈의마법사, 펜리르, 라이트엘리멘탈, 스핑크스, 페어리, 잭오랜턴, 팔라딘, 종언의집행자.
- heal/guard/barrier: 심해의주인, 여왕, 골드드래곤, 루미, 자스민, 세계수, 지크, 시간의지배자, 혹한의마녀, 베히모스, 폭풍의현자, 레드드래곤, 번개의현자, 화염의현자, 아발란체메이드, 대천사, 푸딩프린세스, 페어리퀸, 베이비드래곤, 혼돈의마법사, 밤토끼, 라이트엘리멘탈, 생크림메이드, 골렘, 스핑크스, 침묵의사서, 눈토끼, 은토끼, 페어리, 캔디보이, 미믹, 루미(바니), 루미(메이드), 루미(무녀), 루미(페어리), 루미(웨딩), 피닉스, 신데렐라, 사쿠라, 은하고래, 에인션트드래곤, 레드문, 종말의사제, 유니콘, 머쉬룸킹, 젤리피쉬프린세스, 태양의무녀, 헬하운드, 세이렌, 타천사, 물망초, 아우로라, 시간의마술사, 솜사탕양, 눈꽃펭귄, 사막여우, 블레싱테일, 해바라기, 조커, 둠, 하모니어스, 연금술사, 산타, 가디언, 전설의선장, 엠버타이거, 처형인, 슈가파우더, 스컬드래곤, 용혈의무녀, 퍼펙트아우로라, 플레어리본, 앤트로피, 팅커벨, 베놈, 선도부장, 초신성, 별똥별소년, 매드사이언티스트, 혜성추적자, 예언자, 점성술사, 서큐버스, 푸른달의사제, 브륄레위치, 미라클라바, 토피애플, 종언의집행자, 연토끼, 신데렐라(미라클폼), 카오스로드, 베히모스(해방), 루미(꿈의형태), 뇌신토르, 해신포세이돈, 플로라, 자스민(발렌타인), 루미(발렌타인), 자스민(수영복), 루미(수영복), 지크(수영복), 지크(할로윈), 루미(할로윈), 자스민(크리스마스), 루미(크리스마스), 눈토끼(발렌타인), 밤토끼(발렌타인), 은토끼(발렌타인), 눈토끼(할로윈), 밤토끼(할로윈), 은토끼(할로윈), 눈토끼(수영복), 밤토끼(수영복), 은토끼(수영복), 눈토끼(크리스마스), 밤토끼(크리스마스), 은토끼(크리스마스), 미러코쿤, 오로라윙, 어비스윙.
- field 태양의축복 (sun_bless): 화염의현자, 마시멜로, 루미(무녀), 피닉스, 플레어리본, 점성술사, 일월검희, 플로라, 자스민(수영복), 루미(수영복), 자스민(크리스마스).
- field 달의축복 (moon_bless): 루미, 세계수, 펜리르, 밤토끼, 라이트엘리멘탈, 유니콘, 세이렌, 체리프린스, 연금술사, 블랙스완, 일월검희, 푸른달의사제, 자스민(크리스마스), 밤토끼(발렌타인), 밤토끼(할로윈), 밤토끼(크리스마스).
- field 성역 (sanctuary): 자스민, 대천사, 루미(페어리), 에인션트소울, 블레싱테일, 팔라딘, 푸른달의사제, 뇌신토르, 자스민(크리스마스).
- field 여신강림 (goddess_descent): 자스민, 빅토리아, 루나&자스민, 자스민(발렌타인), 자스민(크리스마스).
- field 운명의서약 (destiny_oath): 루미(웨딩).
- field 대지의축복 (earth_bless): 여왕, 세계수, 베히모스, 폭풍의현자, 골렘, 루미(메이드), 에인션트드래곤, 물망초, 해바라기, 대일여래, 베히모스(해방), 플로라, 자스민(크리스마스).
- field 트윙클파티 (twinkle_party): 캔디보이, 피닉스, 솜사탕양, 하모니어스, 슈가파우더, 용혈의무녀, 플레어리본, 빅토리아, 투신아레스, 자스민(크리스마스), 오로라윙.
- field 스타파우더 (star_powder): 루미, 푸딩프린세스, 생크림메이드, 페어리, 루미(메이드), 루미(페어리), 큐어마스터, 하모니어스, 연금술사, 슈가파우더, 자스민(크리스마스), 루미(크리스마스), 은토끼(크리스마스), 오로라윙.
- field 발렌타인 (valentine): 루나(발렌타인), 자스민(발렌타인), 루미(발렌타인), 눈토끼(발렌타인), 밤토끼(발렌타인), 은토끼(발렌타인).
- field 아레나 (arena): 골렘, 가디언, 전설의선장, 처형인, 언더독, 팔라딘, 투신아레스, 자스민(크리스마스).
- field 사신강림 (reaper_realm): 종말의사제, 푸른달의사제.
- field 질풍 (gale): 실피드.

## 3. BASE SETS AND BONUS POOL

Classic uses the original-base predicate on CARDS, excluding hidden, special, bonus, battle-only and nonstandard grades (card/game/card_pool_rules.js:40, :87). Each themed set specifies 10 cards per grade (card/game/card_pool_rules.js:100).
- 기존 기본덱 (classic): 심해의주인 (deep_lord), 여왕 (queen), 루나 (luna), 골드드래곤 (gold_dragon), 루미 (rumi), 자스민 (jasmine), 세계수 (world_tree), 지크 (zeke), 시간의지배자 (time_ruler), 혹한의마녀 (frozen_witch), 베히모스 (behemoth), 폭풍의현자 (storm_sage), 그림자추적자 (shadow_stalker), 마왕 (mawang), 레드드래곤 (red_dragon), 번개의현자 (lightning_sage), 화염의현자 (flame_sage), 아발란체메이드 (avalanche_maid), 대천사 (archangel), 푸딩프린세스 (pudding_princess), 고스트킹 (ghost_king), 페어리퀸 (fairy_queen), 베이비드래곤 (baby_dragon), 혼돈의마법사 (chaos_mage), 펜리르 (fenrir), 밤토끼 (night_rabbit), 라이트엘리멘탈 (light_elemental), 생크림메이드 (cream_maid), 골렘 (golem), 공허의기사 (void_knight), 스핑크스 (sphinx), 침묵의사서 (silent_librarian), 신기루 (mirage), 마시멜로 (marshmallow), 코볼트 (kobold), 웨어베어 (werebear), 뱀파이어 (vampire), 눈토끼 (snow_rabbit), 은토끼 (silver_rabbit), 페어리 (fairy), 캔디보이 (candy_boy), 슬라임 (slime), 미이라 (mummy), 미믹 (mimic), 잭오랜턴 (jack_o_lantern). card/game/data.js:1355
- 홍련의 계승 (ember_relay): 코볼트 (kobold), 미믹 (mimic), 마시멜로 (marshmallow), 잭오랜턴 (jack_o_lantern), 사막여우 (desert_fox), 캔디보이 (candy_boy), 해바라기 (sunflower), 별똥별소년 (shooting_star_boy), 처형인 (executor), 웨어베어 (werebear), 베이비드래곤 (baby_dragon), 헬하운드 (hellhound), 신기루 (mirage), 라이트엘리멘탈 (light_elemental), 공허의기사 (void_knight), 스핑크스 (sphinx), 물망초 (forget_me_not), 혼돈의마법사 (chaos_mage), 세이렌 (siren), 생크림메이드 (cream_maid), 레드드래곤 (red_dragon), 화염의현자 (flame_sage), 용혈의무녀 (dragon_miko), 애쉬 (ash), 태양의무녀 (sun_priestess), 마왕 (mawang), 폭풍의현자 (storm_sage), 푸딩프린세스 (pudding_princess), 번개의현자 (lightning_sage), 그림자추적자 (shadow_stalker), 골드드래곤 (gold_dragon), 지크 (zeke), 피닉스 (phoenix), 체리프린스 (cherry_prince), 에인션트드래곤 (ancient_dragon), 초신성 (supernova), 사쿠라 (sakura), 신데렐라 (cinderella), 일월검희 (sun_moon_sword_maiden), 여왕 (queen). card/game/data.js:1365
- 황혼의 성가 (twilight_liturgy): 코볼트 (kobold), 미믹 (mimic), 페어리 (fairy), 블레싱테일 (blessing_tail), 홀리밤 (holy_night), 뱀파이어 (vampire), 섀도우캣 (shadow_cat), 눈토끼 (snow_rabbit), 은토끼 (silver_rabbit), 블랙스완 (black_swan), 아우로라 (aurora), 밤토끼 (night_rabbit), 타천사 (fallen_angel), 생크림메이드 (cream_maid), 팅커벨 (tinker_bell), 침묵의사서 (silent_librarian), 라이트엘리멘탈 (light_elemental), 물망초 (forget_me_not), 공허의기사 (void_knight), 스핑크스 (sphinx), 대천사 (archangel), 페어리퀸 (fairy_queen), 고스트킹 (ghost_king), 번개의현자 (lightning_sage), 유니콘 (unicorn), 이클립스퀸 (eclipse_queen), 구미호 (gumiho), 마왕 (mawang), 산타 (santa), 종말의사제 (priest_of_end), 자스민 (jasmine), 은하고래 (galaxy_whale), 신데렐라 (cinderella), 루나 (luna), 둠 (doom_luther), 시간의지배자 (time_ruler), 에인션트소울 (ancient_soul), 혹한의마녀 (frozen_witch), 심해의주인 (deep_lord), 빅토리아 (victoria). card/game/data.js:1379
- 별빛 정원 (starlit_garden): 코볼트 (kobold), 미믹 (mimic), 캔디보이 (candy_boy), 마시멜로 (marshmallow), 슈가파우더 (sugar_powder), 해바라기 (sunflower), 슬라임 (slime), 미이라 (mummy), 조커 (joker), 페어리 (fairy), 아우로라 (aurora), 생크림메이드 (cream_maid), 솜사탕양 (cotton_candy_sheep), 세이렌 (siren), 라이트엘리멘탈 (light_elemental), 물망초 (forget_me_not), 골렘 (golem), 스핑크스 (sphinx), 펜리르 (fenrir), 프리즘트윈 (prism_twin), 유니콘 (unicorn), 푸딩프린세스 (pudding_princess), 폭풍의현자 (storm_sage), 머쉬룸킹 (mushroom_king), 태양의무녀 (sun_priestess), 화염의현자 (flame_sage), 산타 (santa), 점성술사 (astrologer), 페어리퀸 (fairy_queen), 아발란체메이드 (avalanche_maid), 여왕 (queen), 루미 (rumi), 세계수 (world_tree), 자스민 (jasmine), 심해의주인 (deep_lord), 빅토리아 (victoria), 대일여래 (dainichi_nyorai), 일월검희 (sun_moon_sword_maiden), 실피드 (sylphid), 지크 (zeke). card/game/data.js:1393
- 심야의 조류 (midnight_tide): 코볼트 (kobold), 미믹 (mimic), 해바라기 (sunflower), 눈꽃펭귄 (snow_penguin), 섀도우캣 (shadow_cat), 뱀파이어 (vampire), 슬라임 (slime), 눈토끼 (snow_rabbit), 은토끼 (silver_rabbit), 마시멜로 (marshmallow), 아우로라 (aurora), 세이렌 (siren), 펜리르 (fenrir), 침묵의사서 (silent_librarian), 전설의선장 (legendary_captain), 솜사탕양 (cotton_candy_sheep), 프리즘트윈 (prism_twin), 밤토끼 (night_rabbit), 라이트엘리멘탈 (light_elemental), 스핑크스 (sphinx), 종말의사제 (priest_of_end), 레드드래곤 (red_dragon), 산타 (santa), 수정의무희 (crystal_dancer), 젤리피쉬프린세스 (jellyfish_princess), 페어리퀸 (fairy_queen), 아발란체메이드 (avalanche_maid), 푸딩프린세스 (pudding_princess), 태양의무녀 (sun_priestess), 그림자추적자 (shadow_stalker), 시간의지배자 (time_ruler), 팬텀 (phantom), 베놈 (venom), 퍼펙트아우로라 (perfect_aurora), 큐어마스터 (cure_master), 심해의주인 (deep_lord), 혹한의마녀 (frozen_witch), 루미 (rumi), 세계수 (world_tree), 둠 (doom_luther). card/game/data.js:1407
- 투기장의 연맹 (arena_company): 코볼트 (kobold), 미믹 (mimic), 처형인 (executor), 선도부장 (discipline_captain), 웨어베어 (werebear), 섀도우캣 (shadow_cat), 블랙스완 (black_swan), 캔디보이 (candy_boy), 슬라임 (slime), 미이라 (mummy), 베이비드래곤 (baby_dragon), 엠버타이거 (ember_tiger), 프리즘트윈 (prism_twin), 전설의선장 (legendary_captain), 골렘 (golem), 공허의기사 (void_knight), 펜리르 (fenrir), 헬하운드 (hellhound), 생크림메이드 (cream_maid), 물망초 (forget_me_not), 팔라딘 (paladin), 가디언 (guardian), 이클립스퀸 (eclipse_queen), 수정의무희 (crystal_dancer), 레드드래곤 (red_dragon), 화염의현자 (flame_sage), 푸딩프린세스 (pudding_princess), 구미호 (gumiho), 머쉬룸킹 (mushroom_king), 유니콘 (unicorn), 에인션트소울 (ancient_soul), 체리프린스 (cherry_prince), 피닉스 (phoenix), 루나 (luna), 그레이 (gray), 실피드 (sylphid), 골드드래곤 (gold_dragon), 지크 (zeke), 세계수 (world_tree), 레드문 (red_moon). card/game/data.js:1421

Extra pool maximum 15 cards, three presets (card/game/logic.js:447; card/game/card_pool_rules.js:2). Default unlocked IDs: ancient_soul, sun_priestess, cotton_candy_sheep, joker (card/game/logic.js:571). Set selection, bonus unlock conditions, and full transcendence unlock flow: UNVERIFIED. Pending transcendence transfers to an endless run and the queue clears (card/game/rpg_features.js:1703).

## 4. ENEMIES AND STAGES

Unscaled stats ordered hp/atk/matk/def/mdef. Rates are data values; zero-rate skills may be scripted. Complete AI and protocols: UNVERIFIED.

| id | name | element | stats | skills (type,rate,value,effects) | flags | source |
|---|---|---|---|---|---|---|
| artificial_demon_god | 인조 마신 | water | 600/50/50/60/60 | 아이스빔(mag,0.3,1.5; []); 파괴의형태(mag,0,4; []) | {} | card/game/data.js:1772 |
| iris_love | 사랑의 여신 아이리스 | light | 800/40/70/50/80 | 홀리레이(mag,0.3,2; []); 더홀리(mag,0.1,3.5; []); 소울드레인(mag,0,0; [{"type":"mana_burn","val":100}]) | {} | card/game/data.js:1780 |
| iris_curse | 저주의 여신 아이리스 | fire | 1000/90/60/90/60 | 프레임샷(mag,0.3,2; []); 아포칼립스(phy,0,5; []) | {} | card/game/data.js:1789 |
| pharaoh | 고대신 파라오 | nature | 1200/90/90/90/90 | 고대의힘(mag,0.3,2; []); 고대의저주(mag,0,1; []) | {} | card/game/data.js:1797 |
| demon_god | 마신 벨제뷔트 | dark | 1400/110/110/100/100 | 다크니스(mag,0.2,2; []); 제노사이드(phy,0,3.5; []) | {} | card/game/data.js:1805 |
| creator_god | 창조신 아스테아 | light | 1600/120/140/110/110 | 저지먼트(mag,0,3.5; []); 디바인블레이드(phy,0,4; []); 홀리레이(mag,0.2,2; []) | {} | card/game/data.js:1813 |
| flora | 꽃의 여신 플로라 | nature | 700/70/70/70/70 | 제네시스블룸(sup,0,0; [{"type":"buff","id":"damage_half","duration":1},{"type":"clear_self_debuffs"}]); 블러썸템페스트(mag,0.3,2; []) | {"hiddenBossFor":"artificial_demon_god","reward":"trans_flora"} | card/game/data.js:1967 |
| gray | 사신 그레이 | dark | 800/90/90/60/60 | 영혼절단(mag,0,2; [{"type":"random_mult","min":2,"max":4}]); 차원절단(phy,0,2; [{"type":"random_mult","min":2,"max":4}]); 디멘션제로(phy,0,4; []) | {"hiddenBossFor":"iris_love","reward":"trans_gray"} | card/game/data.js:542 |
| thor | 뇌신 토르 | light | 900/100/50/100/50 | 묠니르(mag,0.2,2; []); 썬더러쉬(mag,0,3; [{"type":"swap_self_stats"}]) | {"hiddenBossFor":"iris_curse","reward":"trans_thor"} | card/game/data.js:1984 |
| poseidon | 해신 포세이돈 | water | 1100/100/80/80/100 | 트라이던트(phy,0.2,2; []); 어비스프레셔(mag,0,3; []); 어비스블레싱(sup,0,0; [{"type":"clear_self_debuffs"}]); 디바우러(mag,0,2; [{"type":"remove_random_field_buff"}]) | {"hiddenBossFor":"pharaoh","reward":"trans_poseidon"} | card/game/data.js:1995 |
| ares | 투신 아레스 | fire | 1500/120/120/100/100 | 스피어레인(mag,0.2,2; []); 테라소드(phy,0,4; []); 마그마이럽션(mag,0,4; []) | {"hiddenBossFor":"demon_god","reward":"trans_ares"} | card/game/data.js:2005 |
| flora_valentine | 플로라(발렌타인) | nature | 1400/130/130/120/120 | 제네시스블룸(sup,0,0; [{"type":"buff","id":"damage_half","duration":1},{"type":"clear_self_debuffs"}]); 블러썸템페스트(mag,0.3,2; []) | {"season":"valentine","noBonusRewards":true} | card/game/data.js:2017 |
| thor_swimsuit | 토르(수영복) | light | 1500/80/140/80/140 | 묠니르(mag,0.2,2; []); 썬더러쉬(mag,0,3; [{"type":"swap_self_stats"}]) | {"season":"beach","noBonusRewards":true} | card/game/data.js:2025 |
| ares_halloween | 아레스(할로윈) | fire | 1500/125/125/105/105 | 스피어레인(mag,0.2,2; []); 테라소드(phy,0,4; []); 마그마이럽션(mag,0,4; []) | {"season":"halloween","noBonusRewards":true} | card/game/data.js:2033 |
| astea_christmas | 아스테아(크리스마스) | light | 1600/120/140/110/110 | 저지먼트(mag,0,3.5; []); 디바인블레이드(phy,0,4; []); 홀리레이(mag,0.2,2; []) | {"season":"christmas","noBonusRewards":true} | card/game/data.js:2041 |

Stage n indexes the six-enemy rotation by (n-1)%6, creator_god every sixth (card/game/data.js:1761; card/game/rpg_features.js:754). Base scale 1 + 0.2*floor((n-1)/6), floor each stat. Puzzle adds 0.2; artifact_chaos multiplies by 1.2; challenge/endless artifact, artifact_reserve, flood, curse, perfect_plan multiply by 1.1. Challenge hard adds two steps: puzzle adds 0.2, others multiply by 1+0.1*total steps (card/game/battle_runtime.js:74). Endless after stage 30 replaces first five bosses with their paired hidden boss at 30%; perfect_plan threshold 12. Puzzle uses hidden replacements after stage 6; eligible seasonal boss can replace creator in endless (card/game/rpg_features.js:764). Seasonal probability and hard differences beyond scaling: UNVERIFIED.

Challenge clear stages: default 24; restriction/balance/archive 18; overdrive/artifact 30; puzzle 12; artifact_reserve 24; origin infinite. Endless modes have no clear endpoint (card/game/logic.js:495; card/game/index.html:3237).

## 5. RUN ECONOMY

Starting tickets: default 20; suffering, overdrive, restriction, balance, archive, flood, curse, artifact 10; puzzle, chaos, artifact_chaos 0; draft 5; absent modes use default (card/game/logic.js:427, :1207). One ticket per draw. Default normal odds normal/rare/epic/legend 40/30/20/10%; challenge 25/30/25/20%; restriction 80/20 and 60/40 normal/rare; balance 70/20/10 and 50/30/20 normal/rare/epic (card/game/logic.js:468, :556). Challenge draw deducts before quiz; wrong answer loses ticket with no card (card/game/index.html:3883). Copy limits: UNVERIFIED.

Win gives 1 by default, 0 in suffering/chaos/artifact_chaos/puzzle, plus 1 if any participant has looter trait, +1 overdrive, +3 eligible hidden boss (card/game/logic.js:512; card/game/rpg_features.js:2122). Quiz and sage +1, creator quiz +3 (card/game/logic.js:520). On win or ordinary loss dead participants lose one inventory copy and deck slot; puzzle removes all participants even if alive (card/game/rpg_features.js:2104). Chaos, artifact_chaos and draft defeat remove the run save and return to title; dream_corridor ends the run; other modes return to lobby after result (card/game/rpg_features.js:2341). Origin defeat clears pending transcendence. Full list of global persistence: UNVERIFIED.

## 6. BLESSINGS AND CHAOS

Manual altar activation: normal uniformly picks 3 distinct cards from a shuffled eligible pool; successful challenge quiz picks 5; suffering adds 2, overdrive adds 1. Eligible pool excludes transcendence and event and observes mode grade ceiling. Individual chance is min(picks,pool size)/pool size. Each use replaces chaos blessing and clears sage blessing. All stats +40/30/20/10% by normal/rare/epic/legend, with crit/evasion increase; exact crit/evasion formula UNVERIFIED. Three chaos uses per battle segment; activation or failed challenge consumes one; victory resets uses and blessings (card/game/index.html:3638; card/game/rpg_features.js:1895, :2171).

Great sage asks random grammar question with optional lecture; success picks 12 distinct eligible cards with the same grade stat multipliers and +1 ticket except puzzle; failure consumes a use. Starts at 3 uses; success replaces sage and clears chaos (card/game/index.html:3645, :3690; card/game/rpg_features.js:1856). Other rewards can add uses (card/game/index.html:4803, :5997). Chaos roulette spends global chaos tickets (card/game/index.html:3549); weekly reward constant 3 (card/game/logic.js:527). Roulette outcomes, earning conditions and full queue lifecycle: UNVERIFIED.

## 7. ARTIFACTS IN PLAY

Artifact awards on creator-god wins up to four (card/game/index.html:3250). Reserve: four rounds of two groups of three; select one per round for 12 artifacts, each with two uses; activate up to four before battle, consumed and cleared after battle (card/game/rpg_features.js:1443, :1460, :1483, :1509). Artifact chaos assigns four random active artifacts, resets on chaos shuffle (card/game/rpg_features.js:1430; card/game/index.html:3247).

Artifact definitions and effects:
- 대자연의 축복 (nature_blessing): 대지의축복 효과 2배 (card/game/logic.js:576).
- 리버스 (reverse): 자연속성 카드 사망시 필드버프 대지의축복 부여 (card/game/logic.js:577).
- 밀크쉐이크 (milkshake): 스타파우더 효과 2배 (card/game/logic.js:578).
- 버프오버로드 (buff_overload): 필드버프 상한 5개로 변경 (card/game/logic.js:579).
- 섀도우볼 (shadow_ball): 암흑 효과가 마법방어도 감소하도록 변경 (card/game/logic.js:580).
- 어쌔신네일 (assassin_nail): 암흑/부식 효과 2배 적용 (card/game/logic.js:581).
- 베일오브다크니스 (veil_of_darkness): 어둠속성 카드 치명타와 회피율 10% 증가 (card/game/logic.js:582).
- 래빗홀 (rabbit_hole): 눈토끼, 밤토끼, 은토끼의 치명타와 회피율 20% 증가 (card/game/logic.js:583).
- 럭키비키 (lucky_vicky): 치명타 혹은 회피 발생시 마나 10 회복 (card/game/logic.js:584).
- 오버플레임 (over_flame): 작열 최대 스택 5, 부여시 2스택씩 부여 (card/game/logic.js:585).
- 오버디바인 (over_divine): 디바인 최대 스택 5, 부여시 2스택씩 부여 (card/game/logic.js:586).
- 홀리플레임버스트 (holy_flame_burst): 작열/디바인 전소모 스킬의 추가위력 2배 (card/game/logic.js:587).
- 플레임피어싱 (flame_piercing): 작열 스택당 적의 방어력 10% 추가 관통 (card/game/logic.js:588).
- 디바인피어싱 (divine_piercing): 디바인 스택당 적의 마법방어력 10% 추가 관통 (card/game/logic.js:589).
- 질풍노도 (gale_storm): 전투 개시 후 3턴간 필드버프 질풍 부여 (치명타율/회피율 20% 증가) (card/game/logic.js:590).
- 프로즌바디 (frozen_body): 물속성 카드 사망시 적에게 스턴 부여 (card/game/logic.js:591).
- 아이스브레이크 (ice_break): 스턴 중인 적에게 대미지 2배 (card/game/logic.js:592).
- 서포트부스트 (support_boost): 모든 보조스킬 마나 소비 0 (card/game/logic.js:593).
- 더블어택 (double_attack): 일반공격 위력 2.0배 (card/game/logic.js:594).
- 데스룰렛 (death_roulette): 모든 스킬 대미지 2배, 스킬 사용시 30% 확률로 사망 (card/game/logic.js:595).
- 섀도우스탭 (shadow_stab): 회피율 20%증가, 방어력과 마법방어력 30% 감소 (card/game/logic.js:596).
- 드래곤하트 (dragon_heart): 드래곤의 마법 공격력 100% 증가 (card/game/logic.js:597).
- 빅뱅 (big_bang): 전설/초월 카드 사망시 물리 3배율 자폭대미지 (card/game/logic.js:598).
- 길동무 (companion): 사망시 적에게 대미지를 주는 특성이나 아티팩트 대미지 2배 (card/game/logic.js:599).
- 만화경 (kaleidoscope): 매 턴 개시시 모든 필드버프를 변경한다 (card/game/logic.js:600).
- 블루문 (blue_moon): 스킬 사용시 30%확률로 마나를 소비하지 않는다 (card/game/logic.js:601).

Individual cluster mapping and divine upgrades: UNVERIFIED (card/game/logic.js:604).

## 8. FIRST-SESSION PATH

Title offers new journey after loading; game-type and mode selection then run initialization; lobby offers draw, formation and battle entry; battle offers action controls (card/src/shell.html:29, :49, :80; card/game/index.html:3237; card/game/rpg_features.js:1535). One nonempty deck slot suffices in ordinary modes; puzzle requires three (card/game/battle_runtime.js:310). Exact screen and tap count, required modal dismissals and first-action sequence: UNVERIFIED. Decisions include game type/mode, draw, assigning a card to a slot and battle action.

Confirmed entries: title: continue, new journey, fortune cookie, question, mission board, music; header: home, music, settings, fullscreen; lobby: normal/challenge draw, mode-dependent draft or chaos shuffle/artifact check, party slots, battle, study, mission, blessing; bottom nav: lobby, formation, collection, study, settings; study: TOEIC, grammar, wordbook, tutoring, question; settings: game menu, export/import, theme, portrait path/folder; battle: player/enemy details, field buffs, artifacts and actions (card/src/shell.html:19, :29, :49, :80, :92). Nested menu and modal entry points: UNVERIFIED for completeness.

## 9. BATTLE PRESENTATION

Shell displays turn, field buffs, active player and enemy portraits, HP bars, player MP, status icons, battle log and controls; actors and field open details (card/src/shell.html:84). Animation, floating damage, audio function inventory and comparison to typical JRPG: UNVERIFIED.

## 10. STUDY COUPLING

Challenge draw gates improved odds on a quiz; sage and challenge blessing use quizzes; archive asks grammar after each stage with 80% threshold; puzzle obtains 36 cards through initial quiz and consumes used cards; dream_corridor has three lives and TOEIC wrong-answer threshold two (card/game/index.html:3883, :3638, :3242; card/game/logic.js:485). Quiz rewards are in section 5. Tutoring event has a global toggle (card/game/rpg_features.js:1832). Mission conditions, complete study rewards and switch-off boundary: UNVERIFIED. Battle state machine is separate in card/game/battle_runtime.js:1, but full decoupling is not established.

## 11. DEFENSE ONBOARDING

Tutorial order lobby -> prepare -> summon -> merge -> cast -> auto -> firstTen -> formation (defense/src/beginner.js:6). Stage 1 guides summon, drag equal units to merge, use skill, turn auto on; first win leads to free ten summon and formation save (defense/src/app.js:1605, :1648).

Sprout week advances by login days; missed days do not reset and unlocked claims remain (defense/src/app.js:1680; defense/src/beginner.js:20). Day: login reward; task -> reward (defense/src/beginner.js:11).

1. 500 dreams; clear stage 1 -> 100 dreams.
2. 2000 dreams; greet partner -> 100 dreams.
3. 1000 dust; water greenhouse -> 100 dreams.
4. 300 dreams and 2 bouquets; gift companion -> 100 dreams.
5. 800 dreams; summon relic once -> 100 dreams.
6. 1500 dust; clear stage 18 -> 200 dreams.
7. Choose one UR; clear stage 21 -> 200 dreams.

Tasks become claimable when day unlocked and condition met; choice uses currently open UR pool (defense/src/beginner.js:20; defense/src/app.js:1717).

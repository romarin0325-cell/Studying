# 메모리얼 원문·이미지 매핑 및 인코딩 기록

사용자가 제공한 pasted-text-1.txt의 전체 이야기와 images 폴더의 PNG 32장을 확인했다. 현재 HEROES 30명에 이야기 한 편과 AVIF·직접 원본 WebP 한 장씩을 연결한다. 원본 PNG와 첨부 원문은 Git에 복사하지 않는다. 이 문서는 미디어·원문 데이터 검증을 기록하며, 호감도 잠금·한 장씩 디코딩·화면 복귀의 런타임 검증은 메모리얼 UI 검사에서 별도로 수행한다.

## 원문 보존과 선택 근거

- 메모리얼 제목은 첨부 이야기 제목을 그대로 사용한다. 파일명의 설명형 제목으로 바꾸지 않는다.
- 원문의 대사·문장·문장부호·각 줄 경계를 paragraphs에 그대로 보존한다. CRLF 줄 끝만 LF로 정규화한다. 각 원문 줄을 하나의 항목으로 보관하며, 문장을 합치거나 내용을 새로 쓰지 않는다.
- 시나리오 번호, 캐릭터 외모·보이스 설정 헤더, 이야기 외의 구현 지시는 독서 화면 데이터에 넣지 않는다.
- unlockBond는 기존 호감도 bond의 기준 10이다. 새로운 호감도 획득 방법이나 별도 affection 필드를 추가하지 않는다.
- 아발란체메이드는 현재 메이드의 heroId avalanche_maid에, 퍼펙트아우로라는 현재 아우로라의 heroId aurora에 연결한다. 둘은 별도 신규 캐릭터로 만들지 않는다.
- 번개의현자 16A는 처음 연결한 장면이다. 현재 원고와 그림은 `번개의현자수정.png`와 이야기 「가장 자주 펼치는 책」으로 교체했다. 16B는 쓰지 않는다.
- 신데렐라 24B 구두 미세수정은 같은 유리구두 장면의 제공된 수정본이다. 벗은 한쪽 발과 남은 유리구두를 확인했으며, 구두의 불편함을 다루는 원문과 대응하여 24A 대신 선택했다.
- 첨부의 에인션트소울 이야기는 현재 30명 명단에 없는 캐릭터이므로 추가하지 않는다. 누락된 이야기를 창작한 항목은 없다.
- 32장의 원본을 4개 contact sheet로 실물 관찰했다. 선택한 30장의 인물·장면과 두 중복 후보를 확인했다. 인물, 의상, 구도, 성별 표현, 문구에 의미적 이미지 편집을 수행하지 않았다.

첨부 원문 SHA-256: `0676e37dc2b2477d55012b300fcb7a6e81b4225fc44727b572066bb8bc73f193`. 아래 줄 번호는 원문 내 출처 검증용이며 게임 화면에는 표시하지 않는다.

## 실제 용량과 색·알파 검사

| 항목 | 실제 결과 |
|---|---|
| 선택/출력 개수 | 30 / 30 |
| 원본 해상도 | 전부 1024×1536 |
| 출력 해상도 | 전부 720×1080 |
| 원본 알파 / 불투명 | 전부 hasAlpha=false / isOpaque=true |
| 출력 알파 | 전부 hasAlpha=false |
| 설정 | AVIF quality 52, effort 4, 4:4:4 |
| 원본 30장 합계, 저장소 밖 | 55271915 bytes · 52.711 MiB |
| AVIF 바이너리 합계 | 1239023 bytes · 1.182 MiB |
| 최대 / 평균 | 54.33 KiB / 40.33 KiB |
| Base64 문자열 합계 | 1652076 bytes · 1.576 MiB |
| data URI 접두어와 heroId JSON을 포함한 객체 | 1653229 bytes · 1.577 MiB |
| 개별 <100 KiB, 전체 <2.5 MiB, 내장 객체 <3 MiB | 모두 통과 |

원본에는 알파 채널이 없었다. 재인코딩 절차의 removeAlpha 조건은 stats.isOpaque일 때만 실행하므로 실제 투명 원본이 추가되더라도 투명도를 무조건 제거하지 않는다. 720×1080 한 장의 단순 RGBA 픽셀 예산은 3,110,400 bytes, 약 2.97 MiB다. 브라우저 디코더·GPU의 부가 메모리는 이 값에 포함되지 않는다.

Sharp의 AVIF metadata는 chromaSubsampling 값을 제공하지 않으므로, 각 출력의 av1C 구성 레코드에서 monochrome=false, chroma_subsampling_x=0, chroma_subsampling_y=0을 직접 확인했다. 이는 [AOMedia의 AV1 구성 레코드 정의](https://aomediacodec.github.io/av1-isobmff/#av1codecconfigurationbox-syntax)에 따른 필드 검사이며, 30개 출력 모두 4:4:4였다. 설정값만 기록한 것이 아니라 인코딩된 파일의 필드를 검사했다.

30개 AVIF를 실제 디코딩한 뒤 4개 contact sheet로 재관찰했다. 추가로 지크와 신데렐라는 720×1080 전체 해상도에서 붉은 머리·검은 갑옷 경계, 밝은 머리카락의 가는 선, 유리구두와 의상 윤곽을 확인했다. 원본에서 선택한 장면과 구도를 유지하며, 의미적 재작화나 크롭은 수행하지 않았다. contact sheet와 PNG 검토용 디코딩본은 저장소 밖의 임시 검토 폴더에만 둔다.

독립 검증에서 현재 30명의 ID 집합과 이야기·경로·manifest·출력 파일의 ID 집합이 모두 일치했다. 원문 242개 줄 항목을 첨부 원문의 해당 줄과 직접 비교하고 본문 SHA-256을 재계산했다. 30장 모두 전체 픽셀 디코딩에 성공했고, 입력·출력 해시·720×1080·AV1·RGB 3채널·불필요한 알파 부재·4:4:4·개별/전체 용량 검사를 통과했다. 같은 지크 원본을 같은 설정으로 재인코딩해 출력 SHA-256이 동일함을 확인했다. 기존 ASSET_PATHS에 /memorial/ 항목이 없는 것도 확인했다.

## 30명 원문·파일 대조

| heroId / 현재 이름 | 원문 제목 | 원문 본문 줄 | 입력 PNG | 출력 AVIF bytes |
|---|---|---|---|---|
| star_boy / 별똥별소년 | 한 번 더 돌아온 배달 | 642–654 | 18B_별똥별소년_쉬어 가고 싶은 핑계.png | 41460 |
| snow_rabbit / 눈토끼 | 차가 식기 전에 | 486–496 | 06A_눈토끼_멈춰 버린 허브티.png | 30513 |
| silver_rabbit / 은토끼 | 쉿, 우리 둘만의 기도 | 816–816 | 29A_은토끼_예배 전의 조용한 신호.png | 28768 |
| night_rabbit / 밤토끼 | 달을 빌리는 시간 | 608–616 | 15A_밤토끼_달빛 아래의 빈자리.png | 35333 |
| siren / 세이렌 | 노래보다 먼저 묻는 것 | 680–691 | 21A_세이렌_노래를 오해받은 날.png | 33631 |
| mushroom_king / 머쉬룸킹 | 소리를 접는 시간 | 577–585 | 13B_머쉬룸킹_땅에 내려온 은하.png | 46868 |
| great_detective / 명탐정 | 찾고도 말하지 않는 것 | 595–601 | 14A_명탐정_닫힌 서랍의 정답.png | 42578 |
| guardian / 가디언 | 발밑으로 지나가는 길 | 464–476 | 01B_가디언_이사가 끝날 때까지.png | 41283 |
| avalanche_maid / 메이드 | 얼음 위의 퇴근 | 750–759 | 25A_아발란체메이드_긴 실루엣의 은반 퇴근.png | 35417 |
| santa / 산타 | 자기보다 큰 선물 자루 | 663–671 | 20B_산타_맨 아래에 숨겨 둔 선물.png | 48559 |
| red_dragon / 레드드래곤 | 둥지의 냄새 | 522–530 | 08A_레드드래곤_골짜기의 맛있는 냄새.png | 46661 |
| aurora / 아우로라 | 맨발의 착지 | 961–961 | 46B_퍼펙트아우로라_맨발의 착지.png | 45903 |
| storm_sage / 폭풍의현자 | 돌지 않는 풍향계 | 898–905 | 41A_폭풍의현자_바람 없는 낮잠.png | 40804 |
| flame_sage / 화염의현자 | 읽을 수 있는 이름 | 932–939 | 44A_화염의현자_읽을 수 있는 이름.png | 41668 |
| lightning_sage / 번개의현자 | 가장 자주 펼치는 책 | 교체 원고 | 번개의현자수정.png | 38682 |
| time_magician / 시간의마술사 | 초침을 빌려 주는 일 | 701–708 | 22B_시간의마술사_다시 움직이는 새벽.png | 43432 |
| ancient_dragon / 에인션트드래곤 | 지도에 아직 남은 호수 | 768–774 | 26A_에인션트드래곤_바위 아래 다시 흐르는 샘.png | 39973 |
| phantom / 팬텀 | 다섯 번째 문은 열지 않는다 | 880–889 | 40A_팬텀_다섯 번째 문 앞의 허세.png | 25605 |
| zeke / 지크 | 돌아오는 편지 | 849–855 | 35B_지크_돌아올 왕국을 지키는 약속.png | 44866 |
| luna / 루나 | 한 사람분의 발소리 | 539–548 | 10B_루나_부채 뒤의 고백.png | 40024 |
| jasmine / 자스민 | 흠 없는 초상 | 833–840 | 32B_자스민_머리끈으로 완성한 초상.png | 34799 |
| queen / 여왕 | 국경에서 온 돌 | 800–809 | 28B_여왕_옥좌에 남겨 둔 증거.png | 42846 |
| rumi / 루미 | 별 하나가 틀린 밤 | 557–567 | 11B_루미_대현자가 그리는 밤.png | 36347 |
| cherry_prince / 체리프린스 | 먼저 온 손님 | 864–871 | 37B_체리프린스_왕자의 짐을 내려놓다.png | 42814 |
| time_ruler / 시간의지배자 | 돌려드릴 수 없는 신청서 | 717–725 | 23B_시간의지배자_홍차를 위한 일초.png | 41522 |
| galaxy_whale / 은하고래 | 손바닥 위의 일등성 | 825–825 | 30A_은하고래_밤하늘을 건드리다.png | 51223 |
| doom / 둠 | 빼앗지 않은 초대장 | 506–513 | 07A_둠_거두어들인 손.png | 47475 |
| cinderella / 신데렐라 | 유리구두의 고충 | 735–741 | 24B_신데렐라_구두_미세수정.png | 46472 |
| harmonious / 하모니어스 | 오늘 만든 이름 | 914–922 | 42B_하모니어스_우정이라는 새 이름.png | 49488 |
| frost_witch / 혹한의마녀 | 얼음 옥좌의 온도 | 949–949 | 45B_혹한의마녀_온기를 놓지 않는 여왕.png | 55639 |

## 콘텐츠 해시

| heroId | 입력 SHA-256 | 출력 SHA-256 | 원문 본문 SHA-256 |
|---|---|---|---|
| star_boy | 215c78af955b7378bd61f4524f4396c56e189dc488c1ed0f2365f8c91568e8a1 | 1800a06fdd3da1c5ae7ad8576d51f27ff28f575472adf43eb1d66c9ed8be68f5 | edd800a813f85ee4dfd594f0121a92ff3712952287bbe84846ed062f89a97329 |
| snow_rabbit | 30aad3b317c52b25de38877d33256ee039f2644b7b8dee0e2305bfa2f78b8eb2 | cb7be0c00c14018897539c586e7d3e80ea2b1a17051d4979d17aa3dfe536f24e | 902c582f9476fbee117faa19f6e352faf8f1ba47182d97c696265b9be17e79b0 |
| silver_rabbit | bbdf5872b3b73495f87e208b454ae9ec3f671e48edbc3095e26d9a596de9f342 | 311d1b32df01496ca947accd0349c603278b2df129c9a65a48a1f9644bf7cfcf | 49b2026c6cd88ca5d588b59f04de44dc2c52b57128d12d8dca4559e7edbcbbd1 |
| night_rabbit | 40f70d1cb9ab69b6384d15175846399b796e7af584e08d55923a8708b93d5ecc | 9f3850ffaee53557ed4fe0c2f6122eb87f5d34d0b186da8464ea271becd9a403 | d132e8b67a72747d00881a0aa0547cfb292bd60dde1c2ca6425d4b97589225c7 |
| siren | 531d4cfa807887ade7a560a1f738fbab86e95ebdda5dbcbd231d946b53faba7a | 7fa8310f9dad7e5af3a9e87767be1bd2bf7d63fbcfdabf8faf158b924ce5867b | 8765c204341923685eb8d978ebbfab8ce90d1b097e9a1753cf5851a1b5af0c3e |
| mushroom_king | 472a82f550dbaacdc90eb7ee40ebcfadd8b8eb5235fb3d5c8b803b31b2785a96 | 73ea358e33e64d5ec0ecd9192e73464874c41a5041610a6cc932bbe38b7bca87 | a82d7a67d8d71058cd7db757bf344a0193da82ce8a3da45ea6ef6b7d8ec86ffb |
| great_detective | a7d71c968d9d5dfe1ecac2088cd39a24fba13759e9b6007b3a8a1e6e105d5dc9 | 05f879a26fae3fed9c20be4e9af8a881913e21f41c875e56ce2ff943b3e45118 | 0651bfe0008279a5ac4306e6ae26b8ed6d29a9db7fc0f73e3b586103ceafa59e |
| guardian | 287416cdae8a9cd848ba9389d50c0f2dea1788b56d0d8f7974a77a3defda1667 | 4befe6503713210f33f09abdd8fdb5efccb98dbee37d991116cb51dbb6672897 | e130a2f9bf47e4d6ffe8862216ebd9a44ec0e0cedc7b33b3ccd2bd1a34b0f1a7 |
| avalanche_maid | fce05681606823da67f8193e6cfe62912f73cec88ea0e4c3e664dccc4c952c3d | c35949d91c9f79a838afdeb1602ebb0839d6b69a786264c410437856f687ee0f | 111fbe94722ea0872ed20c26192f10a48d629ac98a758fdc3126901904954267 |
| santa | 5014c9169f0854c712c6e95e609c48e82b0335abe5153f85747f2b7f99444820 | 9a069964ba7f75e732a1031f06c10b69e49f9c92dd3aade368038ff4e5ecfa25 | c724bac5971b0d64fc720ea7493943936563a0354680f592f4446ecd6137cbe5 |
| red_dragon | 308bbdbc8371d4c2fd430d2a67ab284929be9e727d0d1823468d65ef2eab8631 | 38403a482ba4986349a4f4a7b7a001f4bb94bda08f4dc945732114b3bee2659e | b81d9d687ad9601c4b9294d4be20a58d1ec25d6dec4484ced46ca20f36a2fdaa |
| aurora | 971b79f4b540399cd5891c560ea19c15251755671072ae22aadb080b1999b9c4 | 99116c6ee542692f615a74ccae0c54a7d67f8f94b9c9d57cbefb61f920168445 | 3ab573c18361d3418e977a952a97eb9c9053064d32963858e6092a29bfadaa1b |
| storm_sage | cfb5b45b3fa7ff4189fbe175773ce1d847c500c6dcc69fc5fb5cfbe729d485ab | f60dffacb1e12b4234c48088d306e346896e1f3500abdf421a0ba19b92a8d004 | f730a9b90719d41f30181796d076683e5e41ee345a86f5b1a801d44939fa4d86 |
| flame_sage | 5d533310879e454c1c8aecf28d648ac291948c707b047ed7577e84266aaf9728 | e0f19769aea4e501dc20a307ce183af4a16a78cfa80b8949604726ad2e2a8266 | 021fa43336c0424c52f15b432883f3ce99dc318e7c608a50e395bfd71d5754a0 |
| lightning_sage | 6a87f0e8c4884bd5105cc3f461d847aed162cd3052df6267b37f5b994955f6a1 | 336914bb73634f7371dc4ade3f2cd81fa6dd4201a446cf8c47b108b6aafcb63e | 3f3e305f3c0ca3e373edaf45e65628815e0f7a57ca3ce6bb59e2508335c58794 |
| time_magician | fb0a15a674c30d2ba40692634e2883fc7ac4c99b65b3832ad9e3343e96808c3e | dd1221c02f1ddca41891609f7662ac5062b88b16c6cfc0c4cd6ab241bcbf265c | 40d19ed7e595a4a7497b571535c6864c90de7868e1b24b3b5ea2e56cdf98511d |
| ancient_dragon | 868589fb42ba63bdf95de3e442194ab1c23d66e9a01e6f5de5fcbec6c4a7a154 | aa83e8a8902ee1617b35830c17b6d102f53acd6a384279ad18893db1ad688688 | 57c0b21d45ac04453217db8b821ccc63ce19af5727dbfe2df93bfdc3d790324c |
| phantom | dc22decf55171087470a15963cf7a2896c86e1c6cf8b1043fd7f578aa0882eee | 407991a42dd8c71737d6a314f7c7fd81d949c2972bad67bd31ef2de79973d672 | 9e3623e8b25f27bd457dcd15c4b730d1c49ba7412e462af24b5198bb97485c42 |
| zeke | 09f3dea4cf4ae7aae4b29676984540008da085a3d3d792fe458ee9849b43a3e8 | 49d42a711712ce66ca4227d9e12464c30b7fd310a7a77c112355b094317cf9ca | 110f62d229afa3a9896c052d2746bef32e632082c2a85ac8c42ccd498adf4248 |
| luna | e0e6ddde7f62aedd4b13c443e6f553b10b7f8f81b517d6c5c5373f5bae667331 | 1bb311e12b3ee48e41221ddde8444205e0a3d056ec9164b7e89224efe4f09946 | 871cc130625a8bc269cab15148692c08ae1292de2e909a892dc145aafefa0287 |
| jasmine | 816db584a8f225ae21e9ade7b6cb66179df2088dbd5df0ee3333fa967d389cd1 | c16dafd982a15063c12851786c7ff66195a21353ef560acade7158ae478f1000 | 2eea4874b170358141c1371c4703cd0fb7f84217b6a0fe2ee5877289f67e0163 |
| queen | 3a441d6e25adbea2ceed7ea817878c80bf0280804842f81d718440637430ea1e | 65a95d0043bccbd14ea5d17cac4932a47b8a1ac59f62bab444c6aac58f629a73 | a566826cbb1e3e634cd270ec1fc4d93b8cb4d8383c9e035f6c73d65f96ae2ed3 |
| rumi | b6f052645b5d8dd302abc0a46bd668b34d1f96a496015b42be92a97d9fa39001 | f9f57c92b204ba4319642c945981317b6645b1c2066b0d83cbaf82232dd3b58a | 70e103e71fc49c1b77ad84745f8015e45bdcbc09c2b264e448e10f98999aad7c |
| cherry_prince | d545d56a1998e228d3721e93bb3abb194eb9dff8b45a5488ba81c097295c1ef3 | b7a96447d4f60365c452e2f0eafa585d60d06c85f00e5dee8149dc09766157aa | 3afb5035f9c2d526120bdb58bb71887c79c24748073bdbdc63c68daaf6ba6f4d |
| time_ruler | c8356cbd5d0c1871f90d9429a8d8916a08a8df2a1290999d816fe9d90660e734 | e07725d08765d6267143901ac94953e22d562824b04a76bfd3fa6e64a2ff9de6 | ec049bd03f97838f51b714af61f66a41502d72317c9220dc54e475e1953fa6bd |
| galaxy_whale | d55a5147287a97d182091f683d55ee97c9a349030879950cf78166988e613ca8 | c03acecbb8421b6de612be0e95a48a59101b3967a464f0c4ae89a77c2279d9d1 | b99d31884afc2f2559bcf6bba0c52514c1e57683d589c3dec644650cde3880de |
| doom | b314320f6fdcf0f850838e542408181c22c10534401e6b7da19531578f30759e | eaa2c2c0cd8bf0e0614d661299f6d5edec43c05526431f3d91bdda7037155e55 | 9d07476dea9e49ea93867ff1a2a781e54b985be2003a6f1655ec41e590590b36 |
| cinderella | 43b8814323f762ed80454a6ae3967a34ce11b23c6bd6bbf40d123253512470c5 | a75efd967ed5cf4da0fc1f875bdfac280e26ebf00102350bbb3db7855e3d7649 | 222e6f77124d95b4a204c01eb1328ececa9a4b0b902eee2cdece156d80fc05a6 |
| harmonious | d6afd7300137281012382a60a59998372d57e16d1929e2709a6800f76d804c81 | 034355d2f6b300eb9b6a381a1a147a766a7e278eec784144be63ddaf99087570 | 1f2c0abd41972a394151cbc5e5be8cccb655d57649bbdefc9589439b6ed729e5 |
| frost_witch | 2f1232f7525d1883b6067159a768e6b87cbfce0c03bc297a5fb7a0bf04866d7f | 81beb61c359894092ad2731e2919886c240c5573537c0612287c50430a681f8b | d81312a8c528fd5ade39b8cf5b4bd6d03dc568ee84141eab6244c0e4e2a220db |

source filename, 해상도, alpha, 원본/출력 SHA-256, bytes, Base64 bytes, 원문 줄 범위와 본문 SHA-256은 src/memorial-media.js의 MEMORIAL_MEDIA_MANIFEST에 한 번만 기록한다. src/memorial.js는 이야기를 보관하고 기존 AVIF 경로·manifest 인터페이스를 re-export한다. MEMORIAL_MEDIA_PATHS와 MEMORIAL_WEBP_PATHS는 canonical manifest에서 파생하며 별도 원본 선택표를 만들지 않는다. 본문 해시는 paragraphs.join("\n")의 UTF-8 바이트를 대상으로 계산한다.

## 원본 선택과 수동 준비 도구

제공된 images 폴더의 PNG는 32장이고, canonical catalog가 현재 동료 30명에 정확히 30장을 선택한다. 추가 후보 두 장이 존재하는 것은 오류가 아니다. 선택하지 않는 파일은 다음 두 개다.

- 16B_번개의현자_오차를 고친 새벽.png: 선택은 이야기와 바닥의 세 줄이 대응하는 16A다.
- 24A_신데렐라_보도 틈새의 유리구두.png: 선택은 제공된 구두 수정본 24B다.

원본 폴더를 저장소 밖에 보관하고 MEMORIAL_SOURCE_DIR 환경 변수로 수동 도구에 전달한다. 정상 빌드는 이 변수나 원본 PNG를 요구하지 않으며 준비 도구를 실행하지 않는다. Sharp 0.35.4, libvips 8.18.6, WebP 1.6.0, AOM 3.14.1, libheif 1.23.2로 현재 파일을 만들고 재현했다.

```powershell
$env:MEMORIAL_SOURCE_DIR = 'C:\Users\romar\Downloads\캐릭터_시나리오_62종_20261005\캐릭터_시나리오_62종_20261005\images'
node defense_test/scripts/prepare-memorial-media.mjs
# 추가로 기존 AVIF 30개의 원본 재현 결과가 같은 바이트인지 확인
node defense_test/scripts/prepare-memorial-media.mjs --check-avif
# 특정 AVIF만 재현할 때
node defense_test/scripts/prepare-memorial-media.mjs --check-avif=zeke
# 원본이나 설정 변경을 검토할 때: 배포 assets를 덮어쓰지 않음
node defense_test/scripts/prepare-memorial-media.mjs --candidate
```

기본 모드는 선택 원본 30개의 파일명·SHA-256·bytes·해상도·알파를 현재 catalog와 대조한다. 기존 AVIF는 해시가 일치하면 그대로 유지하며, 누락됐을 때만 원본 재현 결과가 기존 SHA-256과 같은지 확인한 후 복구한다. --check-avif는 다시 인코딩한 결과의 바이트 동일성을 검사하지만 기존 파일을 덮어쓰지 않는다. WebP는 항상 선택한 PNG에서 직접 생성하고 현재 catalog에 기록된 품질·bytes·SHA-256과 대조한다. 승인된 출력과 달라지면 실패한다.

--candidate는 동일한 30개 파일명 선택을 유지하되 바뀐 원본 해시와 실제 새 AVIF·WebP 결과를 기록한다. 두 형식 모두 test-results/.media-review/candidate-assets 안에만 생성하며, 실제 source/output 해시·해상도·알파·품질·용량을 담은 candidate-catalog.json을 같은 검토 폴더에 남긴다. 배포 assets나 canonical catalog를 자동 변경하지 않는다. 검토 자료는 Git에서 제외한다.

두 형식은 아래 공통 파이프라인을 사용한다. EXIF 방향을 적용한 후 전체 구도가 2:3인지, 최소 720×1080 해상도인지 확인한다. fit:inside는 올바른 2:3 입력 전체를 보존하며 확대하지 않는다. 원본의 인물·의상·내용·구도를 바꾸는 편집이나 크롭은 없다.

```js
const stats = await sharp(input, {failOn:'error'}).stats();
const pipeline = () => {
  let image = sharp(input, {failOn:'error'}).rotate().toColourspace('srgb').resize({
    width:720, height:1080, fit:'inside', withoutEnlargement:true, kernel:'lanczos3',
  });
  if (stats.isOpaque) image = image.removeAlpha();
  return image;
};
const avif = await pipeline().avif({quality:52, effort:4, chromaSubsampling:'4:4:4'}).toBuffer();
const webp = await pipeline().webp({quality:82, effort:6, smartSubsample:true}).toBuffer();
```

WebP의 수동 준비 목표는 개별 96 KiB다. 82에서 시작해 2씩 낮추며, 74에서도 목표를 넘으면 실패해 용량·화질을 다시 검토하도록 한다. 목표를 맞추기 위해 품질을 무제한 낮추지 않는다. 현재 선택은 28장 q82, 은하고래 q80, 혹한의마녀 q78이다. 이 목표와 하한은 수동 생성 절차이며 CI에 새 품질·시각 검증 게이트를 추가하지 않는다. 기존 개별 100 KiB·형식별 전체 2.5 MiB·단일 내장 객체 3 MiB 기준을 유지한다.

입력은 단일 프레임 PNG이며 failOn:error로 읽는다. 단발 부정 입력 검증에서 유효한 APNG를 Chromium ImageDecoder가 2프레임으로 디코딩했지만 같은 파일의 Sharp metadata.pages는 없었다. 따라서 PNG의 acTL num_frames 및 fcTL 개수도 검사해 여러 프레임을 첫 장으로 조용히 평탄화하지 않는다. acTL 필드는 [W3C PNG 제3판의 애니메이션 제어 정의](https://www.w3.org/TR/png-3/#acTL-chunk)를 따른다. 출력 알파는 원본 hasAlpha와 isOpaque에 따라 검사한다.

## 빌드와 런타임 연결 계약

- 일반·1인 단일 HTML은 AVIF만, 호환 HTML은 직접 원본 WebP만 window.__MEMORIAL_MEDIA__에 별도 내장한다. 웹 폴더 버전은 외부 AVIF와 직접 원본 WebP fallback 파일을 복사하고 경로만 연결한다. 한 단일 HTML에 두 형식을 중복 내장하지 않으며 빌드는 메모리얼을 다시 인코딩하지 않는다.
- 기존 ASSET_PATHS, window.__ASTRA_ASSETS__, Art.load의 전투용 선로딩 목록에는 메모리얼을 합치지 않는다.
- 초기 화면 및 잠금 목록은 기존 동료 초상화를 사용한다. 독서 화면을 열 때 현재 이미지 한 장에만 src를 지정한다.
- bond<10은 잠금이며 bond>=10에서 원문과 그림을 열 수 있다. 소유 조건과 잠금 표현은 UI 계약에서 검증한다.
- 독서 화면을 닫거나 다른 화면으로 이동하면 큰 이미지 DOM과 참조를 제거한다. Base64를 localStorage에 쓰지 않는다.
- 미디어 데이터만으로 30명 coverage, source/output 해시, 본문 해시, 최대 해상도, 불필요한 alpha 부재, 개별/전체 bytes budget을 자동 검증할 수 있다.
- 최종 npm run verify, 단일 HTML의 별도 __MEMORIAL_MEDIA__ 내장과 Chromium/WebKit 실제 디코딩·잠금·복귀 검사는 통합 담당이 수행한다. 이 미디어 작업에서는 게임 빌드나 커밋을 실행하지 않았다.

## 직접 원본 WebP 측정과 채택 이유

기존 웹 fallback의 실제 AVIF→WebP 파일과 같은 선택 PNG에서 직접 만든 WebP를 비교했다. 두 번째 손실 압축을 없애면서 얼굴·머리카락·의상 선의 선명도가 개선됐다. 새 파일을 저장소에 포함하므로 정상 빌드는 원본이나 수동 생성 환경 없이 재현 가능하다. 기존 AVIF의 품질·effort·파일 바이트는 바꾸지 않는다.

| 항목 | 실제 결과 |
|---|---|
| WebP 개수·픽셀·색·알파 | 30장, 전부 720×1080, sRGB, 불투명 RGB 3채널 |
| 직접 원본 WebP 합계 | 2,232,062 B · 2.129 MiB |
| 기존 AVIF→WebP 실제 파일 합계 | 2,031,414 B · 1.937 MiB |
| 화질 개선의 추가 용량 | 200,648 B · 195.95 KiB · 9.88% |
| 직접 WebP Base64 합계 | 2,976,128 B · 2.838 MiB |
| data URI·heroId JSON 포함 객체 | 2,977,281 B · 2.839 MiB |
| 직접 WebP 최대·평균 | 95,642 B · 93.40 KiB / 74,402.07 B · 72.66 KiB |
| q82 30장 그대로의 합계 | 2,255,470 B |
| 은하고래 q82 → 채택 q80 | 102,328 B → 95,642 B |
| 혹한의마녀 q82 → 채택 q78 | 112,170 B → 95,448 B |
| 기존 AVIF 합계 | 1,239,023 B · 1.182 MiB, 변경 0장 |

제안된 더 작은 총량 2.1 MiB 및 내장 2.8 MiB를 맞추려고 나머지 28장의 품질을 낮추지 않았다. 실제 총량은 기존 허용 범위 안이고, 주요 선·눈·머리카락을 보존하는 이득이 있다. AVIF effort를 높이는 추가 시도도 채택 근거가 없으므로 수행하지 않았다.

100% 검토는 원본 1024×1536 전체와, 공통 Lanczos3로 720×1080에 줄인 뒤 무손실 PNG로 저장한 기준 이미지의 세부 영역을 함께 사용했다. 후자는 출력 한 픽셀이 검토 한 픽셀에 대응한다. 기존 실제 WebP·직접 q82·최종 q80/q78을 같은 영역·동일 배율로 나란히 확인했다. 검토용 PNG와 JSON은 test-results/.media-review에만 남기며 배포·Git 입력에 넣지 않는다.

| 직접 관찰한 대상 | 채택 품질 | 100% 세부 관찰 |
|---|---|---|
| 지크 | 82 | 붉은 머리 윤곽, 눈·얼굴, 검은 갑옷의 밝은 경계가 기존 재압축본보다 깨끗하게 유지됨 |
| 신데렐라 | 82 | 밝은 머리의 가는 선, 붉은 눈, 유리구두 하이라이트, 손가락·프릴 윤곽 유지 |
| 번개의현자 | 82 | 흰 머리·안경·얼굴과 파란 번개·옷의 선이 기존 재압축본보다 명료함 |
| 은하고래 | 80 | q82 대비 머리·눈·금색 의상 무늬에 새로 눈에 띄는 손실을 관찰하지 못했고 기존 재압축본보다 깨끗함 |
| 혹한의마녀 | 78 | q82보다 약간 부드럽지만 눈·청색 머리·얼음 면의 윤곽과 긴 가닥을 유지하며 새로 거슬리는 경계 손실을 관찰하지 못함 |
| 하모니어스 | 82 | 민트·노랑 머리, 눈의 꽃빛, 리본, 딸기·마카롱의 윤곽이 기존 재압축본보다 명료함 |

보조 수치로 손실 없는 720×1080 RGB 기준과의 PSNR을 계산했다. 30장 전부 직접 WebP가 기존 재압축본보다 높았고 차이는 2.23–3.71 dB, 평균 3.01 dB였다. PSNR은 화질 판정 전체를 대신하지 않으며 여섯 주요 대상의 실제 관찰과 함께 사용했다. 전체 30장의 모든 미세 요소를 사람이 원본 100%와 대조한 것은 아니다. libvips 전체 픽셀 디코딩은 파일 무결성과 출력 형식을 확인하며 실제 휴대전화의 성능·색 표시·메모리 동작까지 보증하지 않는다. 30장 측정의 벽시계 약 11.25초에는 파일 읽기·인코딩·PSNR 계산이 함께 포함되어 순수 인코딩 또는 빌드 시간으로 해석하지 않는다.

## WebP 실제 출력 기록

AVIF 및 원본 해시는 위 표와 canonical catalog를 유지한다. 다음 WebP는 선택 PNG에서 직접 만들었으며, 파일명은 heroId.webp다. 각 파일의 실제 해시와 bytes를 기록했다.

| heroId | 품질 | bytes | 직접 WebP SHA-256 |
|---|---|---|---|
| star_boy | 82 | 80208 | 6c41dffb11c60b363ae594e5dee5155f91ba6386382016e9770872d540c1dadd |
| snow_rabbit | 82 | 53166 | dbe385fdf0495d28d35fc8e9bace7db17190a828b2cdf5ac0aaff64d998b8ca3 |
| silver_rabbit | 82 | 50996 | 81e3d74230c042d38987feecc21709bb7d4003ae29c6e8aa4c5ad969d15d39d6 |
| night_rabbit | 82 | 57602 | b3e61b61d4a4c464cb09fd36c001745048f6406af552a4d1059d002bb9500709 |
| siren | 82 | 60352 | 8a9707ce0628a7dda79ffe5c8bec10ff7ff4118561a5566904668ee8217c994c |
| mushroom_king | 82 | 80110 | 13378ad2613ced6340beebb75169d05b917ce5c32978c0ae522621db65337161 |
| great_detective | 82 | 76428 | 7958dd96b1bc706a2057c54b7bc7fb4b5a1cd12e26fc5ee9988ddad4f5e21614 |
| guardian | 82 | 71160 | 923afd6d716fca0f3d7ff02147332578c5f2642efa426dfb755665fe8a7496ad |
| avalanche_maid | 82 | 63696 | a64c281f668e40e035791565ea7679cc31b05cc8920d12d0f8c12010c8a95cf3 |
| santa | 82 | 83368 | 4f1bca17d5378cfec36d483bc588416b2222b3f72bf208c4284d59dd69e60feb |
| red_dragon | 82 | 87830 | 9e80fa15178db815f1755fd4273876e9dddf18176f0f4940d35ab4c1fd0c47af |
| aurora | 82 | 86200 | 0f327ba639993bd87a813fb6d1d0cb306626aa9aac68cdbd69ae5612c23c7cc0 |
| storm_sage | 82 | 72664 | f0faa6e0589e608a01dba3e36356eea01607c2ab01723b43d8587305f1fb85cf |
| flame_sage | 82 | 75208 | f83e7dd252226ec1bda701235af7e51d2a9417d9fd8a05b01d2ce558c27281eb |
| lightning_sage | 82 | 68560 | d516b62567545f82364886027cf2f96ede5c86bb9c2e8638d1adb0b6fbcd94b8 |
| time_magician | 82 | 79582 | b42a90ab7f06a304d01c818d39ab046c9015a5df8fab8b8532e42a4c612847f8 |
| ancient_dragon | 82 | 75008 | 52030a12be7335f8981e332d4cd0ffd9b8045058f886012af92eb8fb884b6ed9 |
| phantom | 82 | 45138 | b1ef0d414d0f5637a111af608e04f6f830a355ae7bb03e3f6c513b98af60d1c0 |
| zeke | 82 | 83926 | 4e86b97b3414ab4d20a59381d315471b60c38222831c290ddb70dfa5c9dd4752 |
| luna | 82 | 68404 | dd35e79940115a2d9011ab73c5c3c9aa948a9159b012adb237034062a3fa54b2 |
| jasmine | 82 | 60290 | 5ad029a6b5ac78aa5b5561f2522542413200143bc2d9d01c951e533ed4d7455f |
| queen | 82 | 80772 | 9fd6f23c9feac602caf9b8319ac42426913eb0df9034127c4e08ca97941e387e |
| rumi | 82 | 64782 | 809f741137f6b46400f8b6d9d16775d3081d82cea937891f648e48eaef6eac8c |
| cherry_prince | 82 | 76322 | aab03fde6bdf95a5bb37d504d120880f32f2b94f5dbdfc061a7f614697e142b8 |
| time_ruler | 82 | 79496 | 8bf0b229aedb4b8bddce9948d55ee67f2a946d2b87ae0cdfe5b864f29c0fea2a |
| galaxy_whale | 80 | 95642 | 247a91145c3efa696b68f13229966a25f2c92f8a4d6d00969763a23a8bb9f0ee |
| doom | 82 | 87196 | 995906b5a9c88dad17c52cc5f7bd785875289938a5c47eab3c254b6752a2bac5 |
| cinderella | 82 | 80764 | c22a63016e64196da000e33cf46e8c92a1a85608dccbb90bcda02105c27b7d70 |
| harmonious | 82 | 91744 | 2b44a4b65e1b180e22da6330fd43e249ef29cd491ef571fc7938b487aa6859a5 |
| frost_witch | 78 | 95448 | be82b01f1e5cd48cfe34e92fe603d468fb5393be9d2fede5139295ced86afa8b |

## 이번 변경의 단발 검증 기록

- 수동 기본 모드와 --candidate 실행에서 배포 AVIF/WebP 60개 SHA-256이 바뀌지 않았다. candidate AVIF 30개와 직접 WebP 30개는 각각 검토된 canonical 출력의 SHA-256과 모두 동일했다.
- --check-avif로 선택 원본 30개를 실제 재인코딩해 기존 AVIF 30개와 바이트 동일성을 확인했다. 기존 파일은 모두 그대로 보존됐다.
- 직접 WebP 30개를 raw RGB 전체 픽셀로 디코딩했다. 각 720×1080·3채널·2,332,800 pixel bytes와 출력 SHA-256이 일치했고 디코딩 실패가 없었다.
- 선택 원본 누락, 손상 PNG, 잘못된 2:3, Chromium에서 2프레임 확인된 APNG를 candidate 입력으로 넣어 모두 거부됨을 확인했다.
- 용량 목표를 달성할 수 없는 별도 fixture에서 품질 74 아래로 내려가기 전 실패함을 확인했다.
- 반투명 단색 RGBA PNG 한 장의 임시 candidate catalog로 실제 AVIF/WebP를 생성했다. 두 출력 모두 720×1080 RGBA·hasAlpha=true이며 전체 alpha=128을 유지했다. sourceIsOpaque=false, alphaRemoved=false였다.
- 위 fixture는 준비 스크립트의 imports와 catalog cardinality만 임시 검토 파일로 치환했다. 인코딩·입력 검사 로직은 동일하며, 품질 하한 사례만 목표 bytes를 1로 낮췄다. 이 단발 검증을 새 상시 테스트나 필수 게이트로 추가하지 않았다.

positive 결과는 .media-review/preparation-integrity.json·prepare-report.json·candidate-report.json, 부정 입력·알파·전체 픽셀 결과는 negative-validation.json, APNG 메타데이터 확인은 negative-cases/apng-metadata-proof.json에 기록했다. 모두 로컬 검토 자료다. 통합 빌드·브라우저·npm run verify의 결과는 별도 출시 기록을 따른다.

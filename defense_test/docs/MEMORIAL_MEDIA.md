# 메모리얼 원문·이미지 매핑 및 인코딩 기록

사용자가 제공한 pasted-text-1.txt의 전체 이야기와 images 폴더의 PNG 32장을 확인했다. 현재 HEROES 30명에 이야기 한 편과 AVIF 한 장씩을 연결한다. 원본 PNG와 첨부 원문은 Git에 복사하지 않는다. 이 문서는 미디어·원문 데이터 검증을 기록하며, 호감도 잠금·한 장씩 디코딩·화면 복귀의 런타임 검증은 메모리얼 UI 검사에서 별도로 수행한다.

## 원문 보존과 선택 근거

- 메모리얼 제목은 첨부 이야기 제목을 그대로 사용한다. 파일명의 설명형 제목으로 바꾸지 않는다.
- 원문의 대사·문장·문장부호·각 줄 경계를 paragraphs에 그대로 보존한다. CRLF 줄 끝만 LF로 정규화한다. 각 원문 줄을 하나의 항목으로 보관하며, 문장을 합치거나 내용을 새로 쓰지 않는다.
- 시나리오 번호, 캐릭터 외모·보이스 설정 헤더, 이야기 외의 구현 지시는 독서 화면 데이터에 넣지 않는다.
- unlockBond는 기존 호감도 bond의 기준 10이다. 새로운 호감도 획득 방법이나 별도 affection 필드를 추가하지 않는다.
- 아발란체메이드는 현재 메이드의 heroId avalanche_maid에, 퍼펙트아우로라는 현재 아우로라의 heroId aurora에 연결한다. 둘은 별도 신규 캐릭터로 만들지 않는다.
- 번개의현자 16A는 실제 바닥의 검은 세 줄이 제공된 이야기 검은 흔적의 순서와 대응한다. 16B는 책상에서 계산하는 다른 장면이어서 선택하지 않는다.
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
| lightning_sage / 번개의현자 | 검은 흔적의 순서 | 626–633 | 16A_번개의현자_세 줄의 검은 흔적.png | 37052 |
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
| lightning_sage | c85784de85321bbd1c81fc959999dd9e137f0d7d402f74c65558ff19bdba9d9f | 5bd78990b3133ae6172366b547032600b0f2b6df9630ef9c10e19fde55178f6b | a8265037797ed8e508910c75b6c68c066d7aa19119a035b1924846d800d3072e |
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

source filename, 해상도, alpha, 원본/출력 SHA-256, bytes, Base64 bytes, 원문 줄 범위와 본문 SHA-256은 src/memorial.js의 MEMORIAL_MEDIA_MANIFEST에도 리터럴로 기록했다. 본문 해시는 paragraphs.join("\n")의 UTF-8 바이트를 대상으로 계산한다.

## 동일 원본에서 재인코딩하는 절차

원본 images 폴더는 저장소 밖에 보관한다. 아래 핵심 코드를 Node ESM 파일로 임시 폴더에 저장하고, 프로젝트에 설치된 Sharp를 사용한다. 예: node <임시 encode-memorial.mjs> "<외부 images 폴더>" "<defense_test 폴더>". sourceDirectory, gameDirectory는 path.resolve(process.argv[2/3])로 받는다. 새 저장소 스크립트나 원본 PNG를 빌드 입력에 추가하지 않는다. Sharp 0.35.4, libvips 8.18.6, AOM 3.14.1, libheif 1.23.2에서 생성했다.

```js
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const sourceDirectory = path.resolve(process.argv[2]);
const gameDirectory = path.resolve(process.argv[3]);
const require = createRequire(path.join(gameDirectory, 'package.json'));
const sharp = require('sharp');
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const {MEMORIAL_MEDIA_MANIFEST} = await import(pathToFileURL(path.join(gameDirectory, 'src/memorial.js')).href);
for (const [heroId, record] of Object.entries(MEMORIAL_MEDIA_MANIFEST)) {
  const input = await fs.readFile(path.join(sourceDirectory, record.sourceFilename));
  if (sha256(input) !== record.sourceSha256) throw new Error('Original image changed: ' + heroId);
  const stats = await sharp(input).stats();
  let pipeline = sharp(input).rotate().toColourspace('srgb').resize({
    width: 720, height: 1080, fit: 'inside', withoutEnlargement: true, kernel: 'lanczos3',
  });
  if (stats.isOpaque) pipeline = pipeline.removeAlpha();
  const encoded = await pipeline.avif({quality: 52, effort: 4, chromaSubsampling: '4:4:4'}).toBuffer();
  if (sha256(encoded) !== record.outputSha256) throw new Error('Encoder output changed: ' + heroId);
  await fs.writeFile(path.join(gameDirectory, 'assets/memorial', heroId + '.avif'), encoded);
}
```

실제 재생성 전에는 입력 SHA-256이 기록과 일치하는지 확인하고, 이후 출력 SHA-256·해상도·알파·용량을 검사한다. 같은 인코더 버전을 사용하면 기록된 출력과 대조할 수 있다. AVIF와 WebP를 중복 내장하거나 메모리얼 전용 썸네일을 추가로 만들지 않았다.

## 빌드와 런타임 연결 계약

- MEMORIAL_MEDIA_PATHS만 순회하여 생성된 AVIF를 읽고 window.__MEMORIAL_MEDIA__에 별도 내장한다.
- 기존 ASSET_PATHS, window.__ASTRA_ASSETS__, Art.load의 전투용 선로딩 목록에는 메모리얼을 합치지 않는다.
- 초기 화면 및 잠금 목록은 기존 동료 초상화를 사용한다. 독서 화면을 열 때 현재 이미지 한 장에만 src를 지정한다.
- bond<10은 잠금이며 bond>=10에서 원문과 그림을 열 수 있다. 소유 조건과 잠금 표현은 UI 계약에서 검증한다.
- 독서 화면을 닫거나 다른 화면으로 이동하면 큰 이미지 DOM과 참조를 제거한다. Base64를 localStorage에 쓰지 않는다.
- 미디어 데이터만으로 30명 coverage, source/output 해시, 본문 해시, 최대 해상도, 불필요한 alpha 부재, 개별/전체 bytes budget을 자동 검증할 수 있다.
- 최종 npm run verify, 단일 HTML의 별도 __MEMORIAL_MEDIA__ 내장과 Chromium/WebKit 실제 디코딩·잠금·복귀 검사는 통합 담당이 수행한다. 이 미디어 작업에서는 게임 빌드나 커밋을 실행하지 않았다.

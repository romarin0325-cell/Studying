# 다음은 너 Windows 실행기

`dist`의 `Relaymare.exe`와 `Relaymare.html`을 같은 폴더에 두고 `Relaymare.exe`를 더블 클릭하세요. 앱 창에는 Chrome 또는 Edge가 필요합니다. 실행기는 Chrome을 먼저 찾고, 그다음 Edge를 찾습니다. 둘 다 없으면 기본 브라우저로 게임을 엽니다.

저장 데이터는 `%LOCALAPPDATA%\Relaymare\browser\Chrome` 또는 `%LOCALAPPDATA%\Relaymare\browser\Edge`에 있는 게임 전용 브라우저 프로필에 남습니다. 이어서 플레이하려면 같은 브라우저와 HTML 파일 경로를 사용하세요. 기본 브라우저로 열리면 그 브라우저의 프로필에 저장됩니다.

저장소 루트에서 다음 명령을 실행하면 Windows의 .NET Framework C# 컴파일러로 `card_pixel/game/dist/Relaymare.exe`를 빌드합니다.

```powershell
node card_pixel/game/launcher/build-launcher.mjs
```

아이콘은 `assets/ash-idle.png`의 애쉬 얼굴로 만듭니다. 아이콘을 바꿀 때는 먼저 아래 명령을 실행해 `launcher/relaymare.ico`와 게임 탭 아이콘 `assets/app-icon.png`를 다시 만든 뒤 실행기와 게임을 다시 빌드하세요.

```powershell
node card_pixel/game/launcher/make-icon.mjs
```

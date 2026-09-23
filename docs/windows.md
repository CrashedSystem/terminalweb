# terminalweb — Windows PC 설치 가이드

Termux의 `terminalweb`을 **Windows Terminal 대체용** 데스크톱 앱으로 쓰는 법.
PWA로 설치하면 앱 창 + 작업표시줄 아이콘 + 자체 셸(cmd / PowerShell / WSL / Git Bash)이
독립 실행된다. **별도 컴파일 불필요** — Node.js만 깔면 된다.

---

## 요구사항

| 항목 | 값 |
|------|----|
| OS | Windows 10 1809+ (ConPTY 지원) / Windows 11 |
| 런타임 | Node.js 18+ (https://nodejs.org — **20/22 LTS 권장**: node-pty 전처리 바이너리 포함. 다른 버전은 C++ 빌드 도구 필요할 수 있음) |
| 브라우저 | Microsoft Edge 또는 Chrome (PWA 설치 지원) |
| 권한 | 로컬 실행이라 방화벽·HTTPS 불필요 |

---

## 1단계 — 소스 받기

```
git clone https://github.com/CrashedSystem/terminalweb.git
cd terminalweb
```

Git 없으면 GitHub 페이지에서 **Code → Download ZIP** 후 압축 풀어도 된다.

## 2단계 — 의존성 + 서버 실행

**가장 쉬운 방법 — `start.bat` 더블클릭:** 첫 실행이면 `npm install` + vendor 번들,
서버 백그라운드 시작, 기본 브라우저로 `http://localhost:8080` 자동 오픈까지 한 번에.

수동:
```
npm install
npm start
```

첫 실행 시 콘솔에 `terminalweb listening on http://localhost:8080` 확인.

- Windows에서는 **tmux 대신 사용자 셸 직접 스폰**한다 (code에 자동 분기 — 설정 불필요).
- 기본 셸은 `PowerShell` (설정에서 cmd / WSL / Git Bash로 변경 가능, 아래 참조).
- 서버를 종료하려면 콘솔에서 `Ctrl+C`.

> 팁: 서버가 켜 있는 동안만 접속된다. 자동시작 원하면 작업 스케줄러에
> `npm start` 등록하거나 `nssm`으로 서비스화.

## 3단계 — PWA 설치 (데스크톱 앱으로)

1. **Edge** 주소창에 `http://localhost:8080` 입력 후 Enter
2. 주소창 오른쪽 **앱 설치 아이콘**(⊕/모니터) 클릭 → **"설치"**
   - Edge: `설정 → 앱 → 이 사이트를 앱으로 설치`
   - Chrome: 주소창 오른쪽 **설치 아이콘**
3. 설치 완료 → **작업표시줄/시작 메뉴에 "terminalweb" 앱**이 생성 — 클릭하면
   독립 창으로 실행 (브라우저 주소창 없이 본격 터미널)

> 로컬(localhost)은 브라우저가 "안전한 컨텍스트"로 취급하므로 HTTPS 인증서 없이
> 바로 PWA 설치 가능. **알림(Bell notify)도 이 환경에서 동작**한다.

## 4단계 — 셸 프로파일 변경 (선택)

기본 `PowerShell` 대신 다른 셸을 쓰려면:

1. 터미널 창에서 **`settings`** 명령 또는 **⚙ 설정 버튼**
2. **Profiles** 섹션에서 `command` 필드 수정:

| 원하는 셸 | command 값 |
|-----------|-----------|
| PowerShell (기본) | `powershell.exe` |
| 명령 프롬프트 | `cmd.exe` |
| Git Bash | `"C:\\Program Files\\Git\\bin\\bash.exe"` |
| WSL (Ubuntu 등) | `wsl.exe` |
| Node.js REPL | `node` |

프로필 여러 개 추가도 가능 — `+ Add profile`로 새 프로필 만들고 탭으로 전환.

---

## 문제 해결

- **`npm start` 후 "port 8080 in use"?** — 다른 터미널/서비스가 8080 점유.
  `http://localhost:8080` 주소를 열어보고 무슨 프로그램인지 확인하거나
  settings.json의 `port` 값을 8081 등으로 변경.
- **흰 화면 / 접속 안 됨** — 서버 콘솔에 `terminalweb listening...` 떴는지 확인.
  서버가 꺼져 있으면 PWA 아이콘도 `서버에 연결할 수 없음` 표시.
  (주의: PWA는 서버가 켜진 상태에서만 동작. 로컬호스트 전용 앱이므로
  "오프라인에서도 열리는 일반 PWA"와는 다르다.)
- **한글 깨짐 / 폰트** — 설정 → Appearance → Font에서 `Pretendard` 계열 선택.
- **Git Bash 가 느림?** — 프로파일 command를 `bash.exe --noprofile --norc` 로
  시작하면 프롬프트 커스텀 로딩을 건너뛰어 빨라짐.

---

## Windows 전용 동작 (Termux와 차이)

| 기능 | Termux(안드로이드) | Windows PC |
|------|-----------|-----------|
| 세션 백엔드 | tmux (탭 분리 후 재접속 유지) | 셸 직접 스폰 (ConPTY) |
| 기본 셸 | bash | PowerShell |
| PWA 설치 | 로컬 localhost | 로컬 localhost (동일) |
| 벨 OS 알림 | Notification API | Notification API (동일, PWA 설치 시) |
| 마우스/SW 키보드 | 터치바 지원 | 데스크톱 — 마우스·단축키 그대로 |

---

## Node 0: 서버 코드의 Windows 지원 (이미 내장)

- `server/pty.js` — `os.platform()==='win32'`면 tmux 대신 **셸 직접 스폰**
  (PowerShell/cmd/WSL/도스 경로 처리 내장)
- `server/config.js` — Windows 기본 프로파일 셸 자동 분기
- 별도 `.exe` 컴파일 없음 — Node 스크립트로 그대로 실행될 뿐

# 붉은 서재 — 공포 살인사건 3D 방탈출 (1단계 프로토타입)

Vite + Three.js. 외부 3D 모델 없이 기본 도형만으로 구성되어 있습니다.

## 실행
```bash
npm install
npm run dev
```
브라우저에서 화면을 클릭하면 시작합니다 (마우스 포인터 잠금).

## 조작
| 입력 | 동작 |
|---|---|
| 바닥 클릭 | 그 지점까지 걸어가기 (방이 다르면 문을 지나서) |
| 물체 클릭 | 멀면 다가가기, 가까우면 조사하기 |
| 좌클릭 드래그 | 시점 돌리기 (3D 시점에서는 방 주위로 회전) |
| ← → | 좌우 회전 |
| ↑ ↓ / WASD | 앞뒤(좌우) 이동, Shift 달리기 |
| 마우스 휠 | 3D 시점 확대·축소 |
| V 또는 우측 상단 버튼 | 1인칭 ↔ 3D 시점 |
| E | 가까운 물체 조사 · 대화창 넘기기 |
| F / M / H | 손전등 / 소리 / 힌트(최대 3회) |
| Enter | 채팅으로 행동 입력 |

## 진행 순서
서재에서 단서 조사 → **서랍(4자리)** → 녹슨 열쇠로 **서재 문** → 저장고에서 단서 조사 → **금고(4자리)** → 검은 열쇠로 **출구 철문** → 엔딩

## 구조
```
src/
  main.js                 시작점. 모듈을 연결하고 루프·키 입력·포인터 락 관리
  scene/helpers.js        박스·충돌체·상호작용 등록·트윈·핏자국 공용 함수
  scene/lighting.js       안개, 손전등, 흔들리는 전구, 붉은 조명 (LIGHT_CONFIG로 밝기·색 조절)
  scene/atmosphere.js     먼지 입자, 핏방울, 깜짝 이벤트(정전+속삭임)
  audio/ambience.js       음원 파일 없이 만든 공포 사운드 (드론, 바람, 삐걱임, 발소리, 심장 박동)
  scene/room1.js          서재
  scene/room2.js          지하 와인 저장고
  player/player.js        캡슐 캐릭터, 클릭 이동·키보드 이동, 원-사각형 충돌
  player/cameraController.js  1인칭 / 3D(내려다보기) 시점, 드래그·방향키 회전, 카메라 쪽 벽 자동 숨김
  player/interaction.js   마우스가 가리키는 물체/바닥 감지 → 테두리 발광 + 안내 문구
  game/gameState.js       상태·이벤트·정답 판정 (정답에 접근하는 유일한 파일)
  game/items.js           아이템 정보 조회
  game/puzzles.js         E키/채팅 행동 → 조사·열쇠·키패드 흐름
  ui/hud.js, inventory.js, dialog.js, chat.js
  ai/gameMaster.js        AI 게임 마스터 (현재 가짜 응답)
  data/scenario.json      방·아이템·단서·힌트·정답
```

## 새 물체/퍼즐 추가하는 법
1. `scenario.json`의 `interactables`에 id와 텍스트 추가 (`clue` / `codeLock` / `keyLock`)
2. 방 파일에서 도형을 만들고 `registerInteractable(ctx, '같은 id', object)`
3. 열리는 연출이 있으면 `ctx.openers['id'] = () => { ... }`
4. 비밀번호 장치라면 `solutions`에 정답 추가

## 팀 분담 예시 (4명)
- A: `scene/` — 방 모델링, 조명, 분위기
- B: `player/` — 이동, 카메라, 상호작용 감도
- C: `game/` + `data/` — 시나리오, 퍼즐, 상태 규칙
- D: `ui/` + `ai/` — UI 연출, 이후 LLM 연결

## 정답 보안에 대해
- 정답은 `gameState.js` 내부 변수에만 보관하고, 다른 모듈·AI 요약·콘솔에는 넘기지 않습니다.
- 단, 브라우저 게임은 번들된 JS를 개발자 도구로 열면 결국 볼 수 있습니다.
  진짜로 숨기려면 이후 단계에서 `submitCode` 판정을 서버 API로 옮기면 됩니다
  (gameState.submitCode 내부만 fetch로 바꾸면 됨).

## LLM 연결 (다음 단계)
`src/ai/gameMaster.js`의 `interpretAction`, `narrate`만 실제 API 호출로 바꾸면 됩니다.
API 키는 브라우저에 두지 말고 서버(프록시)를 거치세요. AI에는 `getSummaryForAI()` 요약만 전달되며,
AI가 돌려준 `target`은 `state.targets`의 id인지 꼭 검증하세요.

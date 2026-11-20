// =============================================================
// main.js — 게임 시작점
// 하는 일:
//   1) Three.js 렌더러/씬/카메라 준비
//   2) 방(서재, 와인 저장고), 조명, 분위기 연출, 사운드 생성
//   3) 플레이어·카메라·상호작용·퍼즐·UI·AI 게임 마스터 모듈을 서로 연결
//   4) 마우스(클릭 이동, 드래그 회전)와 키보드 입력 처리
//   5) 매 프레임 업데이트 루프
// 각 기능의 실제 내용은 해당 폴더의 파일에 있다. 여기서는 "연결"만 한다.
// =============================================================
import * as THREE from 'three';
import './style.css';

import { gameState } from './game/gameState.js';
import { Puzzles } from './game/puzzles.js';
import { createContext, updateAnimations } from './scene/helpers.js';
import { setupAtmosphere, createFlashlight, LIGHT_CONFIG } from './scene/lighting.js';
import { createScareEvents } from './scene/atmosphere.js';
import { createPostFX } from './scene/postfx.js';
import { buildStudy } from './scene/room1.js';
import { buildCellar, CELLAR_SHIFT_Z } from './scene/room2.js';
import { Player } from './player/player.js';
import { CameraController } from './player/cameraController.js';
import { Interaction } from './player/interaction.js';
import { Hud } from './ui/hud.js';
import { Inventory } from './ui/inventory.js';
import { Dialog } from './ui/dialog.js';
import { Chat } from './ui/chat.js';
import { Phone } from './ui/phone.js';
import { Bookshelf } from './ui/bookshelf.js';
import { Diary } from './ui/diary.js';
import { ClueBoard } from './ui/clueBoard.js';
import { EntryNote } from './ui/entryNote.js';
import { CalendarView } from './ui/calendarView.js';
import { createFlashlightModel } from './player/flashlightModel.js';
import { setFlameCamera, updateFlames } from './scene/flame.js';
import { LIGHT_BUS } from './scene/lighting.js';
import { Ambience } from './audio/ambience.js';
import { interpretAction, narrate } from './ai/gameMaster.js';

// ---------- 렌더러 / 씬 / 카메라 ----------
// 후처리(EffectComposer)를 거치면 기본 안티앨리어싱은 쓰이지 않으므로 꺼서 가볍게
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
// 해상도는 프레임 속도에 맞춰 자동 조절 (아래 '자동 화질' 참고)
const MAX_PR = Math.min(window.devicePixelRatio, 1.25);
let pixelRatio = MAX_PR;
renderer.setPixelRatio(pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = LIGHT_CONFIG.exposure;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap; // Soft보다 훨씬 가볍고 손전등 그림자엔 충분
document.getElementById('app').appendChild(renderer.domElement);
const canvas = renderer.domElement;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.05, 80);
scene.add(camera);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  fx.setSize(window.innerWidth, window.innerHeight);
});
const fx = createPostFX(renderer, scene, camera); // 공포 필터 (노이즈·비네팅·빛 번짐)

// ---------- 월드 ----------
const hemi = setupAtmosphere(scene);
const ctx = createContext(scene);
const study = buildStudy(ctx);
const cellarStart = scene.children.length;
buildCellar(ctx);

// ---------- 아직 못 들어간 지하 저장고는 3D 시점에서 '형태만' ----------
// 서재 북쪽 문을 열기 전엔 저장고의 가구·소품을 숨기고 벽·바닥만 흐린 윤곽으로 보여준다.
// 문이 열리면 원래 모습으로 전부 드러난다. (조명은 그대로 둬서 셰이더가 다시 컴파일되지 않게)
const cellarObjects = scene.children.slice(cellarStart);
const cellarShell = new Set([...ctx.walls, ...ctx.floors, ...ctx.ceilings]);
const silhouetteMat = new THREE.MeshBasicMaterial({ color: 0x4a2620, transparent: true, opacity: 0.32, depthWrite: false });
function setCellarRevealed(on) {
  for (const o of cellarObjects) {
    if (o.isLight) continue;
    if (cellarShell.has(o) && o.isMesh) {
      if (!on && !o.userData.realMat) {
        o.userData.realMat = o.material;
        o.material = silhouetteMat;
      } else if (on && o.userData.realMat) {
        o.material = o.userData.realMat;
        delete o.userData.realMat;
      }
    } else {
      o.visible = on;
    }
  }
}
setCellarRevealed(false);
gameState.addEventListener('unlock', (e) => {
  if (e.detail.id === 'study_door') setCellarRevealed(true);
});
scene.updateMatrixWorld(true);

// 그림자: 반투명(핏자국, 글씨)과 먼지는 제외
// 그림자: 반투명(핏자국, 글씨)·먼지·작은 소품(크리스털, 병, 촛불 등)은 그림자를 만들지 않음
//          → 매 프레임 그리는 그림자 계산량이 크게 줄어 화면이 부드러워짐
const _shadowBox = new THREE.Box3();
const _shadowSize = new THREE.Vector3();
scene.traverse((o) => {
  if (!o.isMesh) return;
  o.receiveShadow = true;
  if (o.material.transparent || o.isInstancedMesh) {
    o.castShadow = false;
    return;
  }
  _shadowBox.setFromObject(o).getSize(_shadowSize);
  o.castShadow = Math.max(_shadowSize.x, _shadowSize.y, _shadowSize.z) > 0.35;
});

const ROOM_CENTER = {
  study: { x: (study.bounds.minX + study.bounds.maxX) / 2, z: (study.bounds.minZ + study.bounds.maxZ) / 2 },
  cellar: { x: 0, z: -10 + CELLAR_SHIFT_Z },
};

// ---------- 플레이어 / 카메라 / 손전등 ----------
const player = new Player(scene, ctx.colliders, study.spawn);
player.mesh.traverse((o) => (o.castShadow = false));
const camCtl = new CameraController(camera, player, canvas, ctx);
camCtl.setRoomCenter(ROOM_CENTER.study.x, ROOM_CENTER.study.z);
const flashlight = createFlashlight(scene);
const interaction = new Interaction(scene, camera, player, ctx);
const torchModel = createFlashlightModel(camera); // 1인칭에서 손에 든 손전등
ctx.victimModel?.then((meshes) => interaction.addMeshes('body', meshes)); // 피해자 3D 모델을 클릭 대상에 추가
setFlameCamera(camera);
const ambience = new Ambience();
ctx.onLightning = () => {
  ambience.thunder(); // 창밖 번개 → 천둥
  fx.kick(0.25);
};

// ---------- UI ----------
const uiRoot = document.getElementById('ui-root');
const hud = new Hud(uiRoot, { onViewChange: toggleView });
new Inventory(uiRoot);
const dialog = new Dialog(uiRoot);
const phone = new Phone(uiRoot);
const bookshelf = new Bookshelf(uiRoot, { onPull: () => ambience.step?.() });
const diary = new Diary(uiRoot);
const clueBoard = new ClueBoard(uiRoot, { openKeypad: (id, prompt) => puzzles.openKeypad(id, prompt) });
const calendarView = new CalendarView(uiRoot);
const puzzles = new Puzzles({ dialog, phone, bookshelf, diary, clueBoard, calendarView });
hud.onCluesClick = () => clueBoard.open();
// 모아야 할 단서를 새로 찾으면 알림
let pendingClueBoard = null; // 단서를 다 모으면, 지금 보던 설명창을 닫은 뒤 단서 수첩을 자동으로 띄움
gameState.addEventListener('clue', (e) => {
  const { found, total, complete, lockId } = e.detail;
  if (complete && !gameState.isUnlocked(lockId)) pendingClueBoard = lockId;
  hud.toast(complete ? `단서를 모두 찾았다! (${found} / ${total}) 문으로 가서 단서를 조합해 보자.` : `단서 발견! (${found} / ${total})`, complete ? 5000 : 2600);
});
interaction.onFocusChange = (item) => fx.setOutline(item?.object ?? null); // 가리킨 물체만 윤곽선

// 채팅 → AI 게임 마스터(해석) → puzzles(규칙 처리) → AI 게임 마스터(묘사)
const chat = new Chat(uiRoot, {
  onSubmit: async (text) => {
    chat.addLine(text, 'player');
    if (gameState.status !== 'playing') return chat.addLine('…아직 저택에 들어가지 않았다.', 'system');
    // '힌트', '도와줘', '모르겠어' → H 키와 같은 힌트
    if (/힌트|hint|도와|모르겠|막혔/i.test(text)) {
      const r = gameState.useHint();
      chat.addLine(r.ok ? `${r.text} (남은 힌트 ${r.left})` : r.text, 'gm');
      return;
    }
    const action = await interpretAction(text, gameState.getSummaryForAI()); // 정답 없는 요약만 전달
    const result = puzzles.handleAction(action);
    if (result.kind === 'keypad' || phone.isOpen) chat.blur();
    const line = await narrate(result, gameState.getSummaryForAI());
    chat.addLine(line, 'gm');
  },
});

// ---------- 깜짝 이벤트 ----------
const scares = createScareEvents(
  ({ type, whisper }) => {
    if (type === 'outage') {
      // 천장 전구가 10초 동안 꺼짐 → 꺼지는 순간 지직, 어둠 속 속삭임
      ambience.zap();
      fx.kick(0.5);
      setTimeout(() => {
        if (gameState.status === 'playing') hud.whisper(whisper);
      }, 4000);
    } else {
      hud.whisper(whisper);
      ambience.scare();
      fx.kick(1);
    }
  },
  () => gameState.state.currentRoom
);

// ---------- 시작 (타이틀 → 스토리 → 게임) ----------
hud.onIntro({
  onFirstClick: () => ambience.start(),
  onEnter: () => {
    gameState.start(); // 타이머 시작 → 먼저 서재 문 앞 쪽지 화면
    entryNote.open();
  },
});

// ---------- 서재에 들어가기 전: 문에 붙은 쪽지 ----------
const entryNote = new EntryNote(uiRoot, {
  onKey: () => ambience.step?.(),
  onOpened: (text) => {
    ambience.creak();
    const room = gameState.scenario.rooms[gameState.state.currentRoom];
    dialog.show(room.name, `${text}\n\n${room.intro}`);
    chat.addLine('바닥이나 물건을 클릭해 움직여 보자. 쪽지는 오른쪽 위 소지품에 있다.', 'system');
  },
});

// ---------- 게임 상태 이벤트 → 월드 연출 ----------
gameState.addEventListener('unlock', (e) => ctx.openers[e.detail.id]?.());
gameState.addEventListener('open', (e) => {
  ctx.openers[e.detail.id]?.(); // 상자 덮개·궤짝 뚜껑·커튼 열리는 연출
  if (e.detail.id === 'window') ambience.swish();
  else ambience.creak();
  if (e.detail.scare) {
    ambience.scare();
    fx.kick(1);
  }
});
gameState.addEventListener('item', (e) => {
  // 물건을 집으면 그 자리에서 사라짐 (서랍이 열리는 걸 보고 난 뒤에 사라지게 잠깐 기다림)
  const obj = ctx.hideOnItem[e.detail.itemId];
  if (obj) setTimeout(() => (obj.visible = false), 300);
});
gameState.addEventListener('room', (e) => {
  const room = gameState.scenario.rooms[e.detail.roomId];
  hud.toast(e.detail.firstVisit ? `${room.name} — ${room.intro}` : room.name, e.detail.firstVisit ? 5000 : 1800);
  const c = ROOM_CENTER[e.detail.roomId];
  camCtl.setRoomCenter(c.x, c.z);
});
gameState.addEventListener('ending', (e) => {
  scares.active = false;
  const show = () => {
    dialog.close();
    hud.showEnding(e.detail);
  };
  if (e.detail.won) setTimeout(show, 2200); // 철문 열리는 연출을 보고 나서
  else show();
});

// ---------- 공용 동작 ----------
function toggleView() {
  hud.setView(camCtl.toggleMode());
}

function uiBlocking() {
  return dialog.isOpen || dialog.keypadOpen || chat.isFocused || phone.isOpen || bookshelf.isOpen || diary.isOpen || clueBoard.isOpen || entryNote.isOpen || calendarView.isOpen;
}

/** 물체 조사 (가까이 있을 때) */
function inspectItem(item) {
  if (camCtl.mode === 'first') camCtl.lookAtPoint(item.center.x, item.center.y, item.center.z);
  player.facing = Math.atan2(-(item.center.x - player.position.x), -(item.center.z - player.position.z));
  puzzles.interact(item.id);
}

// 클릭 한 번에 움직이는 최대 거리 (조금씩 다가가기)
const CLICK_STEP = 1.3;
const DOOR_LINE = -5.1;

/**
 * (x, z) 쪽으로 한 걸음(CLICK_STEP)만 이동. 목표가 가까우면 거기까지.
 * stop: 목표에서 이만큼 떨어지면 멈춤 / onArrive: 목표에 실제로 닿았을 때
 */
function stepToward(x, z, { stop = 0.15, onArrive = null } = {}) {
  const p = player.position;
  const doorOpen = gameState.isUnlocked('study_door');
  const otherRoom = z < DOOR_LINE !== p.z < DOOR_LINE;
  if (otherRoom) {
    if (!doorOpen) {
      hud.toast('문이 잠겨 있어 저쪽으로 갈 수 없다.', 2000);
      return;
    }
    // 다른 방이면 먼저 문 쪽으로 한 걸음씩
    const nearZ = p.z < DOOR_LINE ? -5.8 : -4.4;
    const farZ = p.z < DOOR_LINE ? -4.4 : -5.8;
    const dd = Math.hypot(0 - p.x, nearZ - p.z);
    if (dd > CLICK_STEP) {
      const k = CLICK_STEP / dd;
      player.walkTo(p.x + (0 - p.x) * k, p.z + (nearZ - p.z) * k, { doorOpen });
    } else player.walkTo(0, farZ, { doorOpen });
    return;
  }
  const dx = x - p.x;
  const dz = z - p.z;
  const d = Math.hypot(dx, dz);
  if (d - stop <= CLICK_STEP) {
    player.walkTo(x, z, { stop, doorOpen, onArrive });
  } else {
    const k = CLICK_STEP / d;
    player.walkTo(p.x + dx * k, p.z + dz * k, { doorOpen });
  }
}

/** 물체 앞까지 바로 걸어가서, 도착하면 바라보고 조사까지 */
// 물체를 "한눈에 들어오게" 바라볼 위치 계산
//  - 물체가 클수록 더 떨어져서 본다 (작은 소품 ≈1.6m, 액자·책장 ≈2m, 큰 가구 ≈2.6m)
//  - 벽에 걸린 얇은 물체(액자, 시계, 창문, 벽 글씨…)는 비스듬히 말고 정면에 선다
const VIEW_ROOMS = [
  { minX: study.bounds.minX + 0.45, maxX: study.bounds.maxX - 0.45, minZ: study.bounds.minZ + 0.45, maxZ: study.bounds.maxZ - 0.45 }, // 서재 (크기 조절 반영)
  { minX: -3.6, maxX: 3.6, minZ: -14.6 + CELLAR_SHIFT_Z, maxZ: -5.6 + CELLAR_SHIFT_Z }, // 저장고 (계단 아래)
];
const _v = new THREE.Vector3();
function viewSpot(item) {
  const c = item.center;
  const size = item.size ?? _v.set(0.5, 0.5, 0.5);
  // 가로 크기 위주로, 키(높이)는 조금만 반영 → 키 큰 장식장 앞에서도 가구에 막히지 않는 거리
  const dist = THREE.MathUtils.clamp(1.1 + Math.max(size.x, size.z) * 0.7 + size.y * 0.25, 1.6, 2.6);
  const p = player.position;
  let tx = p.x - c.x;
  let tz = p.z - c.z;
  const tl = Math.hypot(tx, tz) || 1;
  tx /= tl;
  tz /= tl;
  let nx = tx;
  let nz = tz;
  const wallHung = Math.min(size.x, size.z) < 0.55 && c.y > 0.9; // 벽에 걸리거나 붙은 물체 (액자·시계·창문·장식장…)
  if (wallHung) {
    item.object.getWorldDirection(_v); // 물체의 정면(로컬 +z)
    const l = Math.hypot(_v.x, _v.z);
    if (l > 0.3) {
      nx = _v.x / l;
      nz = _v.z / l;
      if (nx * tx + nz * tz < 0) {
        nx = -nx;
        nz = -nz;
      }
    }
  }
  let x = c.x + nx * dist;
  let z = c.z + nz * dist;
  const room = VIEW_ROOMS.find((r) => c.x >= r.minX - 0.6 && c.x <= r.maxX + 0.6 && c.z >= r.minZ - 0.6 && c.z <= r.maxZ + 0.6) ?? VIEW_ROOMS[0];
  x = THREE.MathUtils.clamp(x, room.minX, room.maxX);
  z = THREE.MathUtils.clamp(z, room.minZ, room.maxZ);
  return { x, z };
}

let approachLook = null; // 다가가는 동안 시선을 고정할 물체 중심
function approachItem(item) {
  const spot = viewSpot(item);
  const p = player.position;
  if (Math.hypot(spot.x - p.x, spot.z - p.z) < 0.35) {
    inspectItem(item); // 이미 보기 좋은 자리에 있음
    return;
  }
  const ok = player.walkTo(spot.x, spot.z, {
    stop: 0.12,
    doorOpen: gameState.isUnlocked('study_door'),
    onArrive: () => {
      approachLook = null;
      if (gameState.status === 'playing' && !uiBlocking()) inspectItem(item);
    },
  });
  if (!ok) hud.toast('문이 잠겨 있어 저쪽으로 갈 수 없다.', 2000);
  else approachLook = item.center;
}

// ---------- 마우스 ----------
canvas.addEventListener('pointermove', (e) => {
  interaction.setPointer(e.clientX, e.clientY, window.innerWidth, window.innerHeight);
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});
const mouse = { x: 0, y: 0 };

canvas.addEventListener('click', () => {
  if (gameState.status !== 'playing' || uiBlocking() || camCtl.wasDragging) return;
  const h = interaction.hover;
  if (!h) return;
  if (h.item) {
    approachItem(h.item); // 한눈에 보이는 거리로 가서 바라보며 조사
  } else if (h.isFloor) {
    stepToward(h.point.x, h.point.z);
  }
});

// ---------- 키보드 ----------
window.addEventListener('keydown', (e) => {
  if (chat.isFocused) return; // 채팅 입력 중엔 chat.js가 처리
  if (phone.handleKey(e)) return; // 휴대폰 화면이 열려 있으면 폰 조작
  if (bookshelf.handleKey(e)) return; // 책장 화면
  if (diary.handleKey(e)) return; // 일기장 화면
  if (dialog.handleKey(e)) return; // 키패드가 열려 있으면 숫자 입력
  if (entryNote.handleKey(e)) return; // 들어가기 전 쪽지
  if (calendarView.handleKey(e)) return; // 달력 크게 보기
  if (clueBoard.handleKey(e)) return; // 단서 수첩
  if (e.code.startsWith('Arrow')) e.preventDefault();
  if (gameState.status !== 'playing') return;

  if (dialog.isOpen) {
    if (['KeyE', 'Space', 'Enter', 'Escape'].includes(e.code) && !e.repeat) {
      e.preventDefault();
      dialog.advance();
    }
    return;
  }
  if (e.repeat) return;
  switch (e.code) {
    case 'KeyE': {
      const fwd = camCtl.mode === 'first' ? camCtl.getForward() : new THREE.Vector3(-Math.sin(player.facing), 0, -Math.cos(player.facing));
      const item = interaction.pickForKey(fwd);
      if (item) inspectItem(item);
      break;
    }
    case 'KeyC':
      clueBoard.open(); // 단서 수첩
      break;
    case 'KeyV':
      toggleView();
      break;
    case 'KeyF':
      hud.setFlashlight(flashlight.toggle());
      break;
    case 'KeyM':
      hud.setMuted(ambience.toggleMute());
      break;
    case 'KeyH': {
      const r = gameState.useHint();
      dialog.show(r.ok ? `속삭임 (남은 힌트 ${r.left})` : '속삭임', r.text);
      break;
    }
    case 'Enter':
      e.preventDefault();
      player.keys.clear();
      player.cancelWalk();
      chat.focus();
      break;
  }
});

// ---------- 액자 귀신 ----------
// 액자를 2.5초 이상 바라보면(마우스로 가리키거나 화면 가운데에 두면) 귀신 얼굴이 번쩍 튀어나온다.
// 액자마다 한 번씩만.
const ghostRay = new THREE.Raycaster();
const ghostStates = ctx.ghostFrames.map((g) => ({ ...g, gaze: 0, done: false, t: -1 }));
function gazedGhostId() {
  const f = interaction.focused;
  if (f && ghostStates.some((g) => g.id === f.id)) return f.id;
  if (camCtl.blend > 0.5) return null;
  ghostRay.setFromCamera({ x: 0, y: 0 }, camera);
  ghostRay.far = 5;
  for (const h of ghostRay.intersectObjects(interaction.rayTargets, false)) {
    if (!h.object.visible) continue;
    return h.object.userData.interactId ?? null;
  }
  return null;
}
function updateGhosts(dt) {
  if (gameState.status !== 'playing' || uiBlocking()) return;
  const id = gazedGhostId();
  for (const g of ghostStates) {
    if (g.t >= 0) {
      // 튀어나온 귀신: 0.08초에 확 → 0.5초 유지 → 0.4초에 사라짐
      g.t += dt;
      const op = g.t < 0.08 ? g.t / 0.08 : g.t < 0.6 ? 1 : Math.max(0, 1 - (g.t - 0.6) / 0.4);
      g.ghost.visible = op > 0;
      g.ghost.material.opacity = op;
      g.ghost.scale.setScalar(1 + Math.sin(g.t * 60) * 0.02);
      if (op <= 0 && g.t > 0.6) g.t = -1;
      continue;
    }
    if (g.done) continue;
    g.gaze = g.id === id ? g.gaze + dt : Math.max(0, g.gaze - dt);
    if (g.gaze > 2.5) {
      g.done = true;
      g.t = 0;
      ambience.scare();
      fx.kick(1);
      LIGHT_BUS.flashFlicker = 0.7;
    }
  }
}

// ---------- 메인 루프 ----------
const clock = new THREE.Clock();
let smoothDt = 1 / 60;

// ---------- 자동 화질: 느려지면 해상도를 낮추고, 여유가 생기면 다시 올림 ----------
let qTime = 0;
let qFrames = 0;
let qCooldown = 3; // 시작 직후 셰이더 준비 시간은 제외
function autoQuality(rawDt) {
  qCooldown -= rawDt;
  if (qCooldown > 0) return;
  qTime += rawDt;
  qFrames++;
  if (qTime < 1.5) return;
  const fps = qFrames / qTime;
  qTime = 0;
  qFrames = 0;
  let next = pixelRatio;
  if (fps < 48 && pixelRatio > 0.6) next = Math.max(0.6, pixelRatio - 0.15);
  else if (fps > 58 && pixelRatio < MAX_PR) next = Math.min(MAX_PR, pixelRatio + 0.1);
  if (next !== pixelRatio) {
    pixelRatio = next;
    renderer.setPixelRatio(pixelRatio);
    fx.setSize(window.innerWidth, window.innerHeight);
    qCooldown = 1;
  }
}
const tmpPos = new THREE.Vector3();
const tmpDir = new THREE.Vector3();

renderer.setAnimationLoop(() => {
  // 프레임 간격이 들쭉날쭉해도 움직임이 튀지 않게 살짝 평균을 낸다
  const rawDt = Math.min(clock.getDelta(), 0.1);
  smoothDt += (Math.min(rawDt, 0.05) - smoothDt) * 0.25;
  const dt = smoothDt;
  autoQuality(rawDt);
  const t = clock.elapsedTime;
  const playing = gameState.status === 'playing';
  const blocking = uiBlocking();
  const canMove = playing && !blocking;

  camCtl.inputEnabled = !dialog.keypadOpen;
  player.update(dt, camCtl.moveYaw, canMove, { faceBasis: camCtl.mode === 'first' });
  // 1인칭 클릭 이동 중에는 걷는 방향으로 시선을 천천히 돌림
  //  (물체로 다가가는 중이면 그 물체를 계속 바라봄 — 뒤로 물러설 때도 시선 유지)
  if (!player.autoWalking) approachLook = null;
  if (camCtl.mode === 'first' && player.autoWalking && player.moving) {
    if (approachLook) camCtl.lookAtPoint(approachLook.x, approachLook.y, approachLook.z);
    else camCtl.steerToward(player.facing, dt);
  }
  camCtl.update(dt, canMove ? player.keys : null);
  camera.updateMatrixWorld();

  // 안개: 1인칭은 짙게, 3D 시점은 옅게
  scene.fog.density = THREE.MathUtils.lerp(LIGHT_CONFIG.fogDensityFirst, LIGHT_CONFIG.fogDensityOverview, camCtl.blend);
  hemi.intensity = THREE.MathUtils.lerp(LIGHT_CONFIG.hemiIntensity, LIGHT_CONFIG.hemiIntensityOverview, camCtl.blend) + (ctx.lightning ?? 0) * 3.5; // 번개 칠 때 방이 번쩍

  // 손전등: 1인칭은 손에 든 손전등 렌즈에서 시선 방향으로, 3D 시점은 캐릭터가 바라보는 방향
  torchModel.update(dt, {
    visible: camCtl.blend < 0.3,
    walking: player.moving,
    yaw: camCtl.yaw,
    pitch: camCtl.pitch,
    level: flashlight.level,
  });
  player.getEye(tmpPos);
  if (camCtl.mode === 'first') {
    camCtl.getForward(tmpDir);
    torchModel.getLensWorld(tmpPos);
    tmpPos.addScaledVector(tmpDir, 0.05);
  } else {
    const f = player.mesh.rotation.y;
    tmpDir.set(-Math.sin(f), -0.3, -Math.cos(f)).normalize();
    tmpPos.y -= 0.3;
  }
  flashlight.update(tmpPos, tmpDir, t, dt);

  // 마우스가 가리키는 것 + 안내 문구
  interaction.update(playing && !blocking, t);
  const h = interaction.hover;
  if (h?.item && !blocking) {
    const name = gameState.getDef(h.item.id)?.name ?? '';
    const verb = interaction.isNear(h.item) ? '조사하기' : '다가가기';
    hud.setPrompt(`<b>클릭</b> ${verb} — ${name}`, mouse.x, mouse.y);
  } else hud.setPrompt(null);
  canvas.classList.toggle('pointer', !!h?.item);
  canvas.classList.toggle('grabbing', camCtl.wasDragging);

  // 월드 연출
  for (const u of ctx.updaters) u(dt, t);
  const animating = ctx.animations.length > 0;
  updateAnimations(ctx, dt);
  // 서랍·뚜껑이 다 열리고 나면 물체 위치를 다시 계산 (열린 서랍 속 열쇠도 정확히 클릭되게)
  if (animating && ctx.animations.length === 0) interaction.refreshCenters();
  updateFlames(t);
  updateGhosts(dt);
  scares.active = playing;
  scares.update(dt);
  ambience.update(dt, { walking: player.moving, timeLeft: gameState.timeLeft });

  // 방 판정 (서재 북쪽 벽 z=-5 너머는 저장고)
  gameState.setRoom(player.position.z < -5.2 ? 'cellar' : 'study');
  gameState.tick(dt);

  // 5분 이하일 때 심장 박동에 맞춰 화면이 조여옴
  if (playing && gameState.timeLeft <= 300) {
    const period = gameState.timeLeft <= 60 ? 0.6 : 0.95;
    if (t % period < dt) fx.kick(0.35);
  }
  // 움직이거나 도는 중엔 윤곽선 계산을 쉬어 프레임을 아낀다 (멈추면 바로 다시 보임)
  if (pendingClueBoard && gameState.isUnlocked(pendingClueBoard)) pendingClueBoard = null; // 이미 문을 열었으면 띄우지 않음
  if (pendingClueBoard && gameState.status === 'playing' && !uiBlocking()) {
    clueBoard.open(pendingClueBoard);
    pendingClueBoard = null;
  }
  fx.setOutlineActive(!player.moving && !camCtl.turning);
  fx.render(dt, t);
});

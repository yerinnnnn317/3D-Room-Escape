// =============================================================
// scene/helpers.js
// 방을 만들 때 공통으로 쓰는 도우미 함수 모음.
// - 박스 메시 생성, 벽(카메라 가림막) 등록, 충돌 박스 등록
// - 상호작용 물체 등록(테두리 발광 대상)
// - 문/서랍/금고 여는 간단한 트윈 애니메이션
// - 핏자국 데칼, 글씨 평면
// 방 파일(room1.js, room2.js)은 이 함수들만 조합해서 만든다.
// =============================================================
import * as THREE from 'three';
import { bloodMaterial, poolTexture, splatTexture, smearTexture, handPrintMesh } from './bloodTextures.js';

/**
 * 모든 방이 함께 쓰는 "월드 컨텍스트".
 * colliders    : 플레이어 이동을 막는 XZ 평면 사각형(AABB) 목록
 * walls        : 3인칭 카메라를 막는 메시 목록(벽, 문)
 * interactables: 조사 가능한 물체 [{ id, object, meshes }]
 * openers      : 장치가 열렸을 때 실행할 연출 함수 { [id]: () => void }
 * updaters     : 매 프레임 실행할 함수 (깜빡이는 조명 등)
 * floors       : 클릭 이동용 바닥 메시
 * cutaway      : 3D(내려다보기) 시점에서 카메라 쪽에 있으면 숨길 물체 (벽, 벽걸이 소품)
 * ceilings     : 3D 시점에서 항상 숨길 천장
 */
export function createContext(scene) {
  return {
    scene,
    colliders: [],
    walls: [],
    interactables: [],
    openers: {},
    updaters: [],
    animations: [],
    hideOnItem: {}, // { [itemId]: Object3D } 아이템을 주우면 화면에서 숨길 메시
    ghostFrames: [], // 오래 보면 귀신이 튀어나오는 액자 [{ id, ghost }]
    floors: [],
    cutaway: [],
    ceilings: [],
  };
}

/** 기본 재질 */
export function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0.05, ...opts });
}

/** 박스 메시 하나 만들기. y를 안 주면 바닥 위에 놓인다. */
export function box(ctx, { w, h, d, x = 0, y, z = 0, material, parent, collide = false, wall = false, id = null }) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y ?? h / 2, z);
  (parent ?? ctx.scene).add(mesh);
  if (wall) {
    ctx.walls.push(mesh);
    ctx.cutaway.push(mesh);
  }
  if (collide) {
    const c = addCollider(ctx, x, z, w, d, id);
    if (wall) c.wall = true; // 벽 충돌 상자 (방 크기 조절 때 같이 늘고 줄어듦)
  }
  return mesh;
}

/** 이동 충돌용 사각형 등록 (월드 좌표 기준, 회전 없는 사각형) */
export function addCollider(ctx, x, z, w, d, id = null) {
  const c = { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, enabled: true, id };
  ctx.colliders.push(c);
  return c;
}

/**
 * 조사 가능한 물체 등록.
 * 하이라이트할 때 다른 물체까지 같이 빛나지 않도록 재질을 복제한다.
 */
export function registerInteractable(ctx, id, object) {
  const meshes = [];
  object.traverse((o) => {
    if (o.isMesh) {
      o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone();
      o.userData.interactId = id;
      meshes.push(o);
    }
  });
  ctx.interactables.push({ id, object, meshes });
}

/** obj[prop][axis] 값을 duration초 동안 to로 부드럽게 변경 */
export function tween(ctx, obj, prop, axis, to, duration = 1) {
  ctx.animations.push({ obj, prop, axis, from: obj[prop][axis], to, t: 0, duration });
}

export function updateAnimations(ctx, dt) {
  for (const a of ctx.animations) {
    a.t = Math.min(1, a.t + dt / a.duration);
    const k = 1 - Math.pow(1 - a.t, 3); // ease-out
    a.obj[a.prop][a.axis] = a.from + (a.to - a.from) * k;
  }
  ctx.animations = ctx.animations.filter((a) => a.t < 1);
}

let decalOrder = 0;

/**
 * 바닥 핏자국 (사진처럼 그린 텍스처를 붙인 평면 데칼).
 * r이 크면 고인 피웅덩이, 작으면 튄 핏방울.
 */
export function bloodDecal(ctx, x, z, r = 0.4, parent) {
  const pool = r >= 0.3 || Math.random() < 0.2;
  const size = r * (pool ? 2.6 : 3.2);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), bloodMaterial(pool ? poolTexture() : splatTexture()));
  m.rotation.x = -Math.PI / 2;
  m.rotation.z = Math.random() * Math.PI * 2;
  m.position.set(x, 0.006 + (decalOrder++ % 10) * 0.0008, z);
  m.receiveShadow = true;
  (parent ?? ctx.scene).add(m);
  return m;
}

/** 바닥에 질질 끌린 핏자국. (x1,z1) → (x2,z2) 방향으로, 폭 w */
export function dragDecal(ctx, x1, z1, x2, z2, w = 0.45) {
  const len = Math.hypot(x2 - x1, z2 - z1);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(len, w), bloodMaterial(smearTexture()));
  m.rotation.x = -Math.PI / 2;
  m.rotation.z = Math.atan2(-(z2 - z1), x2 - x1); // 평면 +x를 진행 방향으로
  m.position.set((x1 + x2) / 2, 0.005 + (decalOrder++ % 10) * 0.0008, (z1 + z2) / 2);
  ctx.scene.add(m);
  return m;
}

/** 캔버스로 그린 글씨 평면 (벽 낙서 등) */
export function textPlane(lines, { width = 2, height = 1, color = '#a00d00', font = 'bold 72px serif' } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = Math.round(1024 * (height / width));
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = color;
  g.font = font;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const lh = canvas.height / (lines.length + 1);
  lines.forEach((line, i) => {
    const y = lh * (i + 1);
    g.fillText(line, canvas.width / 2, y);
    // 흘러내리는 핏줄기
    for (let k = 0; k < 6; k++) {
      const x = canvas.width * (0.2 + Math.random() * 0.6);
      g.fillRect(x, y + 20, 4 + Math.random() * 4, 20 + Math.random() * 70);
    }
  });
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    // 어두워도 읽히도록 글씨 자체가 은은하게 빛난다
    new THREE.MeshStandardMaterial({
      map: tex,
      emissive: 0xff2a1a,
      emissiveMap: tex,
      emissiveIntensity: 0.9,
      transparent: true,
      roughness: 0.4,
      depthWrite: false,
    })
  );
  return m;
}

/**
 * 벽에 붙는 핏자국. 벽 안쪽 면 위치(x,y,z)와 벽이 바라보는 방향(rotY)을 준다.
 * rotY: 0 = +z를 바라봄, Math.PI/2 = +x, -Math.PI/2 = -x, Math.PI = -z
 * hand: true면 손바닥 자국(흘러내린 핏줄기 포함), 아니면 문지른 자국
 */
export function wallDecal(ctx, x, y, z, rotY, r = 0.15, { hand = false } = {}) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  let m;
  if (hand) {
    m = handPrintMesh(r * 1.5);
    m.rotation.z = (Math.random() - 0.5) * 0.5; // 살짝 기울어진 손
  } else {
    m = new THREE.Mesh(new THREE.PlaneGeometry(r * 4, r * 1.6), bloodMaterial(smearTexture()));
    m.rotation.z = (Math.random() - 0.5) * 0.6;
  }
  m.position.z = 0.012;
  g.add(m);
  ctx.scene.add(g);
  ctx.cutaway.push(g);
  return g;
}

export { handPrintMesh };

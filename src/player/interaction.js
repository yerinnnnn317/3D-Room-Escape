// =============================================================
// player/interaction.js
// 마우스로 가리키는 물체/바닥을 찾는 담당.
// - 마우스 커서 위치에서 레이를 쏴서 처음 맞은 것을 본다 (숨겨진 벽은 통과)
//   · 조사 가능한 물체 → 그 물체 윤곽선만 빛남 (postfx.js의 OutlinePass) + 은은한 발광
//   · 핏자국처럼 투명한 부분이 있는 평면은, 실제로 그려진 부분을 가리킬 때만 선택
//   · 바닥 → 클릭하면 그 지점으로 걸어감
// - 물체가 가까우면(REACH) 바로 조사 가능, 멀면 "다가가기"
// - E 키용: 가리킨 게 없으면 앞쪽 가까운 물체를 자동 선택
// =============================================================
import * as THREE from 'three';

export const REACH = 2.4;
const NEAR = 1.6;

function isShown(o) {
  for (let p = o; p; p = p.parent) if (!p.visible) return false;
  return true;
}

/** 투명 텍스처(캔버스)가 붙은 평면이면, 맞은 지점의 실제 알파값을 확인 */
const _alphaCache = new WeakMap();
function isOpaqueAt(hit) {
  const mat = hit.object.material;
  const img = mat?.map?.image;
  if (!mat?.transparent || !hit.uv || !(img instanceof HTMLCanvasElement)) return true;
  let data = _alphaCache.get(img);
  if (!data) {
    data = img.getContext('2d').getImageData(0, 0, img.width, img.height).data;
    _alphaCache.set(img, data);
  }
  const uv = hit.uv.clone();
  mat.map.transformUv(uv);
  const x = Math.min(img.width - 1, Math.max(0, Math.floor(uv.x * img.width)));
  const y = Math.min(img.height - 1, Math.max(0, Math.floor(uv.y * img.height)));
  return data[(y * img.width + x) * 4 + 3] > 40;
}

export class Interaction {
  constructor(scene, camera, player, ctx) {
    this.camera = camera;
    this.player = player;
    this.items = ctx.interactables;
    this.floors = ctx.floors;
    this.focused = null; // 테두리를 표시할 물체
    this.hover = null; // { item?, point, isFloor }
    this.ray = new THREE.Raycaster();
    this.pointer = new THREE.Vector2(0, 0);
    this.pointerInside = false;
    this.rayTargets = [...this.items.flatMap((i) => i.meshes), ...ctx.walls, ...ctx.floors];

    const box = new THREE.Box3();
    for (const it of this.items) {
      it.center = box.setFromObject(it.object).getCenter(new THREE.Vector3());
      it.size = box.getSize(new THREE.Vector3());
      // 원래 발광색 기억 (벽 글씨처럼 원래 빛나는 재질 보호)
      for (const m of it.meshes) m.userData.baseEmissive = m.material.emissive?.getHex() ?? 0;
    }

    this.onFocusChange = null; // (item|null) => void  — 윤곽선 표시용

    this._eye = new THREE.Vector3();
  }

  setPointer(clientX, clientY, w, h) {
    this.pointer.set((clientX / w) * 2 - 1, -(clientY / h) * 2 + 1);
    this.pointerInside = true;
  }

  /** 물체까지 거리 (플레이어 기준, 수평) */
  distanceTo(item) {
    const p = this.player.position;
    return Math.hypot(item.center.x - p.x, item.center.z - p.z);
  }

  isNear(item) {
    return this.distanceTo(item) <= REACH;
  }

  /** E 키: 가리킨 물체가 가까우면 그것, 아니면 앞쪽 가장 가까운 물체 */
  pickForKey(forward) {
    if (this.hover?.item && this.isNear(this.hover.item)) return this.hover.item;
    const eye = this.player.getEye(this._eye);
    let best = NEAR;
    let found = null;
    for (const it of this.items) {
      if (!isShown(it.object)) continue;
      const dx = it.center.x - eye.x;
      const dz = it.center.z - eye.z;
      const d = Math.hypot(dx, dz);
      const facing = forward ? (dx * forward.x + dz * forward.z) / (d || 1) : 1;
      if (d < best && facing > 0.1) {
        best = d;
        found = it;
      }
    }
    return found;
  }

  /** 서랍처럼 움직인 물체의 중심 위치를 다시 계산 */
  refreshCenters() {
    const box = new THREE.Box3();
    for (const it of this.items) {
      box.setFromObject(it.object);
      if (!box.isEmpty()) {
        box.getCenter(it.center);
        box.getSize(it.size);
      }
    }
  }

  /** 나중에 불러온 메시(3D 모델 등)를 기존 조사 대상에 추가 */
  addMeshes(id, meshes) {
    const it = this.getItem(id);
    if (!it || !meshes?.length) return;
    for (const m of meshes) {
      m.userData.interactId = id;
      m.userData.baseEmissive = m.material?.emissive?.getHex?.() ?? 0;
      it.meshes.push(m);
      this.rayTargets.push(m);
    }
  }

  getItem(id) {
    return this.items.find((i) => i.id === id) ?? null;
  }

  update(enabled, t = 0) {
    // 마우스도 카메라도 그대로면 지난 결과를 그대로 씀 (매 프레임 수백 개 물체와 충돌 검사하지 않도록)
    const e = this.camera.matrixWorld.elements;
    const key = `${enabled}|${this.pointerInside}|${this.pointer.x.toFixed(4)}|${this.pointer.y.toFixed(4)}|${e[12].toFixed(3)}|${e[13].toFixed(3)}|${e[14].toFixed(3)}|${e[8].toFixed(3)}|${e[9].toFixed(3)}|${e[10].toFixed(3)}`;
    // 움직이는 중에는 2프레임에 한 번만 검사
    this._frame = (this._frame ?? 0) + 1;
    if (key === this._lastKey) return;
    if (this._lastKey && this._frame % 2 === 1) return;
    this._lastKey = key;
    this.hover = null;
    if (enabled && this.pointerInside) {
      this.ray.setFromCamera(this.pointer, this.camera);
      this.ray.far = 40;
      const hits = this.ray.intersectObjects(this.rayTargets, false);
      let blockDist = Infinity; // 처음 맞은 벽·바닥까지 거리 (그 뒤 물체는 가려진 것)
      for (const h of hits) {
        if (!isShown(h.object)) continue; // 3D 시점에서 숨긴 벽은 통과
        if (!isOpaqueAt(h)) continue; // 핏자국 평면의 투명한 부분은 통과
        const id = h.object.userData.interactId;
        if (id) this.hover = { item: this.getItem(id), point: h.point };
        else {
          blockDist = h.distance;
          if (this.floors.includes(h.object)) this.hover = { isFloor: true, point: h.point };
        }
        break;
      }
      // 작은 물건을 살짝 빗나가게 눌러도 잡히도록: 화면에서 커서 가까이(약 40px) 있는 물체를 고른다
      if (!this.hover?.item) {
        const near = this._nearestOnScreen(blockDist);
        if (near) this.hover = { item: near, point: near.center };
      }
    }
    const item = this.hover?.item ?? null;
    if (item !== this.focused) this.setFocus(item);

  }

  _nearestOnScreen(blockDist) {
    const w = window.innerWidth / 2;
    const h = window.innerHeight / 2;
    const camPos = this.camera.getWorldPosition(this._camPos ?? (this._camPos = new THREE.Vector3()));
    const v = this._proj ?? (this._proj = new THREE.Vector3());
    let best = 40;
    let found = null;
    for (const it of this.items) {
      if (!isShown(it.object)) continue;
      v.copy(it.center).project(this.camera);
      if (v.z > 1 || v.z < -1) continue; // 카메라 뒤
      const px = Math.hypot((v.x - this.pointer.x) * w, (v.y - this.pointer.y) * h);
      if (px >= best) continue;
      // 벽 너머(가려진) 물체는 제외
      const r = Math.max(it.size?.x ?? 0.5, it.size?.y ?? 0.5, it.size?.z ?? 0.5) / 2;
      if (camPos.distanceTo(it.center) - r > blockDist + 0.15) continue;
      best = px;
      found = it;
    }
    return found;
  }

  setFocus(item) {
    if (this.focused) for (const m of this.focused.meshes) m.material.emissive?.setHex(m.userData.baseEmissive);
    this.focused = item;
    if (item) {
      for (const m of item.meshes) if (!m.userData.baseEmissive) m.material.emissive?.setHex(0x2a1806);
    }
    this.onFocusChange?.(item);
  }
}

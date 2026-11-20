// =============================================================
// player/player.js
// 플레이어 캐릭터(캡슐 모양)와 이동 담당.
// - 클릭 이동: walkTo(점) 하면 그 지점까지 천천히 걸어간다.
//   방이 다르면 서재 문을 거쳐 가고, 막혀서 못 가면 알아서 멈춘다.
// - 키보드 이동: WASD 또는 ↑↓ (↑↓ = 앞/뒤), Shift 달리기
//   (←→ 회전은 cameraController가 담당)
// - 물리 엔진 없이 "원(플레이어) vs 사각형(충돌체)" 밀어내기로 벽 통과 방지
// =============================================================
import * as THREE from 'three';

export const PLAYER_CONFIG = {
  radius: 0.3,
  height: 1.7,
  eyeHeight: 1.55,
  walkSpeed: 2.3, // 천천히 걷는 공포 게임 속도
  runSpeed: 3.8,
  clickSpeed: 2.4,
  accel: 9, // 출발할 때 속도가 붙는 빠르기 (클수록 즉각적)
  decel: 11, // 멈출 때 미끄러지듯 서는 빠르기
};

// 서재 ↔ 저장고 경계(북쪽 문)
import { floorHeightAt, STAIRS } from '../scene/room2.js';
// 서재 문과 계단: 다른 방으로 걸어갈 땐 문 앞 → 계단 위 → 계단 아래를 거쳐 간다
const DOOR = { x: 0, zLine: -5.1, zStudy: -4.4, zCellar: STAIRS.zEnd - 0.4 };

export class Player {
  constructor(scene, colliders, spawn) {
    this.colliders = colliders;
    this.position = new THREE.Vector3(spawn.x, 0, spawn.z);
    this.keys = new Set();
    this.facing = 0;
    this.moving = false;
    this.path = []; // 클릭 이동 경유점 [{x, z, stop}]
    this.onArrive = null;
    this._stuckT = 0;
    this._lastPos = new THREE.Vector3();
    this.vel = new THREE.Vector2(); // 현재 이동 속도 (가속·감속으로 부드럽게)
    this.speed = 0;

    const C = PLAYER_CONFIG;
    this.mesh = new THREE.Group();
    const capsule = new THREE.Mesh(
      new THREE.CapsuleGeometry(C.radius, C.height - C.radius * 2, 6, 16),
      new THREE.MeshStandardMaterial({ color: 0x3a4250, roughness: 0.7 })
    );
    capsule.position.y = C.height / 2;
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.07, 0.1),
      new THREE.MeshStandardMaterial({ color: 0xbfd0e0, emissive: 0x4a6080 })
    );
    visor.position.set(0, 1.45, -0.26);
    this.mesh.add(capsule, visor);
    scene.add(this.mesh);

    // 클릭 목적지 표시 링
    this.marker = new THREE.Mesh(
      new THREE.RingGeometry(0.15, 0.22, 24),
      new THREE.MeshBasicMaterial({ color: 0xff5040, transparent: true, opacity: 0.8, depthWrite: false })
    );
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.visible = false;
    scene.add(this.marker);

    window.addEventListener('keydown', (e) => this.keys.add(e.code));
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  getEye(out = new THREE.Vector3()) {
    return out.set(this.position.x, this.position.y + PLAYER_CONFIG.eyeHeight, this.position.z);
  }

  get roomSide() {
    return this.position.z < DOOR.zLine ? 'cellar' : 'study';
  }

  /**
   * (x, z)로 걸어가기. stop = 목표에서 이만큼 떨어지면 도착으로 본다.
   * doorOpen = 서재 문이 열렸는지 (닫혀 있으면 다른 방으로 못 감)
   * @returns {boolean} 출발했는지
   */
  walkTo(x, z, { stop = 0.15, doorOpen = false, onArrive = null } = {}) {
    const targetSide = z < DOOR.zLine ? 'cellar' : 'study';
    const path = [];
    if (targetSide !== this.roomSide) {
      if (!doorOpen) return false;
      const near = this.roomSide === 'study' ? DOOR.zStudy : DOOR.zCellar;
      const far = this.roomSide === 'study' ? DOOR.zCellar : DOOR.zStudy;
      const top = { x: DOOR.x, z: STAIRS.zTop + 0.1, stop: 0.2 };
      const bottom = { x: DOOR.x, z: STAIRS.zBottom - 0.1, stop: 0.2 };
      const mid = this.roomSide === 'study' ? [top, bottom] : [bottom, top];
      path.push({ x: DOOR.x, z: near, stop: 0.2 }, ...mid, { x: DOOR.x, z: far, stop: 0.2 });
    }
    path.push({ x, z, stop });
    this.path = path;
    this.onArrive = onArrive;
    this._stuckT = 0;
    this.marker.position.set(x, floorHeightAt(x, z) + 0.02, z);
    this.marker.visible = stop < 0.5;
    return true;
  }

  cancelWalk() {
    if (this.path.length) this.vel.multiplyScalar(0.5);
    this.path = [];
    this.onArrive = null;
    this.marker.visible = false;
  }

  get autoWalking() {
    return this.path.length > 0;
  }

  /**
   * @param basisYaw 키보드 이동 기준 방향 (1인칭 = 시선, 3D 시점 = 카메라 방향)
   */
  update(dt, basisYaw, canMove, { faceBasis = false } = {}) {
    let f = 0;
    let s = 0;
    if (canMove) {
      if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) f += 1;
      if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) f -= 1;
      if (this.keys.has('KeyD')) s += 1;
      if (this.keys.has('KeyA')) s -= 1;
    }
    const run = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    // 1) 원하는 속도(desired) 구하기
    let wx = 0;
    let wz = 0;
    let maxStep = Infinity; // 클릭 이동: 목표를 지나치지 않도록
    if (f || s) {
      this.cancelWalk(); // 키보드를 누르면 클릭 이동 취소
      const len = Math.hypot(f, s);
      const speed = run ? PLAYER_CONFIG.runSpeed : PLAYER_CONFIG.walkSpeed;
      const sin = Math.sin(basisYaw);
      const cos = Math.cos(basisYaw);
      wx = ((-sin * f + cos * s) / len) * speed;
      wz = ((-cos * f - sin * s) / len) * speed;
    } else if (canMove && this.path.length) {
      const wp = this.path[0];
      const vx = wp.x - this.position.x;
      const vz = wp.z - this.position.z;
      const dist = Math.hypot(vx, vz);
      if (dist <= wp.stop) {
        this.path.shift();
        if (!this.path.length) this._arrive();
      } else {
        // 도착 직전엔 살짝 감속
        const speed = (run ? PLAYER_CONFIG.runSpeed : PLAYER_CONFIG.clickSpeed) * Math.min(1, 0.3 + dist / 1.0);
        wx = (vx / dist) * speed;
        wz = (vz / dist) * speed;
        maxStep = dist - wp.stop + 0.01;
      }
    }
    // 2) 현재 속도를 원하는 속도 쪽으로 부드럽게 (가속/감속)
    const k = wx || wz ? PLAYER_CONFIG.accel : PLAYER_CONFIG.decel;
    const a = 1 - Math.exp(-k * dt);
    this.vel.x += (wx - this.vel.x) * a;
    this.vel.y += (wz - this.vel.y) * a;
    if (!wx && !wz && this.vel.lengthSq() < 0.0004) this.vel.set(0, 0);
    let dx = this.vel.x * dt;
    let dz = this.vel.y * dt;
    const stepLen = Math.hypot(dx, dz);
    if (stepLen > maxStep) {
      dx *= maxStep / stepLen;
      dz *= maxStep / stepLen;
    }
    this.speed = this.vel.length();

    this.moving = dx !== 0 || dz !== 0;
    if (this.moving) {
      this._lastPos.copy(this.position);
      this.position.x += dx;
      this.position.z += dz;
      this.resolveCollisions();
      this.position.y = floorHeightAt(this.position.x, this.position.z); // 계단을 오르내림
      this.facing = Math.atan2(-dx, -dz);
      // 클릭 이동 중 막혀서 거의 못 움직이면 포기
      if (this.path.length) {
        const progressed = this._lastPos.distanceTo(this.position);
        this._stuckT = progressed < Math.hypot(dx, dz) * 0.25 ? this._stuckT + dt : 0;
        if (this._stuckT > 0.5) this._arrive();
      }
    }
    if (faceBasis && !this.moving) this.facing = basisYaw;

    let diff = this.facing - this.mesh.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.mesh.rotation.y += diff * Math.min(1, dt * 8);
    this.mesh.position.set(this.position.x, 0, this.position.z);
    if (this.marker.visible) this.marker.material.opacity = 0.5 + 0.3 * Math.sin(performance.now() / 150);
  }

  _arrive() {
    const cb = this.onArrive;
    this.cancelWalk();
    cb?.();
  }

  /** 원(반지름 r) vs 축 정렬 사각형 충돌 해소. 벽을 따라 미끄러지듯 움직인다. */
  resolveCollisions() {
    const r = PLAYER_CONFIG.radius;
    const p = this.position;
    for (let iter = 0; iter < 3; iter++) {
      let pushed = false;
      for (const c of this.colliders) {
        if (!c.enabled) continue;
        const cx = Math.max(c.minX, Math.min(p.x, c.maxX));
        const cz = Math.max(c.minZ, Math.min(p.z, c.maxZ));
        const ddx = p.x - cx;
        const ddz = p.z - cz;
        const d2 = ddx * ddx + ddz * ddz;
        if (d2 >= r * r) continue;
        pushed = true;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          p.x += (ddx / d) * (r - d);
          p.z += (ddz / d) * (r - d);
        } else {
          const opts = [
            [c.minX - r - p.x, 0],
            [c.maxX + r - p.x, 0],
            [0, c.minZ - r - p.z],
            [0, c.maxZ + r - p.z],
          ];
          opts.sort((a, b) => Math.abs(a[0] + a[1]) - Math.abs(b[0] + b[1]));
          p.x += opts[0][0];
          p.z += opts[0][1];
        }
      }
      if (!pushed) break;
    }
  }
}

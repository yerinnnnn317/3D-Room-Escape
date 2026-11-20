// =============================================================
// player/cameraController.js
// 카메라 시점 담당. 두 가지 시점이 있다.
//   'first'    : 1인칭. 플레이어 눈높이에서 본다.
//   'overview' : 3D 시점. 방을 위에서 비스듬히 내려다보는 "미니어처 방" 시점.
//                카메라 쪽 벽·천장은 자동으로 숨겨서 방 안이 들여다보인다.
// 조작 (포인터 락 없음, 마우스 커서가 그대로 보임)
//   - 좌클릭 드래그 : 시선 회전(1인칭) / 방 주위로 돌기(3D)
//   - ← → 방향키    : 좌우로 돌기
//   - 마우스 휠      : 3D 시점 확대·축소
// 모든 회전은 목표값(target)을 향해 천천히 따라가서 화면이 확확 움직이지 않는다.
// V 키로 전환하면 위치·방향이 부드럽게 보간된다.
// =============================================================
import * as THREE from 'three';

export const CAMERA_CONFIG = {
  dragSensitivity: 0.0062,
  keyTurnSpeed: 2.5, // rad/s (최고 속도)
  keyTurnAccel: 12, // 방향키 회전이 붙고 풀리는 빠르기
  damping: 10, // 자동 시선 이동(물체 바라보기)이 따라가는 빠르기
  dampingDirect: 24, // 마우스 드래그·방향키로 직접 돌릴 때 (클수록 손에 딱 붙음)
  headBob: 0.028, // 걸을 때 머리가 위아래로 흔들리는 정도 (m)
  pitchLimit: 1.2,
  transitionSpeed: 5,
  overviewPitch: 0.95, // 내려다보는 각도 (rad)
  overviewMinPitch: 0.45,
  overviewMaxPitch: 1.4,
  overviewDist: 12,
  overviewMinDist: 6,
  overviewMaxDist: 20,
  cutawayThreshold: 2.2, // 방 중심에서 카메라 쪽으로 이 거리보다 먼 벽은 숨김
};

const damp = (cur, target, k, dt) => cur + (target - cur) * (1 - Math.exp(-k * dt));

export class CameraController {
  constructor(camera, player, domElement, ctx) {
    this.camera = camera;
    this.player = player;
    this.dom = domElement;
    this.ctx = ctx;

    // 1인칭 시선
    this.yaw = 0;
    this.pitch = -0.08;
    this.yawT = this.yaw;
    this.pitchT = this.pitch;
    // 3D 시점 궤도
    this.orbitYaw = 0;
    this.orbitPitch = CAMERA_CONFIG.overviewPitch;
    this.orbitDist = CAMERA_CONFIG.overviewDist;
    this.orbitYawT = 0;
    this.orbitPitchT = this.orbitPitch;
    this.orbitDistT = this.orbitDist;
    this.center = new THREE.Vector3(0, 0, 0);
    this.centerT = new THREE.Vector3(0, 0, 0);

    this.turnVel = 0; // 방향키 회전 속도 (가속·감속)
    this.bobPhase = 0;
    this.bobAmt = 0;
    this.mode = 'first';
    this.blend = 0; // 0 = 1인칭, 1 = 3D
    this.inputEnabled = true;

    this._fpPos = new THREE.Vector3();
    this._fpQuat = new THREE.Quaternion();
    this._ovPos = new THREE.Vector3();
    this._ovQuat = new THREE.Quaternion();
    this._euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this._m = new THREE.Matrix4();
    this._up = new THREE.Vector3(0, 1, 0);
    this._tmp = new THREE.Vector3();

    // 3D 시점에서 숨길 물체들의 중심점 미리 계산
    const box = new THREE.Box3();
    this.cutaway = ctx.cutaway.map((obj) => ({ obj, c: box.setFromObject(obj).getCenter(new THREE.Vector3()) }));

    this._bindInput();
  }

  _bindInput() {
    const C = CAMERA_CONFIG;
    let down = null;
    this.dragging = false;
    this.dom.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || !this.inputEnabled) return;
      down = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY };
      this.dragging = false;
    });
    window.addEventListener('pointermove', (e) => {
      if (!down) return;
      if (!this.dragging && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) this.dragging = true;
      if (!this.dragging) return;
      const dx = e.clientX - down.lx;
      const dy = e.clientY - down.ly;
      down.lx = e.clientX;
      down.ly = e.clientY;
      if (this.mode === 'first') {
        this.yawT += dx * C.dragSensitivity;
        this.pitchT = THREE.MathUtils.clamp(this.pitchT + dy * C.dragSensitivity, -C.pitchLimit, C.pitchLimit);
      } else {
        this.orbitYawT -= dx * C.dragSensitivity * 1.3;
        this.orbitPitchT = THREE.MathUtils.clamp(this.orbitPitchT + dy * C.dragSensitivity, C.overviewMinPitch, C.overviewMaxPitch);
      }
    });
    window.addEventListener('pointerup', () => {
      down = null;
      // dragging 값은 click 판정이 끝난 다음 프레임에 초기화
      setTimeout(() => (this.dragging = false), 0);
    });
    this.dom.addEventListener(
      'wheel',
      (e) => {
        if (this.mode !== 'overview') return;
        e.preventDefault();
        this.orbitDistT = THREE.MathUtils.clamp(this.orbitDistT + e.deltaY * 0.01, C.overviewMinDist, C.overviewMaxDist);
      },
      { passive: false }
    );
  }

  /** 드래그 직후의 클릭은 무시하기 위해 main.js가 확인 */
  get wasDragging() {
    return this.dragging;
  }

  toggleMode() {
    this.mode = this.mode === 'first' ? 'overview' : 'first';
    if (this.mode === 'overview') {
      // 지금 바라보는 방향 뒤쪽에서 내려다보도록
      this.orbitYawT = this.orbitYaw = this.yaw;
    } else {
      this.yawT = this.yaw = this.orbitYaw;
      this.pitchT = this.pitch = -0.08;
    }
    return this.mode;
  }

  /** 키보드 이동 기준 방향 */
  get moveYaw() {
    return this.mode === 'first' ? this.yaw : this.orbitYaw;
  }

  /** 1인칭 시선 방향 */
  getForward(out = new THREE.Vector3()) {
    this._euler.set(this.pitch, this.yaw, 0);
    return out.set(0, 0, -1).applyEuler(this._euler);
  }

  /** (x, y, z)를 부드럽게 바라보도록 목표 회전 설정 (1인칭) */
  lookAtPoint(x, y, z) {
    const eye = this.player.getEye(this._tmp);
    const dx = x - eye.x;
    const dz = z - eye.z;
    const desired = Math.atan2(-dx, -dz);
    this.yawT = this.yaw + Math.atan2(Math.sin(desired - this.yaw), Math.cos(desired - this.yaw));
    this.pitchT = THREE.MathUtils.clamp(Math.atan2(y - eye.y, Math.hypot(dx, dz)), -0.9, 0.6);
  }

  /** 걷는 방향으로 시선을 천천히 돌림 (1인칭 클릭 이동용) */
  steerToward(yawDir, dt) {
    const diff = Math.atan2(Math.sin(yawDir - this.yawT), Math.cos(yawDir - this.yawT));
    this.yawT += diff * Math.min(1, dt * 2.2);
    this.pitchT = damp(this.pitchT, -0.08, 2, dt);
  }

  /** 3D 시점이 바라볼 방 중심 */
  setRoomCenter(x, z) {
    this.centerT.set(x, 0, z);
  }

  update(dt, keys) {
    const C = CAMERA_CONFIG;

    // ← → 회전
    if (this.inputEnabled && keys) {
      let turn = 0;
      if (keys.has('ArrowLeft')) turn += 1;
      if (keys.has('ArrowRight')) turn -= 1;
      this.turnVel += (turn * C.keyTurnSpeed - this.turnVel) * (1 - Math.exp(-C.keyTurnAccel * dt));
    } else {
      this.turnVel *= Math.exp(-12 * dt);
    }
    // 화면이 아직 목표 방향으로 돌아가는 중인지 (윤곽선 계산을 쉬는 데 사용)
    this.turning = Math.abs(this.turnVel) > 0.02 || Math.abs(this.yawT - this.yaw) > 0.003 || Math.abs(this.pitchT - this.pitch) > 0.003;
    if (Math.abs(this.turnVel) > 1e-4) {
      if (this.mode === 'first') this.yawT += this.turnVel * dt;
      else this.orbitYawT += this.turnVel * dt;
    }

    // 목표값을 따라감: 마우스로 끌거나 방향키로 돌릴 땐 손에 바로 붙게(빠르게),
    //                  자동으로 물체를 바라볼 땐 부드럽게(천천히)
    const k = this.dragging || Math.abs(this.turnVel) > 0.05 ? C.dampingDirect : C.damping;
    this.yaw = damp(this.yaw, this.yawT, k, dt);
    this.pitch = damp(this.pitch, this.pitchT, k, dt);
    this.orbitYaw = damp(this.orbitYaw, this.orbitYawT, C.damping * 0.8, dt);
    this.orbitPitch = damp(this.orbitPitch, this.orbitPitchT, C.damping * 0.7, dt);
    this.orbitDist = damp(this.orbitDist, this.orbitDistT, C.damping * 0.7, dt);
    this.center.lerp(this.centerT, 1 - Math.exp(-3 * dt));

    const target = this.mode === 'overview' ? 1 : 0;
    this.blend = damp(this.blend, target, C.transitionSpeed, dt);
    if (Math.abs(target - this.blend) < 0.002) this.blend = target;

    // 1인칭 자세
    this.player.getEye(this._fpPos);
    // 걸을 때 머리 흔들림 (속도에 비례, 멈추면 천천히 가라앉음)
    const spd = this.player.speed ?? 0;
    this.bobAmt = damp(this.bobAmt, Math.min(1, spd / 2.3), 6, dt);
    this.bobPhase += dt * (4.2 + spd * 1.6);
    this._fpPos.y += Math.sin(this.bobPhase * 2) * C.headBob * this.bobAmt;
    const roll = Math.sin(this.bobPhase) * 0.006 * this.bobAmt;
    this._euler.set(this.pitch, this.yaw, roll);
    this._fpQuat.setFromEuler(this._euler);

    // 3D 시점 자세: 방 중심과 플레이어 사이를 살짝 따라감
    const focus = this._tmp.copy(this.center).lerp(this.player.position, 0.35);
    focus.y = 0.6 + this.player.position.y * 0.8; // 지하에선 초점도 내려감
    const cp = Math.cos(this.orbitPitch);
    this._ovPos.set(
      focus.x + Math.sin(this.orbitYaw) * cp * this.orbitDist,
      focus.y + Math.sin(this.orbitPitch) * this.orbitDist,
      focus.z + Math.cos(this.orbitYaw) * cp * this.orbitDist
    );
    this._m.lookAt(this._ovPos, focus, this._up);
    this._ovQuat.setFromRotationMatrix(this._m);

    // 보간 (부드러운 전환)
    const b = this.blend * this.blend * (3 - 2 * this.blend); // smoothstep
    this.camera.position.lerpVectors(this._fpPos, this._ovPos, b);
    this.camera.quaternion.slerpQuaternions(this._fpQuat, this._ovQuat, b);

    this.player.mesh.visible = this.blend > 0.25;
    this._applyCutaway(b > 0.4);
  }

  /** 3D 시점: 카메라 쪽 벽/벽걸이 소품, 천장 숨기기 */
  _applyCutaway(on) {
    for (const c of this.ctx.ceilings) c.visible = !on;
    if (!on) {
      for (const it of this.cutaway) it.obj.visible = true;
      return;
    }
    const dirX = Math.sin(this.orbitYaw);
    const dirZ = Math.cos(this.orbitYaw);
    for (const it of this.cutaway) {
      const proj = (it.c.x - this.center.x) * dirX + (it.c.z - this.center.z) * dirZ;
      it.obj.visible = proj < CAMERA_CONFIG.cutawayThreshold;
    }
  }
}

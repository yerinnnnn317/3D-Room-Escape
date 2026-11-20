// =============================================================
// player/flashlightModel.js
// 1인칭일 때 화면 오른쪽 아래에 보이는 손전등.
// - 꼬리(스위치)가 내 쪽, 불빛이 나오는 머리가 앞쪽을 향함
// - 금속 몸통 + 고무 손잡이 + 넓은 머리 + 빛나는 렌즈
// - 렌즈 앞에서 뻗어 나가는 희미한 빛줄기 (어디를 비추는지 보이게)
// - 렌즈·빛줄기 밝기 = 실제 손전등 밝기 (깜빡이면 같이 깜빡임)
// - 걸을 때 위아래로 흔들리고, 시선을 돌리면 한 박자 늦게 따라온다
// 카메라의 자식으로 붙이기 때문에 카메라와 함께 움직인다.
// =============================================================
import * as THREE from 'three';

/** 빛줄기용 세로 그라데이션 (렌즈 쪽 진하고 멀수록 사라짐) */
function beamTexture() {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 128);
  gr.addColorStop(0, 'rgba(255,240,215,0)');
  gr.addColorStop(0.75, 'rgba(255,240,215,0.35)');
  gr.addColorStop(1, 'rgba(255,240,215,0.9)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 4, 128);
  return new THREE.CanvasTexture(c);
}

export function createFlashlightModel(camera) {
  const root = new THREE.Group();
  root.position.set(0.16, -0.15, -0.38);
  camera.add(root);

  const metal = new THREE.MeshStandardMaterial({ color: 0x3a3a40, metalness: 0.85, roughness: 0.3 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xb8b8c0, metalness: 1, roughness: 0.18 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x111113, roughness: 0.85 });

  // 손전등 본체: 로컬 -z가 앞(불빛 방향). 화면 가운데 쪽으로 비스듬히
  const torch = new THREE.Group();
  torch.rotation.set(0.06, 0.22, 0);
  root.add(torch);

  // 몸통 (꼬리 z=+0.2 → 머리 z=-0.05) — LatheGeometry는 y축 기준이라 x축으로 눕힘
  const prof = [
    [0, -0.2], [0.017, -0.2], [0.02, -0.19], [0.02, -0.04], [0.024, -0.02],
    [0.034, 0.02], [0.036, 0.05], [0.033, 0.055], [0, 0.055],
  ];
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof.map(([a, b]) => new THREE.Vector2(a, b)), 32), metal);
  body.rotation.x = -Math.PI / 2; // +y → -z (머리가 앞으로)
  torch.add(body);
  // 고무 손잡이 띠
  for (let i = 0; i < 5; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0205, 0.0028, 8, 24), rubber);
    ring.position.z = 0.06 + i * 0.022;
    torch.add(ring);
  }
  // 꼬리 스위치 + 머리 쪽 크롬 테두리
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.012, 16), rubber);
  tail.rotation.x = Math.PI / 2;
  tail.position.z = 0.203;
  torch.add(tail);
  const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.004, 10, 32), chrome);
  bezel.position.z = -0.055;
  torch.add(bezel);
  // 옆면 버튼
  const button = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.005, 0.016), rubber);
  button.position.set(0, 0.021, 0.0);
  torch.add(button);

  // 렌즈 (앞을 향해 빛남)
  const lensMat = new THREE.MeshBasicMaterial({ color: 0xfff2d8 });
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.031, 32), lensMat);
  lens.position.z = -0.056;
  lens.rotation.y = Math.PI; // 앞(-z)을 바라봄
  torch.add(lens);

  // 렌즈에서 앞으로 퍼지는 희미한 빛줄기
  const beamLen = 2.2;
  const beamGeo = new THREE.CylinderGeometry(0.03, 0.5, beamLen, 24, 1, true);
  beamGeo.translate(0, -beamLen / 2, 0);
  const beamMat = new THREE.MeshBasicMaterial({
    map: beamTexture(),
    transparent: true,
    opacity: 0.04,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
  });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.rotation.x = -Math.PI / 2; // 아래(-y)로 뻗던 원뿔을 앞(-z)으로
  beam.position.z = -0.056;
  torch.add(beam);

  // 손전등 몸통을 은은하게 비추는 반사광 (어둠 속에서도 형태가 보이게)

  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = false;
      o.renderOrder = 5;
    }
  });

  let bobT = 0;
  let lagYaw = 0;
  let lagPitch = 0;
  let lastYaw = null;
  let lastPitch = null;
  const base = root.position.clone();

  return {
    root,
    /** 렌즈의 월드 위치 (실제 SpotLight를 여기서 쏜다) */
    getLensWorld(out = new THREE.Vector3()) {
      return lens.getWorldPosition(out);
    },
    update(dt, { visible, walking, yaw, pitch, level }) {
      root.visible = visible;
      if (!visible) return;
      bobT += dt * (walking ? 8 : 1.6);
      const amp = walking ? 1 : 0.3;
      if (lastYaw !== null) {
        lagYaw = THREE.MathUtils.clamp(lagYaw + (yaw - lastYaw) * 0.6, -0.08, 0.08);
        lagPitch = THREE.MathUtils.clamp(lagPitch + (pitch - lastPitch) * 0.6, -0.06, 0.06);
      }
      lastYaw = yaw;
      lastPitch = pitch;
      lagYaw *= Math.exp(-8 * dt);
      lagPitch *= Math.exp(-8 * dt);
      root.position.set(
        base.x + Math.sin(bobT) * 0.008 * amp + lagYaw * 0.4,
        base.y + Math.abs(Math.cos(bobT)) * 0.01 * amp - lagPitch * 0.3,
        base.z
      );
      root.rotation.set(lagPitch * 0.8, lagYaw, 0);
      const l = Math.max(0.04, level);
      lensMat.color.setRGB(1.0 * l + 0.05, 0.95 * l + 0.04, 0.85 * l + 0.03);
      beamMat.opacity = 0.04 * level; // 방이 밝아져서 빛줄기는 아주 옅게
    },
  };
}

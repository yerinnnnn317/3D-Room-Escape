// =============================================================
// scene/lighting.js
// 공포 분위기 조명 담당. (붉은 톤, 물체와 글씨는 잘 보이는 밝기)
// - 검붉은 배경 + 안개(FogExp2) + 붉은 기가 도는 환경광
// - 플레이어 손전등(SpotLight, F 키로 켜고 끄기)
// - 흔들리며 깜빡이는 천장 전구(PointLight)
// - 숨 쉬듯 밝아졌다 어두워지는 붉은 조명
// - 정전 연출: LIGHT_BUS.blackout(초) 값을 주면 전구들이 잠깐 꺼진다
// 밝기는 맨 위 LIGHT_CONFIG 값만 바꾸면 된다.
// =============================================================
import * as THREE from 'three';

export const LIGHT_CONFIG = {
  // 어두운 방이지만 조명은 제대로 켜져 있는 밝기 (너무 밝지도, 아주 어둡지도 않게)
  background: 0x1a0c0a,
  fogColor: 0x1c0d0b,
  fogDensityFirst: 0.012, // 1인칭: 방 끝까지 보이되 살짝 뿌옇게
  fogDensityOverview: 0.004, // 3D 시점: 방 전체가 보이게 옅게
  hemiSky: 0x8e6a5e, // 따뜻한 실내 조명빛 (붉은 기는 조금만)
  hemiGround: 0x2e1812,
  hemiIntensity: 2.9, // 1인칭 기본 밝기
  hemiIntensityOverview: 4.6, // 3D 시점에서는 조금 더 밝게
  flashlightColor: 0xffe6cc,
  flashlightIntensity: 14, // 방에 불이 켜져 있으니 손전등은 보조 정도로
  flashlightDistance: 16,
  flashlightAngle: Math.PI / 6,
  bulbColor: 0xffb070,
  bulbIntensity: 24,
  redIntensity: 5,
  exposure: 1.5,
};

/** 다른 모듈이 조명을 흔들 때 쓰는 공용 값 */
export const LIGHT_BUS = {
  blackout: 0, // >0 이면 모든 전구가 잠깐 꺼짐 (초)
  bulbs: [], // 천장 전구들 { out: 남은 정전 시간, room } — 한 개만 10초 꺼지는 연출용
  flashFlicker: 0, // >0 이면 손전등이 지직거림 (초)
};

/** 배경, 안개, 환경광 */
export function setupAtmosphere(scene) {
  const C = LIGHT_CONFIG;
  scene.background = new THREE.Color(C.background);
  scene.fog = new THREE.FogExp2(C.fogColor, C.fogDensityFirst);
  const hemi = new THREE.HemisphereLight(C.hemiSky, C.hemiGround, C.hemiIntensity);
  scene.add(hemi);
  return hemi;
}

/** 플레이어 손전등. update(위치, 방향, 시간)를 매 프레임 호출 */
export function createFlashlight(scene) {
  const C = LIGHT_CONFIG;
  const light = new THREE.SpotLight(C.flashlightColor, C.flashlightIntensity, C.flashlightDistance, C.flashlightAngle, 0.55, 2);
  light.castShadow = true;
  light.shadow.mapSize.set(512, 512);
  light.shadow.camera.near = 0.1;
  light.shadow.bias = -0.0005;
  const target = new THREE.Object3D();
  scene.add(light, target);
  light.target = target;

  let on = true;
  let nextFlicker = 20 + Math.random() * 25;
  let level = 1;
  return {
    light,
    /** 현재 밝기 0~1 (손전등 모델의 렌즈 밝기에 사용) */
    get level() {
      return on ? level : 0;
    },
    get on() {
      return on;
    },
    toggle() {
      on = !on;
      return on;
    },
    update(pos, dir, t, dt = 0.016) {
      light.position.copy(pos);
      target.position.copy(pos).addScaledVector(dir, 6);
      // 가끔 접촉 불량처럼 지직거림
      nextFlicker -= dt;
      if (nextFlicker <= 0) {
        LIGHT_BUS.flashFlicker = 0.6 + Math.random() * 1.2;
        nextFlicker = 25 + Math.random() * 35;
      }
      if (LIGHT_BUS.flashFlicker > 0) {
        LIGHT_BUS.flashFlicker -= dt;
        level = Math.random() < 0.45 ? 0.05 : 0.4 + Math.random() * 0.6;
      } else {
        level = 0.95 + 0.05 * Math.sin(t * 13) * Math.sin(t * 7.3);
      }
      light.intensity = on ? C.flashlightIntensity * level : 0;
    },
  };
}

/**
 * 천장에 매달려 흔들리며 깜빡이는 전구.
 * 전선 꼭대기를 축으로 진자처럼 흔들려서 그림자가 천천히 움직인다.
 */
export function createFlickerLight(scene, pos, { cordLength = 0.5 } = {}) {
  const C = LIGHT_CONFIG;
  const pivot = new THREE.Group();
  pivot.position.set(pos.x, pos.y + cordLength, pos.z); // 천장 고정점
  scene.add(pivot);

  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, cordLength, 6), new THREE.MeshStandardMaterial({ color: 0x111111 }));
  cord.position.y = -cordLength / 2;
  const shade = new THREE.Mesh(
    new THREE.ConeGeometry(0.18, 0.14, 16, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x2a1a14, side: THREE.DoubleSide, metalness: 0.4 })
  );
  shade.position.y = -cordLength + 0.02;
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0xffe2a8, emissive: C.bulbColor, emissiveIntensity: 2.5 });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12), bulbMat);
  bulb.position.y = -cordLength - 0.03;
  const light = new THREE.PointLight(C.bulbColor, C.bulbIntensity, 11, 2);
  light.position.y = -cordLength - 0.08;
  pivot.add(cord, shade, bulb, light);

  const rand = (a, b) => a + Math.random() * (b - a);
  let nextEvent = rand(2, 5);
  let offTime = 0;
  let t = Math.random() * 10;
  const state = { out: 0, room: pos.z < -5.1 ? 'cellar' : 'study' };
  LIGHT_BUS.bulbs.push(state);

  return function update(dt) {
    t += dt;
    // 진자 흔들림
    pivot.rotation.z = Math.sin(t * 1.1) * 0.12;
    pivot.rotation.x = Math.sin(t * 0.7 + 1) * 0.06;

    let level;
    if (state.out > 0) {
      // 약 10초 정전: 처음과 끝에 지직거리고, 가운데는 완전히 꺼짐
      state.out -= dt;
      const edge = state.out > 9.2 || state.out < 0.8;
      level = edge && Math.random() < 0.35 ? 0.6 : 0;
    } else if (LIGHT_BUS.blackout > 0) {
      level = Math.random() < 0.05 ? 0.4 : 0;
    } else if (offTime > 0) {
      offTime -= dt;
      level = Math.random() < 0.2 ? 0.5 : 0.08;
    } else {
      nextEvent -= dt;
      if (nextEvent <= 0) {
        offTime = rand(0.08, 0.5);
        nextEvent = rand(2, 7);
      }
      level = 0.85 + Math.random() * 0.15;
    }
    light.intensity = C.bulbIntensity * level;
    bulbMat.emissiveIntensity = 2.5 * level;
  };
}

/** 붉은 조명 포인트. 천천히 숨 쉬듯 밝아졌다 어두워진다 */
export function createRedLight(scene, pos, intensity = LIGHT_CONFIG.redIntensity, distance = 10) {
  const light = new THREE.PointLight(0xff2414, intensity, distance, 2);
  light.position.copy(pos);
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 10, 10),
    new THREE.MeshStandardMaterial({ color: 0xff2010, emissive: 0xff1000, emissiveIntensity: 3 })
  );
  bulb.position.copy(pos);
  scene.add(light, bulb);
  let t = Math.random() * 10;
  return function update(dt) {
    t += dt;
    const dim = LIGHT_BUS.blackout > 0 ? 0.35 : 1;
    light.intensity = intensity * (0.7 + 0.3 * Math.sin(t * 1.6)) * dim;
  };
}

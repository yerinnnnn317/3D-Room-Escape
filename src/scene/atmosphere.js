// =============================================================
// scene/atmosphere.js
// 퍼즐과 상관없는 "분위기" 연출 모음.
// - 공중에 떠다니는 붉은 먼지 입자
// - 천장에서 똑똑 떨어지는 핏방울
// - 가끔 일어나는 깜짝 이벤트: 잠깐 정전 + 속삭임 문장 + 효과음
// 이벤트 빈도와 문장은 SCARE_CONFIG에서 바꾸면 된다.
// =============================================================
import * as THREE from 'three';
import { LIGHT_BUS } from './lighting.js';

export const SCARE_CONFIG = {
  minInterval: 30, // 초
  maxInterval: 60,
  blackoutSec: 1.6,
  outageSec: 10, // 전구 하나가 꺼져 있는 시간
  whispers: [
    '…뒤에 누가 있어.',
    '…아직 여기 있어.',
    '…11시 47분.',
    '…나가지 마.',
    '…너도 봤지?',
    '…와인 냄새가 나.',
  ],
};

/** 방 크기(minX..maxX, minZ..maxZ) 안을 떠도는 먼지 */
export function createDust(scene, bounds, count = 260) {
  const pos = new Float32Array(count * 3);
  const vel = new Float32Array(count * 3);
  const w = bounds.maxX - bounds.minX;
  const d = bounds.maxZ - bounds.minZ;
  for (let i = 0; i < count; i++) {
    pos[i * 3] = bounds.minX + Math.random() * w;
    pos[i * 3 + 1] = Math.random() * 2.8;
    pos[i * 3 + 2] = bounds.minZ + Math.random() * d;
    vel[i * 3] = (Math.random() - 0.5) * 0.05;
    vel[i * 3 + 1] = -0.01 - Math.random() * 0.03;
    vel[i * 3 + 2] = (Math.random() - 0.5) * 0.05;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  // 네모난 점 대신 둥글고 흐릿한 먼지
  const dot = document.createElement('canvas');
  dot.width = dot.height = 32;
  const dg = dot.getContext('2d');
  const gr = dg.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  dg.fillStyle = gr;
  dg.fillRect(0, 0, 32, 32);
  const points = new THREE.Points(
    geo,
    new THREE.PointsMaterial({ color: 0xd8a898, map: new THREE.CanvasTexture(dot), size: 0.035, transparent: true, opacity: 0.35, depthWrite: false })
  );
  scene.add(points);

  return function update(dt, t) {
    for (let i = 0; i < count; i++) {
      const k = i * 3;
      pos[k] += (vel[k] + Math.sin(t * 0.5 + i) * 0.01) * dt;
      pos[k + 1] += vel[k + 1] * dt;
      pos[k + 2] += vel[k + 2] * dt;
      if (pos[k + 1] < 0) pos[k + 1] = 2.8;
      if (pos[k] < bounds.minX) pos[k] = bounds.maxX;
      if (pos[k] > bounds.maxX) pos[k] = bounds.minX;
      if (pos[k + 2] < bounds.minZ) pos[k + 2] = bounds.maxZ;
      if (pos[k + 2] > bounds.maxZ) pos[k + 2] = bounds.minZ;
    }
    geo.attributes.position.needsUpdate = true;
  };
}

/** (x, z) 위치 천장(높이 h)에서 떨어지는 핏방울 */
export function createDrip(scene, x, z, h = 2.8, onDrop) {
  const drop = new THREE.Mesh(
    new THREE.SphereGeometry(0.025, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0x6a0000, emissive: 0x300000, roughness: 0.2 })
  );
  drop.scale.y = 1.6;
  scene.add(drop);
  let y = h;
  let v = 0;
  let wait = Math.random() * 2;
  return function update(dt) {
    if (wait > 0) {
      wait -= dt;
      drop.visible = false;
      return;
    }
    drop.visible = true;
    v += 9.8 * dt;
    y -= v * dt;
    if (y <= 0.02) {
      y = h;
      v = 0;
      wait = 1.2 + Math.random() * 2.5;
      onDrop?.(x, z);
    }
    drop.position.set(x, y, z);
  };
}

/**
 * 깜짝 이벤트 스케줄러.
 * onScare({ whisper }) 콜백으로 UI(속삭임 문장)와 사운드에 알린다.
 */
export function createScareEvents(onScare, currentRoom = () => 'study') {
  const C = SCARE_CONFIG;
  const rand = (a, b) => a + Math.random() * (b - a);
  let next = rand(20, 35); // 첫 이벤트는 조금 빨리
  let active = true;
  return {
    set active(v) {
      active = v;
    },
    update(dt) {
      if (LIGHT_BUS.blackout > 0) LIGHT_BUS.blackout = Math.max(0, LIGHT_BUS.blackout - dt);
      if (!active) return;
      next -= dt;
      if (next <= 0) {
        next = rand(C.minInterval, C.maxInterval);
        const whisper = C.whispers[(Math.random() * C.whispers.length) | 0];
        const bulb = LIGHT_BUS.bulbs.find((b) => b.room === currentRoom()) ?? LIGHT_BUS.bulbs[0];
        if (Math.random() < 0.5 && bulb) {
          // 지금 있는 방의 천장 전구가 약 10초 꺼졌다가 다시 켜짐
          bulb.out = C.outageSec;
          onScare?.({ type: 'outage', whisper });
        } else {
          LIGHT_BUS.blackout = C.blackoutSec;
          LIGHT_BUS.flashFlicker = C.blackoutSec;
          onScare?.({ type: 'blackout', whisper });
        }
      }
    },
  };
}

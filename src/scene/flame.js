// =============================================================
// scene/flame.js
// 진짜처럼 일렁이는 불꽃 (셰이더). 이미지 파일 없이 노이즈로 계산한다.
// - createCandleFlame() : 촛불 (파란 밑동, 하얀 심지 주변, 주황 가장자리, 미세한 흔들림)
// - createFireSheet()   : 벽난로 불길 (여러 갈래가 위로 솟구치며 끊어짐)
// 둘 다 항상 카메라를 바라보도록(빌보드) updateFlames()에서 돌려준다.
// main.js에서 setFlameCamera(camera)로 카메라를 알려줘야 한다.
// =============================================================
import * as THREE from 'three';

const NOISE = /* glsl */ `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
    return v;
  }
`;

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

const CANDLE_FRAG = /* glsl */ `
  uniform float time, seed, strength;
  varying vec2 vUv;
  ${NOISE}
  void main() {
    float t = time * 1.0 + seed * 10.0;
    vec2 uv = vUv;
    float h = uv.y;
    // 위로 갈수록 좌우로 흔들림
    float sway = (noise(vec2(t * 2.3, seed)) - 0.5) * 0.18 * h * h;
    float x = uv.x - 0.5 - sway;
    // 눈물방울 모양: 아래는 둥글고 위는 뾰족
    float stretch = 0.9 + 0.15 * noise(vec2(t * 6.0, seed + 3.0));
    float hy = h / stretch;
    float width = 0.30 * pow(max(hy, 0.0), 0.45) * pow(max(1.0 - hy, 0.0), 0.85) * 1.9;
    float edge = abs(x) / max(width, 0.0005);
    float a = smoothstep(1.0, 0.45, edge) * step(0.02, h) * smoothstep(1.0, 0.85, hy);
    // 색: 밑동 파랑, 안쪽 흰빛, 바깥 주황
    float core = smoothstep(0.75, 0.0, edge) * smoothstep(0.75, 0.2, hy);
    vec3 col = mix(vec3(1.0, 0.45, 0.08), vec3(1.0, 0.85, 0.45), smoothstep(0.2, 0.8, 1.0 - edge));
    col = mix(col, vec3(1.0, 0.98, 0.9), core);
    float blueBase = smoothstep(0.22, 0.05, hy) * smoothstep(0.2, 0.7, edge);
    col = mix(col, vec3(0.25, 0.35, 1.0), blueBase * 0.8);
    a *= mix(1.0, 0.5, blueBase);
    // 바깥 은은한 빛무리
    float glow = exp(-length(vec2(x * 2.4, (h - 0.38) * 1.2)) * 7.0) * 0.35;
    gl_FragColor = vec4(col * strength, clamp(a + glow, 0.0, 1.0) * strength);
  }
`;

const FIRE_FRAG = /* glsl */ `
  uniform float time, seed, strength;
  varying vec2 vUv;
  ${NOISE}
  void main() {
    vec2 uv = vUv;
    float t = time + seed * 7.0;
    // 위로 흘러가는 난류
    vec2 q = vec2(uv.x * 3.0, uv.y * 2.0 - t * 1.6);
    float n = fbm(q + fbm(q * 1.7 + t * 0.4));
    // 밑은 넓고 위로 갈수록 좁아지는 불 덩어리
    float x = uv.x - 0.5;
    float shape = 1.0 - smoothstep(0.0, 0.5, abs(x) * (1.0 + uv.y * 1.6));
    float f = shape * (1.25 - uv.y * 1.35) + (n - 0.5) * 1.1;
    f = clamp(f, 0.0, 1.0);
    float a = smoothstep(0.12, 0.55, f);
    vec3 col = mix(vec3(0.6, 0.08, 0.0), vec3(1.0, 0.45, 0.05), smoothstep(0.15, 0.5, f));
    col = mix(col, vec3(1.0, 0.85, 0.45), smoothstep(0.55, 0.85, f));
    col = mix(col, vec3(1.0, 0.97, 0.85), smoothstep(0.85, 1.0, f));
    gl_FragColor = vec4(col * strength, a * strength);
  }
`;

const flames = [];
let camera = null;
export function setFlameCamera(cam) {
  camera = cam;
}

function makeMat(frag, seed) {
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, seed: { value: seed }, strength: { value: 1 } },
    vertexShader: VERT,
    fragmentShader: frag,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

/** 촛불 불꽃 (높이 h). 바닥 중앙이 심지 위치 */
export function createCandleFlame(h = 0.06) {
  const geo = new THREE.PlaneGeometry(h * 0.55, h);
  geo.translate(0, h * 0.42, 0);
  const m = new THREE.Mesh(geo, makeMat(CANDLE_FRAG, Math.random() * 100));
  m.renderOrder = 10;
  flames.push(m);
  return m;
}

/** 벽난로 불길 한 장 (폭 w, 높이 h) */
export function createFireSheet(w = 0.6, h = 0.7) {
  const geo = new THREE.PlaneGeometry(w, h);
  geo.translate(0, h / 2, 0);
  const m = new THREE.Mesh(geo, makeMat(FIRE_FRAG, Math.random() * 100));
  m.renderOrder = 10;
  m.userData.isFire = true;
  flames.push(m);
  return m;
}

const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
/** 매 프레임: 시간 갱신 + 카메라를 향해 세로축으로만 회전 */
export function updateFlames(t) {
  for (const m of flames) {
    m.material.uniforms.time.value = t;
    if (camera && m.parent) {
      m.parent.getWorldQuaternion(_q);
      _e.setFromQuaternion(_q, 'YXZ');
      const wp = m.getWorldPosition(new THREE.Vector3());
      const yaw = Math.atan2(camera.position.x - wp.x, camera.position.z - wp.z);
      m.rotation.y = yaw - _e.y;
    }
  }
}

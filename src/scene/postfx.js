// =============================================================
// scene/postfx.js
// 화면 전체에 입히는 공포 필터 (후처리).
// - 조사할 물체 윤곽선(Outline): 마우스로 가리킨 그 물체 테두리만 빛남
// - 은은한 빛 번짐(Bloom): 촛불·벽난로·전구만 살짝 번지게
// - 공포 필터: 채도 낮추기 + 붉은 그림자 톤 + 가장자리 어둡게(비네팅)
//              + 필름 노이즈 + 약한 색 번짐(색수차) + 심장 박동 맥동
// 세기는 HORROR_FX 값으로 조절한다.
// =============================================================
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';

export const HORROR_FX = {
  bloomStrength: 0.3,
  bloomRadius: 0.6,
  bloomThreshold: 0.97, // 샹들리에 등 아주 밝은 곳만 살짝 번짐
  desaturate: 0.22, // 0 = 원색, 1 = 흑백
  vignette: 1.0,
  grain: 0.045,
  aberration: 0.0018,
};

const HorrorShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    desaturate: { value: HORROR_FX.desaturate },
    vignette: { value: HORROR_FX.vignette },
    grain: { value: HORROR_FX.grain },
    aberration: { value: HORROR_FX.aberration },
    pulse: { value: 0 }, // 0~1, 심장 박동/깜짝 이벤트 때 화면 가장자리가 붉게 조여옴
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float time, desaturate, vignette, grain, aberration, pulse;
    varying vec2 vUv;
    float rand(vec2 co) { return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 c = vUv - 0.5;
      float d = length(c);
      // 가장자리로 갈수록 색이 살짝 어긋남
      vec2 off = c * aberration * (1.0 + d * 3.0);
      vec3 col;
      col.r = texture2D(tDiffuse, vUv + off).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - off).b;
      // 채도 낮추고, 어두운 곳은 붉은 기, 밝은 곳은 바랜 종이색
      float lum = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(col, vec3(lum), desaturate);
      col *= mix(vec3(1.05, 0.92, 0.88), vec3(1.0, 0.98, 0.94), smoothstep(0.0, 0.6, lum));
      // 비네팅 (+ 맥동할 때 더 조여옴)
      float v = smoothstep(0.85, 0.2, d * (vignette + pulse * 0.6));
      col *= mix(0.15, 1.0, v);
      col += vec3(0.25, 0.0, 0.0) * pulse * (1.0 - v);
      // 필름 노이즈 + 아주 약한 깜빡임
      float n = rand(vUv * vec2(1920.0, 1080.0) + fract(time * 13.0)) - 0.5;
      col += n * grain;
      col *= 0.97 + 0.03 * sin(time * 50.0) * sin(time * 3.1);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export function createPostFX(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const outline = new OutlinePass(new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2), scene, camera);
  outline.edgeStrength = 4;
  outline.edgeGlow = 0.6;
  outline.edgeThickness = 1.5;
  outline.pulsePeriod = 2.2;
  outline.visibleEdgeColor.set(0xffc27a);
  outline.hiddenEdgeColor.set(0x3a1a0a);
  composer.addPass(outline);
  // 빛 번짐은 절반 해상도로 (가볍게)
  const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2), HORROR_FX.bloomStrength, HORROR_FX.bloomRadius, HORROR_FX.bloomThreshold);
  composer.addPass(bloom);
  composer.addPass(new OutputPass()); // 톤매핑·색공간 변환
  const horror = new ShaderPass(HorrorShader);
  composer.addPass(horror);

  let pulse = 0;
  return {
    composer,
    /** 깜짝 이벤트나 심장 박동 때 호출 (세기 0~1) */
    /** 윤곽선을 그릴 물체 (null이면 없음) */
    setOutline(obj) {
      outline.selectedObjects = obj ? [obj] : [];
    },
    kick(v = 1) {
      pulse = Math.max(pulse, v);
    },
    render(dt, t) {
      pulse = Math.max(0, pulse - dt * 1.2);
      horror.uniforms.time.value = t;
      horror.uniforms.pulse.value = pulse;
      composer.render(dt);
    },
    setSize(w, h) {
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(w, h);
    },
    /** 움직이는 동안엔 윤곽선 계산(장면을 한 번 더 그림)을 쉬어서 화면을 부드럽게 */
    setOutlineActive(on) {
      outline.enabled = on;
    },
  };
}

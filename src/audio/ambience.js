// =============================================================
// audio/ambience.js
// 외부 음원 파일 없이 Web Audio API로 만드는 공포 사운드.
// - 낮게 웅웅거리는 드론 + 바람 소리(노이즈) : 항상 깔림
// - 가끔 나무 삐걱임
// - 발소리(걸을 때), 깜짝 이벤트 효과음, 시간 임박 심장 박동
// 브라우저 정책상 사용자가 클릭한 뒤 start()를 불러야 소리가 난다.
// M 키로 음소거.
// =============================================================

export class Ambience {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this._creakT = 6;
    this._heartT = 0;
    this._stepT = 0;
  }

  start() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(ctx.destination);

    // ----- 드론: 살짝 어긋난 두 저음 -----
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.07;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 180;
    lp.connect(droneGain).connect(this.master);
    for (const f of [55, 55.8, 82.4]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.connect(lp);
      o.start();
    }
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.08;
    lfoGain.gain.value = 80;
    lfo.connect(lfoGain).connect(lp.frequency);
    lfo.start();

    // ----- 바람: 노이즈 → 밴드패스 -----
    this.noiseBuf = this._makeNoise(2);
    const wind = ctx.createBufferSource();
    wind.buffer = this.noiseBuf;
    wind.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 380;
    bp.Q.value = 0.7;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.035;
    wind.connect(bp).connect(windGain).connect(this.master);
    wind.start();
    const wl = ctx.createOscillator();
    const wlg = ctx.createGain();
    wl.frequency.value = 0.13;
    wlg.gain.value = 0.025;
    wl.connect(wlg).connect(windGain.gain);
    wl.start();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.8;
    return this.muted;
  }

  /** 매 프레임: 걷는 중인지, 남은 시간(초) */
  update(dt, { walking, timeLeft }) {
    if (!this.ctx) return;
    this._creakT -= dt;
    if (this._creakT <= 0) {
      this._creakT = 8 + Math.random() * 14;
      this.creak();
    }
    if (walking) {
      this._stepT -= dt;
      if (this._stepT <= 0) {
        this._stepT = 0.48;
        this.step();
      }
    } else this._stepT = 0;
    if (timeLeft <= 300) {
      this._heartT -= dt;
      if (this._heartT <= 0) {
        this._heartT = timeLeft <= 60 ? 0.6 : 0.95;
        this.heartbeat();
      }
    }
  }

  creak() {
    if (!this.ctx) return;
    const { ctx } = this;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    o.type = 'sawtooth';
    const t = ctx.currentTime;
    o.frequency.setValueAtTime(140 + Math.random() * 80, t);
    o.frequency.linearRampToValueAtTime(90 + Math.random() * 40, t + 0.9);
    f.type = 'bandpass';
    f.frequency.value = 600;
    f.Q.value = 8;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.15);
    g.gain.linearRampToValueAtTime(0, t + 1.0);
    o.connect(f).connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 1.1);
  }

  step() {
    const { ctx } = this;
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 260;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    s.connect(f).connect(g).connect(this.master);
    s.start(t, Math.random());
    s.stop(t + 0.14);
  }

  heartbeat() {
    const { ctx } = this;
    const t = ctx.currentTime;
    for (const [dt, v] of [[0, 0.5], [0.22, 0.35]]) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.setValueAtTime(60, t + dt);
      o.frequency.exponentialRampToValueAtTime(35, t + dt + 0.15);
      g.gain.setValueAtTime(v, t + dt);
      g.gain.exponentialRampToValueAtTime(0.001, t + dt + 0.18);
      o.connect(g).connect(this.master);
      o.start(t + dt);
      o.stop(t + dt + 0.2);
    }
  }

  /** 커튼을 젖히는 소리: 천이 쓸리는 쉬익 */
  swish() {
    if (!this.ctx) return;
    const { ctx } = this;
    const t = ctx.currentTime;
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(2500, t);
    f.frequency.exponentialRampToValueAtTime(700, t + 0.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.22, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    s.connect(f).connect(g).connect(this.master);
    s.start(t, Math.random());
    s.stop(t + 0.65);
  }

  /** 번개 뒤 천둥: 낮게 우르릉 */
  thunder() {
    if (!this.ctx) return;
    const { ctx } = this;
    const t = ctx.currentTime + 0.35;
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(400, t);
    f.frequency.exponentialRampToValueAtTime(60, t + 3);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.5, t + 0.08);
    g.gain.setValueAtTime(0.35, t + 0.4);
    g.gain.linearRampToValueAtTime(0.45, t + 0.7);
    g.gain.exponentialRampToValueAtTime(0.001, t + 3.5);
    s.connect(f).connect(g).connect(this.master);
    s.start(t);
    s.stop(t + 3.6);
  }

  /** 전구가 나갈 때: 지지직 하는 전기 소리 + 툭 꺼지는 소리 */
  zap() {
    if (!this.ctx) return;
    const { ctx } = this;
    const t = ctx.currentTime;
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 1800;
    const g = ctx.createGain();
    for (let i = 0; i < 8; i++) g.gain.setValueAtTime(i % 2 ? 0 : 0.12, t + i * 0.05);
    g.gain.setValueAtTime(0, t + 0.45);
    s.connect(f).connect(g).connect(this.master);
    s.start(t);
    s.stop(t + 0.5);
    const o = ctx.createOscillator();
    const og = ctx.createGain();
    o.frequency.setValueAtTime(120, t + 0.42);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.6);
    og.gain.setValueAtTime(0.25, t + 0.42);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.65);
    o.connect(og).connect(this.master);
    o.start(t + 0.42);
    o.stop(t + 0.7);
  }

  /** 깜짝 이벤트: 날카로운 불협화음 + 저음 쿵 */
  scare() {
    if (!this.ctx) return;
    const { ctx } = this;
    const t = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.12, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t + 2.2);
    g.connect(this.master);
    for (const f of [740, 784, 1046]) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(f, t);
      o.frequency.linearRampToValueAtTime(f * 0.92, t + 2);
      o.connect(g);
      o.start(t);
      o.stop(t + 2.3);
    }
    this.heartbeat();
  }

  _makeNoise(sec) {
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * sec, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }
}

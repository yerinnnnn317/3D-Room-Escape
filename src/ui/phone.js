// =============================================================
// ui/phone.js
// 피해자의 휴대폰 화면 UI.
// 시신이 쥔 폰을 조사하면 화면 가운데에 폰이 크게 열린다.
//   잠금화면(시각·알림) → 홈 화면 → 메시지 / 전화 / 사진 / 메모 앱
// 내용은 전부 scenario.json의 "phone" 항목에서 불러온다. (정답 없음)
// 닫기: Esc, E, 바깥 클릭, 닫기 버튼
// =============================================================
import { gameState } from '../game/gameState.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export class Phone {
  constructor(root) {
    this.wrap = document.createElement('div');
    this.wrap.className = 'phone-wrap hidden';
    this.wrap.innerHTML = `
      <div class="phone">
        <div class="phone-status"><span class="ps-time"></span><span class="ps-right"><b class="ps-bat"></b></span></div>
        <div class="phone-screen"></div>
        <svg class="phone-crack" viewBox="0 0 300 600" preserveAspectRatio="none">
          <g stroke="rgba(255,255,255,0.55)" stroke-width="1.2" fill="none">
            <path d="M70 470 L10 420 M70 470 L0 520 M70 470 L40 600 M70 470 L150 600 M70 470 L190 430 L260 380
                     M70 470 L120 360 L150 250 M70 470 L20 330 M120 360 L170 340 M40 420 L30 380 M150 600 L160 540" />
          </g>
          <circle cx="70" cy="470" r="9" fill="rgba(255,255,255,0.25)" />
        </svg>
        <div class="phone-blood"></div>
        <div class="phone-home-bar"></div>
      </div>
      <button class="phone-close">닫기 (Esc)</button>`;
    root.appendChild(this.wrap);
    this.screen = this.wrap.querySelector('.phone-screen');
    this.wrap.querySelector('.phone-close').addEventListener('click', () => this.close());
    this.wrap.addEventListener('click', (e) => {
      if (e.target === this.wrap) this.close();
    });
    this.screen.addEventListener('click', (e) => {
      const pk = e.target.closest('[data-pk]');
      if (pk) return this._passKey(pk.dataset.pk);
      const el = e.target.closest('[data-go]');
      if (el) this._go(el.dataset.go, el.dataset.arg);
    });
    this._pass = '';
    this.wrap.querySelector('.phone-home-bar').addEventListener('click', () => this._go('home'));
    this.isOpen = false;
  }

  get data() {
    return gameState.scenario.phone;
  }

  open() {
    const d = this.data;
    this.wrap.querySelector('.ps-time').textContent = d.lockTime;
    this.wrap.querySelector('.ps-bat').textContent = d.battery;
    this.wrap.classList.remove('hidden');
    this.isOpen = true;
    this._go('lock');
  }

  close() {
    this.wrap.classList.add('hidden');
    this.isOpen = false;
  }

  /** 키 입력 처리. 처리했으면 true */
  handleKey(e) {
    if (!this.isOpen) return false;
    if (this._view === 'lock' && !gameState.isUnlocked('phone') && /^Digit\d$|^Numpad\d$/.test(e.code)) this._passKey(e.code.slice(-1));
    else if (this._view === 'lock' && e.code === 'Backspace') this._passKey('back');
    else if (e.code === 'Escape' || e.code === 'KeyE') this.close();
    else if (e.code === 'Backspace') this._go(this._view === 'home' || this._view === 'lock' ? 'lock' : 'home');
    e.preventDefault();
    return true;
  }

  _go(view, arg) {
    if (!gameState.isUnlocked('phone')) view = 'lock'; // 잠금을 풀기 전엔 잠금 화면만
    this._view = view;
    const d = this.data;
    const back = `<div class="app-bar"><button data-go="home">‹ 홈</button><span>${{ msgs: '메시지', thread: '메시지', calls: '전화', photos: '사진', memos: '메모', memo: '메모' }[view] ?? ''}</span></div>`;
    let html = '';
    switch (view) {
      case 'lock':
        if (gameState.isUnlocked('phone')) {
          html = `
          <div class="lock">
            <div class="lock-time">${d.lockTime}</div>
            <div class="lock-date">${d.lockDate}</div>
            <button class="unlock" data-go="home">🔓 눌러서 열기</button>
          </div>`;
        } else {
          // 잠금 화면: 시각·알림 + 비밀번호 4자리 입력
          this._pass = '';
          html = `
          <div class="lock locked">
            <div class="lock-time sm">${d.lockTime}</div>
            <div class="lock-date">${d.lockDate}</div>
            <div class="lock-notis">
              ${d.notifications.slice(0, 1).map((n) => `<div class="noti"><small>${esc(n.app)}</small><b>${esc(n.title)}</b><p>${esc(n.body)}</p></div>`).join('')}
            </div>
            <div class="pass-title">🔒 비밀번호 입력</div>
            <div class="pass-dots"><i></i><i></i><i></i><i></i></div>
            <div class="pass-hint">${esc(d.lockHint)}</div>
            <div class="pass-keys">
              ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => `<button data-pk="${k}">${k}</button>`).join('')}
              <span></span><button data-pk="0">0</button><button data-pk="back">⌫</button>
            </div>
          </div>`;
        }
        break;
      case 'home':
        html = `
          <div class="home">
            <button class="pin-memo" data-go="memo" data-arg="0">📌 <b>${esc(d.memos[0].title)}</b><span>고정된 메모 · 눌러서 보기</span></button>
            <div class="apps">
              <button data-go="msgs"><i class="ic msg">✉</i>메시지</button>
              <button data-go="calls"><i class="ic call">✆</i>전화<em>3</em></button>
              <button data-go="photos"><i class="ic photo">▣</i>사진</button>
              <button data-go="memos"><i class="ic memo">✎</i>메모</button>
            </div>
          </div>`;
        break;
      case 'msgs':
        html = back + d.messages.map((m, i) => `<div class="row" data-go="thread" data-arg="${i}"><b>${esc(m.name)}</b><p>${esc(m.preview)}</p></div>`).join('');
        break;
      case 'thread': {
        const t = d.messages[+arg];
        html =
          back +
          `<div class="thread-name">${esc(t.name)}</div><div class="thread">` +
          t.log.map((l) => `<div class="bubble ${l.from}"><span>${esc(l.text)}</span><small>${esc(l.time)}</small></div>`).join('') +
          `</div>`;
        break;
      }
      case 'calls':
        html =
          back +
          d.calls
            .map((c) => `<div class="row call ${c.type}"><b>${esc(c.name)}</b><p>${c.type === 'missed' ? '↙' : '↗'} ${esc(c.note)}</p><small>${esc(c.time)}</small></div>`)
            .join('');
        break;
      case 'photos':
        html =
          back +
          `<div class="grid">${d.photos.map((p, i) => `<canvas class="thumb" data-go="photo" data-arg="${i}" width="120" height="120" data-kind="${p.kind}"></canvas>`).join('')}</div>`;
        break;
      case 'photo': {
        const p = d.photos[+arg];
        html = `<div class="app-bar"><button data-go="photos">‹ 사진</button><span></span></div>
          <canvas class="photo-big" width="300" height="300" data-kind="${p.kind}"></canvas>
          <p class="caption">${esc(p.caption)}</p>`;
        break;
      }
      case 'memos':
        html = back + d.memos.map((m, i) => `<div class="row" data-go="memo" data-arg="${i}"><b>${esc(m.title)}</b><p>${esc(m.body.split('\n')[0])}</p></div>`).join('');
        break;
      case 'memo': {
        const m = d.memos[+arg];
        html = `<div class="app-bar"><button data-go="memos">‹ 메모</button><span>메모</span></div>
          <div class="memo-paper"><h3>${esc(m.title)}</h3><p>${esc(m.body)}</p></div>`;
        break;
      }
    }
    this.screen.innerHTML = html;
    this.screen.querySelectorAll('canvas[data-kind]').forEach((c) => drawPhoto(c, c.dataset.kind));
  }
}

Phone.prototype._passKey = function (k) {
  if (this._unlocking) return;
  if (k === 'back') this._pass = this._pass.slice(0, -1);
  else if (this._pass.length < 4) this._pass += k;
  const dots = this.screen.querySelectorAll('.pass-dots i');
  dots.forEach((d, i) => d.classList.toggle('on', i < this._pass.length));
  if (this._pass.length < 4) return;
  const r = gameState.submitCode('phone', this._pass);
  const box = this.screen.querySelector('.lock');
  if (r.ok) {
    // 잠금 해제 → 고정 메모 '탐정님께'로 바로 이동
    this._unlocking = true;
    box.classList.add('unlocked');
    setTimeout(() => {
      this._unlocking = false;
      this._go('memo', 0);
    }, 700);
  } else {
    box.querySelector('.pass-title').textContent = '❌ 비밀번호가 틀렸습니다';
    box.classList.remove('shake');
    void box.offsetWidth;
    box.classList.add('shake');
    this._pass = '';
    setTimeout(() => dots.forEach((d) => d.classList.remove('on')), 350);
  }
};

/** 흐릿한 사진을 캔버스로 그림 (실제 이미지 파일 없이) */
function drawPhoto(c, kind) {
  const g = c.getContext('2d');
  const W = c.width;
  const H = c.height;
  const s = W / 120;
  g.fillStyle = '#140808';
  g.fillRect(0, 0, W, H);
  if (kind === 'shelf') {
    g.fillStyle = '#3a2214';
    for (let r = 0; r < 4; r++) g.fillRect(6 * s, (20 + r * 26) * s, 108 * s, 3 * s);
    for (let r = 0; r < 4; r++)
      for (let k = 0; k < 7; k++) {
        if (r === 1 && k === 3) {
          g.fillStyle = '#5a0a0a'; // 빈 칸의 붉은 자국
          g.fillRect((12 + k * 15) * s, (8 + r * 26) * s, 9 * s, 10 * s);
          continue;
        }
        g.fillStyle = k % 2 ? '#0f2414' : '#2a120c';
        g.beginPath();
        g.arc((16 + k * 15) * s, (12 + r * 26) * s, 5 * s, 0, Math.PI * 2);
        g.fill();
      }
  } else if (kind === 'desk') {
    g.fillStyle = '#3a2414';
    g.fillRect(10 * s, 50 * s, 100 * s, 8 * s);
    g.fillStyle = '#24160c';
    g.fillRect(70 * s, 58 * s, 34 * s, 40 * s);
    g.fillStyle = '#8a7240';
    g.fillRect(80 * s, 72 * s, 14 * s, 4 * s); // 서랍 손잡이
    g.fillStyle = '#c8c0b0';
    g.fillRect(96 * s, 70 * s, 6 * s, 8 * s); // 자물쇠
  } else {
    // 창문에 비친 그림자
    g.fillStyle = '#2a3048';
    g.fillRect(25 * s, 15 * s, 70 * s, 85 * s);
    g.fillStyle = '#0a0606';
    g.beginPath();
    g.ellipse(62 * s, 45 * s, 11 * s, 14 * s, 0, 0, Math.PI * 2);
    g.fill();
    g.fillRect(46 * s, 58 * s, 32 * s, 42 * s);
  }
  // 흔들림·노이즈
  const img = g.getImageData(0, 0, W, H);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 30;
    img.data[i] += n;
    img.data[i + 1] += n * 0.6;
    img.data[i + 2] += n * 0.6;
  }
  g.putImageData(img, 0, 0);
  g.globalAlpha = 0.35;
  g.drawImage(c, 3 * s, 0);
  g.globalAlpha = 1;
}

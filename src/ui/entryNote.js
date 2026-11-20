// =============================================================
// ui/entryNote.js
// 게임 시작 직후, 서재에 들어가기 "전" 화면.
// 잠긴 서재 문에 한도윤이 남긴 쪽지가 붙어 있고, 그림 수수께끼(쉬움)를 풀어
// 4자리 비밀번호를 넣고 [문 열기]를 누르면 문이 열리며 서재로 들어간다.
// 쪽지는 소지품(entry_note)에 들어간다. 정답 판정은 gameState.submitCode('entry_door').
// 내용은 scenario.json의 "entryNote"에서 불러온다.
// =============================================================
import { gameState } from '../game/gameState.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export class EntryNote {
  /** @param {HTMLElement} root @param {{ onOpened: ()=>void, onKey?: ()=>void }} opts */
  constructor(root, { onOpened, onKey }) {
    this.onOpened = onOpened;
    this.onKey = onKey;
    this.el = document.createElement('div');
    this.el.className = 'entry-wrap hidden';
    root.appendChild(this.el);
    this.isOpen = false;
    this.input = '';
  }

  open() {
    const n = gameState.scenario.entryNote;
    const sym = (s) => `<span class="en-sym">${s}</span>`;
    this.el.innerHTML = `
      <div class="entry-door">
        <div class="ed-panel p1"></div><div class="ed-panel p2"></div><div class="ed-panel p3"></div><div class="ed-panel p4"></div>
        <div class="ed-knob"></div><div class="ed-lock"><span></span><span></span><span></span><span></span></div>
        <div class="en-note">
          <i class="en-pin"></i>
          <h3>${esc(n.title)}</h3>
          ${n.lines.map((l) => `<p>${esc(l)}</p>`).join('')}
          <div class="en-eqs">
            ${n.equations.map((eq) => `<div class="en-eq">${eq.map((t) => (/^[+=]$/.test(t) ? `<b>${t}</b>` : /^\d+$/.test(t) ? `<em>${t}</em>` : sym(t))).join('')}</div>`).join('')}
          </div>
          <div class="en-q">문 비밀번호 : ${n.question.map(sym).join('')}</div>
          <p class="en-ps">${esc(n.ps)}</p>
        </div>
      </div>
      <div class="en-pad">
        <div class="en-prompt">${esc(n.prompt)}</div>
        <div class="en-slots"><span></span><span></span><span></span><span></span></div>
        <div class="en-msg"></div>
        <div class="en-keys">
          ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => `<button data-k="${k}">${k}</button>`).join('')}
          <button data-k="back">←</button><button data-k="0">0</button><button data-k="clear">지우기</button>
        </div>
        <button class="en-go">문 열기</button>
      </div>`;
    this.el.querySelector('.en-keys').addEventListener('click', (e) => {
      const k = e.target.closest('[data-k]')?.dataset.k;
      if (k) this._press(k);
    });
    this.el.querySelector('.en-go').addEventListener('click', () => this._submit());
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.input = '';
    this._render();
    this.el.classList.remove('hidden');
    this.isOpen = true;
  }

  handleKey(e) {
    if (!this.isOpen) return false;
    if (/^Digit\d$|^Numpad\d$/.test(e.code)) this._press(e.code.slice(-1));
    else if (e.code === 'Backspace') this._press('back');
    else if (e.code === 'Enter' || e.code === 'NumpadEnter') this._submit();
    e.preventDefault();
    return true;
  }

  _press(k) {
    if (this._busy) return;
    if (k === 'back') this.input = this.input.slice(0, -1);
    else if (k === 'clear') this.input = '';
    else if (this.input.length < 4) this.input += k;
    this.onKey?.();
    this.el.querySelector('.en-msg').textContent = '';
    this._render();
  }

  _render() {
    this.el.querySelectorAll('.en-slots span').forEach((s, i) => (s.textContent = this.input[i] ?? ''));
    this.el.querySelectorAll('.ed-lock span').forEach((s, i) => (s.textContent = this.input[i] ?? '·'));
  }

  _submit() {
    if (this._busy) return;
    const msg = this.el.querySelector('.en-msg');
    if (this.input.length < 4) {
      msg.textContent = '네 자리를 모두 입력하세요.';
      return;
    }
    const r = gameState.submitCode('entry_door', this.input);
    if (!r.ok) {
      msg.textContent = r.text;
      const pad = this.el.querySelector('.en-pad');
      pad.classList.remove('shake');
      void pad.offsetWidth;
      pad.classList.add('shake');
      this.input = '';
      this._render();
      return;
    }
    // 정답: 쪽지가 떼어지고 문이 안쪽으로 열린 뒤 서재로
    this._busy = true;
    msg.textContent = '';
    this.el.classList.add('opening');
    setTimeout(() => {
      this.el.classList.add('hidden');
      this.el.classList.remove('opening');
      this.isOpen = false;
      this._busy = false;
      this.onOpened?.(r.text);
    }, 1700);
  }
}

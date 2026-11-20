// =============================================================
// ui/dialog.js
// 대화창 + 숫자 키패드 UI.
// - show(title, text)  : 단서 설명 대화창 (글자가 한 자씩 타이핑되듯 나타남)
//                        [확인] 버튼(또는 E / Space / Enter)을 눌러야 닫힘.
//                        창 클릭은 글자를 끝까지 보여주기만 한다
// - openKeypad({...})  : 비밀번호 입력 UI. 입력값을 onSubmit에 넘길 뿐,
//                        정답이 뭔지는 전혀 모른다(판정은 gameState).
// =============================================================

export class Dialog {
  constructor(root) {
    // ----- 대화창 -----
    this.box = document.createElement('div');
    this.box.className = 'dialog hidden';
    this.box.innerHTML = `<div class="dialog-title"></div><div class="dialog-text"></div>
      <div class="dialog-foot"><span class="dialog-hint">다 읽었으면 확인을 눌러야 다시 움직일 수 있어요</span>
      <span class="dialog-actions"></span><button class="dialog-ok" type="button">확인</button></div>`;
    root.appendChild(this.box);
    this.titleEl = this.box.querySelector('.dialog-title');
    this.textEl = this.box.querySelector('.dialog-text');
    this.okBtn = this.box.querySelector('.dialog-ok');
    this.actionsEl = this.box.querySelector('.dialog-actions');
    // 대화창을 클릭하면 글자를 끝까지 보여주기만 하고, 닫기는 [확인] 버튼으로
    this.box.addEventListener('click', (e) => {
      if (e.target === this.okBtn || e.target.closest('.dialog-actions')) return;
      this._finishTyping();
    });
    this.okBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.advance();
    });

    // ----- 키패드 -----
    this.pad = document.createElement('div');
    this.pad.className = 'keypad-wrap hidden';
    this.pad.innerHTML = `
      <div class="keypad">
        <div class="keypad-title"></div>
        <div class="keypad-text"></div>
        <div class="keypad-display"></div>
        <div class="keypad-msg"></div>
        <div class="keypad-grid">
          ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button data-k="${n}">${n}</button>`).join('')}
          <button data-k="back">←</button><button data-k="0">0</button><button data-k="ok" class="ok">확인</button>
        </div>
        <button class="keypad-cancel" data-k="cancel">취소 (Esc)</button>
      </div>`;
    root.appendChild(this.pad);
    this.padTitle = this.pad.querySelector('.keypad-title');
    this.padText = this.pad.querySelector('.keypad-text');
    this.padDisplay = this.pad.querySelector('.keypad-display');
    this.padMsg = this.pad.querySelector('.keypad-msg');
    this.pad.addEventListener('click', (e) => {
      const k = e.target?.dataset?.k;
      if (k) this._press(k);
    });

    this.isOpen = false;
    this.keypadOpen = false;
    this._typing = null;
    this.onKeypadClose = null; // main.js가 포인터 락 복구에 사용
  }

  // ---------------- 대화창 ----------------
  /**
   * @param {string} title @param {string} text
   * @param {{ actions?: {label:string, onClick:()=>void}[] }} [opts] 확인 옆에 붙는 행동 버튼 (예: 열쇠 사용하기)
   */
  show(title, text, opts = {}) {
    this.actionsEl.innerHTML = '';
    for (const a of opts.actions ?? []) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'dialog-action';
      b.textContent = a.label;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this.close();
        a.onClick();
      });
      this.actionsEl.appendChild(b);
    }
    this.isOpen = true;
    this.box.classList.remove('hidden');
    this.titleEl.textContent = title ?? '';
    this._fullText = text ?? '';
    this.textEl.textContent = '';
    this.box.classList.add('typing');
    clearInterval(this._typing);
    let i = 0;
    this._typing = setInterval(() => {
      i += 2;
      this.textEl.textContent = this._fullText.slice(0, i);
      if (i >= this._fullText.length) this._finishTyping();
    }, 22);
  }

  /** 타이핑 효과를 끝내고 전체 글을 보여줌 → 확인 버튼 강조 */
  _finishTyping() {
    if (!this._typing) return;
    clearInterval(this._typing);
    this._typing = null;
    this.textEl.textContent = this._fullText;
    this.box.classList.remove('typing');
  }

  /** 타이핑 중이면 끝까지 보여주고, 아니면 닫는다 */
  advance() {
    if (!this.isOpen) return;
    if (this._typing) return this._finishTyping();
    this.close();
  }

  close() {
    this.isOpen = false;
    this.box.classList.add('hidden');
  }

  // ---------------- 키패드 ----------------
  openKeypad({ title, text, digits, onSubmit }) {
    this.close();
    this.keypadOpen = true;
    this._digits = digits;
    this._input = '';
    this._onSubmit = onSubmit;
    this.padTitle.textContent = title;
    this.padText.textContent = text ?? '';
    this.padMsg.textContent = '';
    this._render();
    this.pad.classList.remove('hidden');
  }

  closeKeypad() {
    this.keypadOpen = false;
    this.pad.classList.add('hidden');
    this.onKeypadClose?.();
  }

  /** 키보드 입력 처리. 처리했으면 true */
  handleKey(e) {
    if (!this.keypadOpen) return false;
    if (/^Digit\d$|^Numpad\d$/.test(e.code)) this._press(e.code.slice(-1));
    else if (e.code === 'Backspace') this._press('back');
    else if (e.code === 'Enter' || e.code === 'NumpadEnter') this._press('ok');
    else if (e.code === 'Escape') this._press('cancel');
    e.preventDefault();
    return true;
  }

  _press(k) {
    if (k === 'cancel') return this.closeKeypad();
    if (k === 'back') this._input = this._input.slice(0, -1);
    else if (k === 'ok') return this._submit();
    else if (this._input.length < this._digits) this._input += k;
    this.padMsg.textContent = '';
    this._render();
  }

  _submit() {
    const r = this._onSubmit?.(this._input) ?? { ok: false, text: '' };
    if (r.ok) {
      const title = this.padTitle.textContent;
      this.closeKeypad();
      this.show(title, r.text);
    } else {
      this.padMsg.textContent = r.text;
      this._input = '';
      this._render();
      const kp = this.pad.querySelector('.keypad');
      kp.classList.remove('shake');
      void kp.offsetWidth; // 애니메이션 재시작
      kp.classList.add('shake');
    }
  }

  _render() {
    const slots = [];
    for (let i = 0; i < this._digits; i++) slots.push(`<span>${this._input[i] ?? '_'}</span>`);
    this.padDisplay.innerHTML = slots.join('');
  }
}

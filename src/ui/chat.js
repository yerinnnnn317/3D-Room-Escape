// =============================================================
// ui/chat.js
// 화면 하단 채팅 입력창 + 로그.
// Enter로 입력창을 열고, 입력한 문장은 onSubmit(text)으로 넘긴다.
// (main.js가 이것을 AI 게임 마스터 → puzzles → 묘사 순서로 연결)
// 입력 중에는 이동이 막힌다. Esc로 입력창을 닫는다.
// =============================================================

export class Chat {
  constructor(root, { onSubmit }) {
    this.wrap = document.createElement('div');
    this.wrap.className = 'chat';
    this.wrap.innerHTML = `
      <div class="chat-log"></div>
      <input class="chat-input" type="text" maxlength="80" placeholder="Enter: 행동 입력 (예: 시계를 살펴본다 / 서랍에 1234 입력)" />`;
    root.appendChild(this.wrap);
    this.log = this.wrap.querySelector('.chat-log');
    this.input = this.wrap.querySelector('.chat-input');
    this.busy = false;

    this.input.addEventListener('keydown', async (e) => {
      e.stopPropagation(); // 게임 키 입력과 분리
      if (e.code === 'Escape') return this.blur();
      if (e.code !== 'Enter' || e.isComposing) return; // 한글 조합 중 Enter 무시
      const text = this.input.value.trim();
      this.input.value = '';
      if (!text) return this.blur();
      if (this.busy) return;
      this.busy = true;
      try {
        await onSubmit(text);
      } finally {
        this.busy = false;
      }
    });
    this.input.addEventListener('keyup', (e) => e.stopPropagation());
  }

  get isFocused() {
    return document.activeElement === this.input;
  }

  focus() {
    this.input.focus();
  }

  blur() {
    this.input.blur();
  }

  addLine(text, kind = 'gm') {
    const line = document.createElement('div');
    line.className = `chat-line ${kind}`;
    line.textContent = kind === 'player' ? `> ${text}` : text;
    this.log.appendChild(line);
    while (this.log.children.length > 6) this.log.firstChild.remove();
    this.log.scrollTop = this.log.scrollHeight;
  }
}

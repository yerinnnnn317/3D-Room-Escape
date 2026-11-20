// =============================================================
// ui/hud.js
// 화면 고정 UI 담당.
// - 시작 화면 → 사건 소개(스토리) 화면 → 게임
// - 상단 타이머(30분, 5분 이하 붉게 깜빡임), 현재 방 이름
// - 마우스 옆에 뜨는 "클릭: 조사하기 / 다가가기" 안내
// - 시점 전환 버튼(1인칭 / 3D 시점), 손전등·소리·힌트 상태
// - 토스트 메시지, 화면 가운데 속삭임 문장, 엔딩 화면
// gameState 이벤트를 구독해 스스로 갱신한다.
// =============================================================
import { gameState } from '../game/gameState.js';

const fmt = (sec) => {
  const s = Math.max(0, Math.ceil(sec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

export class Hud {
  constructor(root, { onViewChange } = {}) {
    this.root = root;
    root.classList.add('prestart'); // 시작 전에는 타이머·UI 숨김
    const meta = gameState.scenario.meta;
    root.insertAdjacentHTML(
      'beforeend',
      `
      <div class="hud-top">
        <div class="hud-room"></div>
        <div class="hud-timer">${fmt(meta.timeLimitSec)}</div>
      </div>
      <div class="hud-views">
        <button data-view="first">1인칭</button>
        <button data-view="overview">3D 시점</button>
      </div>
      <div class="hud-status"></div>
      <div class="hud-prompt hidden"></div>
      <div class="hud-help">
        <b>클릭</b> 그곳으로 걷기 · 물체 클릭 다가가기/조사 · <b>좌클릭 드래그</b> 시점 돌리기<br/>
        <b>← →</b> 회전 · <b>↑ ↓ / WASD</b> 이동 · <b>V</b> 시점 전환 · <b>E</b> 조사 · <b>F</b> 손전등 · <b>C</b> 단서 수첩 · <b>H</b> 힌트 · <b>M</b> 소리 · <b>Enter</b> 채팅
      </div>
      <div class="hud-toast hidden"></div>
      <div class="hud-whisper"></div>

      <div class="overlay title-screen">
        <p class="pre">CASE FILE · 1998.11</p>
        <h1>${meta.title}</h1>
        <p class="sub">${meta.subtitle}</p>
        <button class="go-story">▶ 게임 시작</button>
      </div>
      <div class="overlay story hidden">
        <div class="story-box">
          ${(meta.story ?? []).map((p) => `<p class="line">${p}</p>`).join('')}
          <div class="story-rule line">
            제한 시간 <b>${Math.round(meta.timeLimitSec / 60)}분</b> · 힌트 <b>${meta.maxHints}회</b><br/>
            물체를 클릭해 다가가 조사하고, 단서를 모아 탈출하라.
          </div>
          <div class="story-confirm">
            <p>위 내용을 모두 숙지하셨습니까?</p>
            <button class="enter">숙지했습니다 · 탈출 시작</button>
          </div>
        </div>
        <button class="skip">건너뛰기 ▸▸</button>
      </div>
      <div class="overlay ending hidden"></div>
    `
    );
    this.$ = (sel) => root.querySelector(sel);
    this.timerEl = this.$('.hud-timer');
    this.roomEl = this.$('.hud-room');
    this.promptEl = this.$('.hud-prompt');
    this.statusEl = this.$('.hud-status');
    this.toastEl = this.$('.hud-toast');
    this.whisperEl = this.$('.hud-whisper');

    this.view = 'first';
    this.flash = true;
    this.muted = false;

    root.querySelectorAll('.hud-views button').forEach((b) =>
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        if (b.dataset.view !== this.view) onViewChange?.();
      })
    );

    gameState.addEventListener('timer', (e) => this.setTimer(e.detail.timeLeft));
    gameState.addEventListener('change', () => this.refresh());
    // 단서 개수 버튼 → 단서 수첩 열기 (statusEl 내용은 매번 다시 그려지므로 위임으로 처리)
    this.statusEl.addEventListener('click', (e) => {
      if (e.target.closest('.hud-clues')) this.onCluesClick?.();
    });
    this.refresh();
  }

  refresh() {
    const s = gameState.state;
    this.roomEl.textContent = gameState.scenario.rooms[s.currentRoom].name;
    this.setTimer(s.timeLeft);
    const hintsLeft = gameState.maxHints - s.hintsUsed;
    const clues = gameState.currentClueProgress();
    this.statusEl.innerHTML = `
      <span class="${this.flash ? '' : 'off'}">손전등 ${this.flash ? 'ON' : 'OFF'}</span>
      <span class="${this.muted ? 'off' : ''}">소리 ${this.muted ? 'OFF' : 'ON'}</span>
      <span>힌트 ${'●'.repeat(hintsLeft)}${'○'.repeat(gameState.maxHints - hintsLeft)}</span>
      ${clues ? `<button class="hud-clues${clues.complete ? ' complete' : ''}" type="button" title="단서 수첩 열기 (C)">단서 ${clues.found} / ${clues.total}</button>` : ''}`;
    this.root.querySelectorAll('.hud-views button').forEach((b) => b.classList.toggle('active', b.dataset.view === this.view));
  }

  setTimer(sec) {
    this.timerEl.textContent = fmt(sec);
    this.timerEl.classList.toggle('danger', sec <= 300);
  }

  /** 마우스 옆 안내 문구. text가 없으면 숨김 */
  setPrompt(text, x, y) {
    if (!text) {
      if (this._prompt) this.promptEl.classList.add('hidden');
      this._prompt = null;
      return;
    }
    if (text !== this._prompt) {
      this._prompt = text;
      this.promptEl.innerHTML = text;
      this.promptEl.classList.remove('hidden');
    }
    this.promptEl.style.transform = `translate(${x + 18}px, ${y + 14}px)`;
  }

  setView(mode) {
    this.view = mode;
    this.refresh();
  }

  setFlashlight(on) {
    this.flash = on;
    this.refresh();
  }

  setMuted(m) {
    this.muted = m;
    this.refresh();
  }

  toast(text, ms = 3200) {
    this.toastEl.textContent = text;
    this.toastEl.classList.remove('hidden');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => this.toastEl.classList.add('hidden'), ms);
  }

  /** 화면 가운데에 희미하게 떴다 사라지는 속삭임 */
  whisper(text) {
    this.whisperEl.textContent = text;
    this.whisperEl.classList.remove('show');
    void this.whisperEl.offsetWidth;
    this.whisperEl.classList.add('show');
  }

  /**
   * 시작 화면 → 스토리 화면 흐름
   * onFirstClick: 첫 클릭 시 (사운드 시작용) / onEnter: 게임 시작
   */
  onIntro({ onFirstClick, onEnter }) {
    const title = this.$('.overlay.title-screen');
    const story = this.$('.overlay.story');
    const lines = [...story.querySelectorAll('.line')];
    const confirm = story.querySelector('.story-confirm');
    const skip = story.querySelector('.skip');
    let timers = [];
    const showAll = () => {
      timers.forEach(clearTimeout);
      lines.forEach((l) => l.classList.add('show'));
      confirm.classList.add('show');
      skip.classList.add('hidden');
    };
    title.querySelector('.go-story').addEventListener('click', () => {
      onFirstClick?.();
      title.classList.add('hidden');
      story.classList.remove('hidden');
      // 한 줄씩 천천히 (글자 수에 비례해 머무름)
      let t = 800;
      lines.forEach((l) => {
        timers.push(setTimeout(() => l.classList.add('show'), t));
        t += 1400 + l.textContent.trim().length * 55;
      });
      timers.push(setTimeout(showAll, t + 400));
    });
    skip.addEventListener('click', showAll);
    story.querySelector('.enter').addEventListener('click', () => {
      story.classList.add('hidden');
      this.root.classList.remove('prestart');
      onEnter?.();
    });
  }

  showEnding({ won, timeUsed, hintsUsed, clues }) {
    const el = this.$('.overlay.ending');
    el.classList.remove('hidden');
    el.classList.toggle('won', won);
    el.innerHTML = won
      ? `<h1>탈출 성공</h1>
         <p class="sub">철문 너머로 새벽이 밝아온다. 등 뒤의 저택은 다시 침묵에 잠긴다.</p>
         <p>걸린 시간 ${fmt(timeUsed)} · 사용한 힌트 ${hintsUsed}회 · 조사한 단서 ${clues}개</p>
         <button class="restart">다시 하기</button>`
      : `<h1>시간 초과</h1>
         <p class="sub">전등이 완전히 꺼졌다. 어둠 속에서 누군가 네 이름을 불렀다.</p>
         <p>조사한 단서 ${clues}개</p>
         <button class="restart">다시 하기</button>`;
    el.querySelector('.restart').onclick = () => location.reload();
  }
}

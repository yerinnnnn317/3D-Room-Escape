// =============================================================
// ui/clueBoard.js
// 단서 수첩 — 문을 열기 위해 이 방에서 모아야 할 단서 목록.
// - 아직 다 못 찾았으면: "단서를 다 찾지 못했습니다 (3 / 6)" + 찾은 단서 / ??? 목록
// - 다 찾았으면: 단서들을 순서대로 나열하고 조합 과정을 보여준 뒤
//   [단서 조합해서 문 열기] 버튼 → 숫자 입력(키패드)
// 정답은 모른다. 입력값은 gameState.submitCode()가 판정한다.
// =============================================================
import { gameState } from '../game/gameState.js';

export class ClueBoard {
  /** @param {HTMLElement} root  @param {{ openKeypad: (lockId:string, prompt:string)=>void }} deps */
  constructor(root, { openKeypad }) {
    this.openKeypad = openKeypad;
    this.el = document.createElement('div');
    this.el.className = 'clueboard-wrap hidden';
    this.el.innerHTML = `
      <div class="clueboard">
        <div class="cb-head"><span class="cb-title"></span><span class="cb-count"></span></div>
        <div class="cb-msg"></div>
        <ol class="cb-list"></ol>
        <div class="cb-combine hidden"></div>
        <div class="cb-foot">
          <button class="cb-close" type="button">닫기</button>
          <button class="cb-go hidden" type="button">단서 조합해서 문 열기</button>
        </div>
      </div>`;
    root.appendChild(this.el);
    this.$ = (s) => this.el.querySelector(s);
    this.$('.cb-close').addEventListener('click', () => this.close());
    this.$('.cb-go').addEventListener('click', () => {
      const id = this.lockId;
      const p = gameState.clueProgress(id);
      this.close();
      this.openKeypad(id, p.prompt);
    });
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.isOpen = false;
  }

  /** Enter: (단서를 다 모았으면) 조합해서 문 열기 / Esc·C: 닫기 */
  handleKey(e) {
    if (!this.isOpen) return false;
    if (e.code === 'Enter' || e.code === 'NumpadEnter') {
      const go = this.$('.cb-go');
      if (!go.classList.contains('hidden')) go.click();
    } else if (e.code === 'Escape' || e.code === 'KeyC') this.close();
    e.preventDefault();
    return true;
  }

  /** @param {string} lockId  문 id (study_door / exit_door). 없으면 지금 방의 문 */
  open(lockId) {
    const id = lockId ?? gameState.currentClueProgress()?.lockId;
    if (!id) return false;
    const p = gameState.clueProgress(id);
    if (!p) return false;
    this.lockId = id;
    const def = gameState.getDef(id);
    this.$('.cb-title').textContent = p.title;
    this.$('.cb-count').textContent = `단서 ${p.found} / ${p.total}`;
    const msg = this.$('.cb-msg');
    if (gameState.isUnlocked(id)) {
      msg.textContent = def.openedText;
      msg.className = 'cb-msg done';
    } else if (!p.complete) {
      msg.innerHTML = `<b>단서를 다 찾지 못했습니다.</b><br>${def.lockedText}<br>방 안을 더 살펴보세요. (남은 단서 ${p.total - p.found}개)`;
      msg.className = 'cb-msg warn';
    } else {
      msg.innerHTML = '<b>단서를 모두 찾았습니다!</b> 단서를 하나로 이어 보세요.';
      msg.className = 'cb-msg ok';
    }
    this.$('.cb-list').innerHTML = p.clues
      .map((c) =>
        c.found
          ? `<li class="found"><span class="cb-label">${c.label}</span><span class="cb-fact">${c.fact}</span></li>`
          : `<li class="missing"><span class="cb-label">???</span><span class="cb-fact">아직 찾지 못한 단서</span></li>`
      )
      .join('');
    const comb = this.$('.cb-combine');
    const showCombine = p.complete && !gameState.isUnlocked(id);
    comb.classList.toggle('hidden', !showCombine);
    if (showCombine) {
      comb.innerHTML = `<div class="cb-sub">단서 조합</div>${p.combine.map((l) => `<div class="cb-step">${l}</div>`).join('')}
        <div class="cb-result">${p.result}</div>`;
    }
    this.$('.cb-go').classList.toggle('hidden', !showCombine);
    // 닫기 버튼 이름: 아직 단서가 남았으면 '계속 단서 찾기'
    this.$('.cb-close').textContent = p.complete || gameState.isUnlocked(id) ? '닫기' : '계속 단서 찾기';
    this.el.classList.remove('hidden');
    this.el.querySelector('.clueboard').scrollTop = 0;
    this.isOpen = true;
    return true;
  }

  close() {
    this.el.classList.add('hidden');
    this.isOpen = false;
  }
}

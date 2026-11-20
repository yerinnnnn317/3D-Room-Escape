// =============================================================
// ui/diary.js
// 책상 위 일기장을 조사하면 열리는 "펼친 일기장" 화면.
// - 가죽 표지가 넘어가며 열리고, 줄 쳐진 종이에 손글씨로 일기가 적혀 있다
// - ← → (또는 화면의 화살표)로 한 장씩 넘김
// - ~~글자~~ : 줄 그어 지운 글씨,  **글자** : 여러 번 덧칠한 진한 글씨
// - 마지막 장은 피 얼룩과 함께 글씨가 끊겨 있음
// 일기 내용은 scenario.json의 "diary"에서 불러온다.
// =============================================================
import { gameState } from '../game/gameState.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const ink = (s) =>
  esc(s)
    .replace(/~~(.+?)~~/g, '<s>$1</s>')
    .replace(/\*\*(.+?)\*\*/g, '<b class="overwrite" data-t="$1">$1</b>');

export class Diary {
  constructor(root) {
    this.wrap = document.createElement('div');
    this.wrap.className = 'diary-wrap hidden';
    root.appendChild(this.wrap);
    this.wrap.addEventListener('click', (e) => {
      if (e.target === this.wrap || e.target.closest('.diary-close')) return this.close();
      if (e.target.closest('.diary-prev')) return this.turn(-1);
      if (e.target.closest('.diary-next')) return this.turn(1);
    });
    this.isOpen = false;
    this.spread = 0;
  }

  get entries() {
    return gameState.scenario.diary.entries;
  }

  open() {
    this.spread = 0;
    this.wrap.innerHTML = `
      <div class="diary">
        <div class="diary-book">
          <div class="diary-page left"></div>
          <div class="diary-page right"></div>
          <div class="diary-cover"><span>DIARY</span><small>${esc(gameState.scenario.diary.owner)}</small></div>
        </div>
        <div class="diary-nav">
          <button class="diary-prev">‹ 이전 장</button>
          <span class="diary-count"></span>
          <button class="diary-next">다음 장 ›</button>
        </div>
        <button class="diary-close">닫기 (Esc)</button>
      </div>`;
    this.wrap.classList.remove('hidden');
    this.isOpen = true;
    this._render();
    // 표지가 넘어가며 펼쳐짐
    requestAnimationFrame(() => requestAnimationFrame(() => this.wrap.querySelector('.diary-book').classList.add('opened')));
  }

  close() {
    this.wrap.classList.add('hidden');
    this.isOpen = false;
  }

  /** 한 장 넘기기: 종이 한 장이 책등을 축으로 실제처럼 휘며 넘어간다 */
  turn(dir) {
    if (this._flipping) return;
    const max = Math.ceil(this.entries.length / 2) - 1;
    const next = Math.max(0, Math.min(max, this.spread + dir));
    if (next === this.spread) return;
    const e = this.entries;
    const book = this.wrap.querySelector('.diary-book');
    const L = this.wrap.querySelector('.diary-page.left');
    const R = this.wrap.querySelector('.diary-page.right');
    const cur = this.spread * 2;
    const nxt = next * 2;
    // 넘어가는 종이: 앞면 = 지금 보이는 쪽, 뒷면 = 넘긴 뒤 반대편에 올 쪽
    const leaf = document.createElement('div');
    leaf.className = `flip-leaf ${dir > 0 ? 'to-left' : 'to-right'}`;
    leaf.innerHTML = `<div class="leaf-face front diary-page ${dir > 0 ? 'right' : 'left'}">${this._page(e[dir > 0 ? cur + 1 : cur])}</div>
      <div class="leaf-face back diary-page ${dir > 0 ? 'left' : 'right'}">${this._page(e[dir > 0 ? nxt : nxt + 1])}</div>
      <i class="leaf-shade"></i>`;
    book.appendChild(leaf);
    // 종이 아래로 드러나는 쪽은 미리 다음 내용으로
    if (dir > 0) R.innerHTML = this._page(e[nxt + 1]);
    else L.innerHTML = this._page(e[nxt]);
    this._flipping = true;
    this.spread = next;
    requestAnimationFrame(() => requestAnimationFrame(() => leaf.classList.add('go')));
    setTimeout(() => {
      leaf.remove();
      this._flipping = false;
      this._render();
    }, 950);
  }

  _page(entry) {
    if (!entry) return '<div class="diary-empty"></div>';
    return `
      <div class="diary-date">${esc(entry.date)}</div>
      ${entry.lines.map((l, i) => `<p style="transform:rotate(${((i * 37) % 5) * 0.25 - 0.5}deg)">${ink(l)}</p>`).join('')}
      ${entry.blood ? '<i class="diary-blood b1"></i><i class="diary-blood b2"></i><i class="diary-print"></i>' : ''}`;
  }

  _render() {
    const e = this.entries;
    const i = this.spread * 2;
    this.wrap.querySelector('.diary-page.left').innerHTML = this._page(e[i]);
    this.wrap.querySelector('.diary-page.right').innerHTML = this._page(e[i + 1]);
    const max = Math.ceil(e.length / 2);
    this.wrap.querySelector('.diary-count').textContent = `${this.spread + 1} / ${max}`;
    this.wrap.querySelector('.diary-prev').disabled = this.spread === 0;
    this.wrap.querySelector('.diary-next').disabled = this.spread === max - 1;
  }

  handleKey(e) {
    if (!this.isOpen) return false;
    if (e.code === 'Escape' || e.code === 'KeyE') this.close();
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') this.turn(1);
    else if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.turn(-1);
    e.preventDefault();
    return true;
  }
}

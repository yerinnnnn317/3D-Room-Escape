// =============================================================
// ui/bookshelf.js
// 책장을 조사하면 열리는 "책장 앞" 화면.
// - 나무 책장 한 칸에 책들이 꽂혀 있고, 빨간 책 세 권의 책등엔 금박 숫자 Ⅰ Ⅱ Ⅲ
//   (왼쪽부터 Ⅰ → Ⅱ → Ⅲ 순서로 꽂혀 있음)
// - 책을 누르면 윗부분이 앞으로 기울며 살짝 꺼내지고, 아래 종이에 제목과 내용이 나온다
// - 금박 책 세 권 제목의 마지막 글자를 이으면 다음 장소(서·랍·속)가 된다 — 정답 판정 없음
// 책 목록은 scenario.json의 "bookshelf"에서 불러온다.
// 닫기: Esc, E, 바깥 클릭, 닫기 버튼
// =============================================================
import { gameState } from '../game/gameState.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export class Bookshelf {
  /** @param {HTMLElement} root @param {{ onPull?: ()=>void }} opts */
  constructor(root, opts = {}) {
    this.opts = opts;
    this.wrap = document.createElement('div');
    this.wrap.className = 'books-wrap hidden';
    root.appendChild(this.wrap);
    this.wrap.addEventListener('click', (e) => {
      if (e.target === this.wrap || e.target.closest('.books-close')) return this.close();
      const b = e.target.closest('[data-book]');
      if (b) this._look(+b.dataset.book, b);
    });
    this.isOpen = false;
  }

  open() {
    const data = gameState.scenario.bookshelf;
    this.wrap.innerHTML = `
      <div class="books">
        <p class="books-intro">${esc(data.intro)}</p>
        <div class="bs-case">
          <div class="shelf">
            ${data.books
              .map((b, i) => {
                const h = b.num ? 236 : 168 + ((i * 41) % 52);
                const w = b.num ? 64 : 40 + ((i * 23) % 22);
                return `
              <button class="spine${b.num ? ' red' : ''}" data-book="${i}" style="--c:${b.color};height:${h}px;width:${w}px">
                ${b.num ? `<span class="spine-num">${b.num}</span>` : ''}
                <span class="spine-title">${esc(b.title)}</span>
                <span class="spine-author">${esc(b.author)}</span>
              </button>`;
              })
              .join('')}
            <div class="bs-bookend"></div>
          </div>
          <div class="shelf-board"></div>
        </div>
        <div class="bs-msg"></div>
        <button class="books-close">닫기 (Esc)</button>
      </div>`;
    this.wrap.classList.remove('hidden');
    this.isOpen = true;
  }

  /** 책을 살짝 꺼내 보고 제목·내용을 아래 종이에 보여줌 */
  _look(i, el) {
    const b = gameState.scenario.bookshelf.books[i];
    this.wrap.querySelectorAll('.spine.pulled').forEach((s) => s !== el && s.classList.remove('pulled'));
    el.classList.toggle('pulled');
    this.opts.onPull?.();
    this.wrap.querySelector('.bs-msg').innerHTML = `<b>${b.num ? `${b.num} · ` : ''}『${esc(b.title)}』</b> <small>${esc(b.author)}</small><br>${esc(b.page)}`;
  }

  close() {
    this.wrap.classList.add('hidden');
    this.isOpen = false;
  }

  handleKey(e) {
    if (!this.isOpen) return false;
    if (e.code === 'Escape' || e.code === 'KeyE') this.close();
    e.preventDefault();
    return true;
  }
}

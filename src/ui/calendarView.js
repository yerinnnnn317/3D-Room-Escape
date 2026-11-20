// =============================================================
// ui/calendarView.js
// 벽 달력을 클릭하면 달력이 화면에 크게 뜬다. (설명 글 없이 직접 보고 찾게)
// 그림은 scene/calendarTexture.js — 3D 벽 달력과 같은 그림.
// 닫기: Esc, E, 바깥 클릭, 닫기 버튼
// =============================================================
import { drawCalendar } from '../scene/calendarTexture.js';

export class CalendarView {
  constructor(root) {
    this.wrap = document.createElement('div');
    this.wrap.className = 'calview-wrap hidden';
    this.wrap.innerHTML = `
      <div class="calview">
        <i class="calview-nail"></i>
        <canvas width="600" height="800"></canvas>
      </div>
      <button class="calview-close">닫기 (Esc)</button>`;
    root.appendChild(this.wrap);
    drawCalendar(this.wrap.querySelector('canvas'));
    document.fonts?.ready.then(() => drawCalendar(this.wrap.querySelector('canvas')));
    this.wrap.addEventListener('click', (e) => {
      if (e.target === this.wrap || e.target.closest('.calview-close')) this.close();
    });
    this.wrap.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.isOpen = false;
  }

  open() {
    this.wrap.classList.remove('hidden');
    this.isOpen = true;
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

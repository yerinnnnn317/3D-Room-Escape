// =============================================================
// ui/inventory.js
// 오른쪽 인벤토리 패널.
// gameState의 'change' / 'item' 이벤트를 받아 목록을 다시 그린다.
// 새로 얻은 아이템은 잠깐 반짝인다.
// =============================================================
import { gameState } from '../game/gameState.js';
import { listInventory } from '../game/items.js';

export class Inventory {
  constructor(root) {
    this.el = document.createElement('div');
    this.el.className = 'inventory';
    root.appendChild(this.el);
    this.fresh = null;

    gameState.addEventListener('item', (e) => {
      this.fresh = e.detail.itemId;
      setTimeout(() => {
        this.fresh = null;
        this.render();
      }, 2500);
    });
    gameState.addEventListener('change', () => this.render());
    this.render();
  }

  render() {
    const items = listInventory();
    this.el.innerHTML =
      `<div class="inv-title">소지품</div>` +
      (items.length
        ? items
            .map(
              (it) => `<div class="inv-item ${it.id === this.fresh ? 'fresh' : ''}">
                 <div class="inv-name">${it.name}</div>
                 <div class="inv-desc">${it.description}</div>
               </div>`
            )
            .join('')
        : `<div class="inv-empty">아무것도 없다</div>`);
  }
}

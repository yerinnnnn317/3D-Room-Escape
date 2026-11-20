// =============================================================
// game/items.js
// 아이템 정보 조회 도우미.
// 아이템 데이터는 scenario.json의 "items"에 있고,
// 여기서는 이름/설명을 꺼내거나 "획득 메시지"를 만들어 준다.
// (인벤토리 자체의 상태는 gameState.js가 관리한다)
// =============================================================
import { gameState } from './gameState.js';

export function getItem(itemId) {
  return gameState.scenario.items[itemId] ?? { name: itemId, description: '' };
}

export function getItemName(itemId) {
  return getItem(itemId).name;
}

/** "[획득] 녹슨 열쇠" 같은 줄 목록 */
export function gainedLines(itemIds = []) {
  return itemIds.map((id) => `[획득] ${getItemName(id)}`);
}

/** 현재 인벤토리를 {id, name, description} 배열로 */
export function listInventory() {
  return gameState.state.inventory.map((id) => ({ id, ...getItem(id) }));
}

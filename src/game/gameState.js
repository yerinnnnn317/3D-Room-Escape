// =============================================================
// game/gameState.js
// 게임의 "유일한 진실". 상태 관리 + 규칙 + 정답 판정을 담당한다.
// - 관리하는 상태: 현재 방, 인벤토리, 발견한 단서, 열린 장치, 남은 시간, 힌트 사용 횟수
// - 상태가 바뀌면 이벤트를 발생시켜 UI가 스스로 갱신하게 한다.
//     'change' : 아무 상태 변화 (detail = 스냅샷)
//     'timer'  : 남은 초가 바뀜
//     'room'   : 방 이동 (detail = { roomId })
//     'item'   : 아이템 획득 (detail = { itemId })
//     'unlock' : 장치 열림 (detail = { id })
//     'open'   : 상자·궤짝 같은 소품을 열었음 (detail = { id, scare })
//     'clue'   : 모아야 할 단서를 새로 찾음 (detail = { lockId, found, total, complete })
//     'ending' : 게임 종료 (detail = { won, timeUsed })
//
// ⚠ 정답(solutions)은 이 파일의 모듈 스코프 변수에만 존재한다.
//   - 다른 모듈은 gameState.scenario(정답이 빠진 사본)만 사용한다.
//   - window에 붙이지 않고, console.log 하지 않는다.
//   - AI 게임 마스터에는 getSummaryForAI() 요약만 전달한다.
// =============================================================
import scenarioRaw from '../data/scenario.json';

// ---------- 정답: 이 모듈 밖으로 절대 내보내지 않는다 ----------
const SOLUTIONS = Object.freeze({ ...scenarioRaw.solutions });

function deepFreeze(o) {
  Object.values(o).forEach((v) => v && typeof v === 'object' && deepFreeze(v));
  return Object.freeze(o);
}
const { solutions: _omit, ...publicPart } = scenarioRaw;
const PUBLIC_SCENARIO = deepFreeze(JSON.parse(JSON.stringify(publicPart)));

class GameState extends EventTarget {
  constructor() {
    super();
    this.scenario = PUBLIC_SCENARIO; // 정답 없는 시나리오
    this.reset();
  }

  reset() {
    const m = this.scenario.meta;
    this._s = {
      status: 'ready', // ready | playing | won | lost
      currentRoom: m.startRoom,
      visitedRooms: [m.startRoom],
      inventory: [],
      cluesFound: [], // 조사한 단서 interactable id
      unlocked: [], // 열린 장치 id
      timeLeft: m.timeLimitSec,
      hintsUsed: 0,
      failedAttempts: 0,
      taken: [], // 한 번이라도 주운 아이템 (다시 안 주도록)
      opened: [], // 열어 본 상자·궤짝 등 (퍼즐과 무관한 소품)
    };
    this._lastSecond = Math.ceil(this._s.timeLeft);
  }

  /** UI가 읽기 위한 복사본 */
  get state() {
    return structuredClone(this._s);
  }
  get status() {
    return this._s.status;
  }
  get timeLeft() {
    return this._s.timeLeft;
  }
  get maxHints() {
    return this.scenario.meta.maxHints;
  }

  // ---------------- 흐름 ----------------
  start() {
    if (this._s.status !== 'ready') return;
    this._s.status = 'playing';
    this._emit('change');
  }

  tick(dt) {
    if (this._s.status !== 'playing') return;
    this._s.timeLeft = Math.max(0, this._s.timeLeft - dt);
    const sec = Math.ceil(this._s.timeLeft);
    if (sec !== this._lastSecond) {
      this._lastSecond = sec;
      this._emit('timer', { timeLeft: sec });
    }
    if (this._s.timeLeft <= 0) this._end(false);
  }

  setRoom(roomId) {
    if (roomId === this._s.currentRoom || !this.scenario.rooms[roomId]) return;
    const firstVisit = !this._s.visitedRooms.includes(roomId);
    if (firstVisit) this._s.visitedRooms.push(roomId);
    this._s.currentRoom = roomId;
    this._emit('room', { roomId, firstVisit });
    this._emit('change');
  }

  // ---------------- 조회 ----------------
  hasItem(id) {
    return this._s.inventory.includes(id);
  }
  isUnlocked(id) {
    return this._s.unlocked.includes(id);
  }
  getDef(id) {
    return this.scenario.interactables[id] ?? null;
  }

  // ---------------- 행동 ----------------
  /** 단서 조사. 결과 텍스트와 새로 얻은 아이템을 돌려준다. */
  inspect(id) {
    const def = this.getDef(id);
    if (!def) return null;
    const res = { title: def.name, text: def.text ?? '', gained: [] };
    // 열 수 있는 소품: 처음엔 열리는 연출 + openText, 그다음부턴 textAfter
    if (def.opens) {
      if (!this._s.opened.includes(id)) {
        this._s.opened.push(id);
        res.text = def.openText ?? def.text;
        res.opened = true;
        this._emit('open', { id, scare: !!def.scare });
      } else {
        res.text = def.textAfter ?? def.openText ?? def.text;
      }
    }
    let isNew = false;
    if (def.type !== 'prop' && !this._s.cluesFound.includes(id)) {
      this._s.cluesFound.push(id);
      isNew = true;
    }
    let newItem = null;
    if (def.givesItem) {
      if (this.hasItem(def.givesItem) || this._s.taken.includes(def.givesItem)) {
        res.text = def.textAfter ?? def.text;
      } else {
        this._addItem(def.givesItem);
        res.gained.push(def.givesItem);
        newItem = def.givesItem;
      }
    }
    // 모아야 할 단서를 새로 찾았으면 진행도 알림 (예: '단서 3 / 6')
    const prog = (isNew && this._clueCountFor(id, null)) || (newItem && this._clueCountFor(null, newItem));
    if (prog) {
      res.clue = prog;
      this._emit('clue', prog);
    }
    this._emit('change');
    return res;
  }

  // ---------------- 단서 모으기 (방마다 정해진 단서를 다 찾아야 문을 열 수 있음) ----------------
  /** 이 자물쇠(문)에 필요한 단서 목록과 찾았는지 여부 */
  clueProgress(lockId) {
    const set = this.scenario.clueSets?.[lockId];
    if (!set) return null;
    const clues = set.clues.map((c) => ({
      ...c,
      // item: 아이템을 얻으면 / unlock: 잠금을 풀면(휴대폰·책장·궤짝) / 그 외: 조사하면 찾은 것
      found: c.item ? this._s.taken.includes(c.item) : c.unlock ? this.isUnlocked(c.id) : this._s.cluesFound.includes(c.id),
    }));
    const found = clues.filter((c) => c.found).length;
    return { ...set, clues, found, total: clues.length, complete: found === clues.length };
  }

  /** 지금 있는 방에서 아직 안 열린 문의 단서 진행도 (HUD 표시용) */
  currentClueProgress() {
    const entry = Object.entries(this.scenario.clueSets ?? {}).find(([id, set]) => set.room === this._s.currentRoom && !this.isUnlocked(id));
    return entry ? { lockId: entry[0], ...this.clueProgress(entry[0]) } : null;
  }

  /** 방금 조사한 것이 '모아야 할 단서'였는지 → 새로 찾았으면 진행도를 돌려줌 */
  _clueCountFor(id, item) {
    for (const [lockId, set] of Object.entries(this.scenario.clueSets ?? {})) {
      if (set.clues.some((c) => (id && c.id === id && !c.unlock) || (item && c.item === item))) {
        const p = this.clueProgress(lockId);
        return { lockId, title: set.title, found: p.found, total: p.total, complete: p.complete };
      }
    }
    return null;
  }

  /** 비밀번호 장치 판정. 정답 비교는 오직 여기서만 한다. */
  submitCode(deviceId, input) {
    const def = this.getDef(deviceId);
    // 정답이 정해진 장치만 번호를 받는다 (문 쪽지·휴대폰 잠금·책장 순서·문 자물쇠 등)
    if (!def || !(deviceId in SOLUTIONS)) return { ok: false, text: '여기에는 숫자를 넣을 곳이 없다.' };
    if (this._s.status !== 'playing') return { ok: false, text: '' };
    if (this.isUnlocked(deviceId)) return { ok: true, already: true, text: def.openedText, gained: [] };
    if (def.type === 'clueLock' && !this.clueProgress(deviceId)?.complete) {
      return { ok: false, text: '단서를 다 찾지 못했습니다.' };
    }

    const code = String(input ?? '').replace(/\D/g, '');
    const digits = def.digits ?? SOLUTIONS[deviceId].length;
    if (code.length !== digits) return { ok: false, text: `${digits}자리 숫자가 필요하다.` };

    if (code !== SOLUTIONS[deviceId]) {
      this._s.failedAttempts++;
      this._emit('change');
      return { ok: false, text: def.failText };
    }
    const gained = this._unlock(deviceId);
    if (def.isExit) this._end(true);
    return { ok: true, text: def.successText, gained };
  }

  /** 열쇠 장치에 아이템 사용 */
  useItem(deviceId) {
    const def = this.getDef(deviceId);
    if (!def || def.type !== 'keyLock') return { ok: false, text: '그건 여기에 쓸 수 없다.' };
    if (this.isUnlocked(deviceId)) return { ok: true, already: true, text: def.openedText, gained: [] };
    if (this._s.status !== 'playing') return { ok: false, text: '' };
    if (!this.hasItem(def.requiresItem)) {
      // 맞지 않는 열쇠를 들고 있으면 "이 열쇠는 아니다"라는 안내를 먼저 보여준다
      const wrong = Object.entries(def.wrongKeyText ?? {}).find(([item]) => this.hasItem(item));
      return { ok: false, text: wrong ? wrong[1] : def.lockedText };
    }

    // 열쇠는 사용하면 사라진다
    this._s.inventory = this._s.inventory.filter((i) => i !== def.requiresItem);
    const gained = this._unlock(deviceId);
    if (def.isExit) this._end(true);
    return { ok: true, text: def.successText, gained };
  }

  /** 힌트 사용 (최대 maxHints회). 아직 안 열린 첫 장치에 대한 힌트를 준다. */
  useHint() {
    if (this._s.status !== 'playing') return { ok: false, text: '' };
    if (this._s.hintsUsed >= this.maxHints) return { ok: false, text: '더 이상 속삭임은 들리지 않는다. (힌트 소진)' };
    // 지금 방에서 아직 못 찾은 단서 하나의 위치를 알려 준다
    const p = this.currentClueProgress();
    if (!p) return { ok: false, text: '이제 나가기만 하면 된다.' };
    let text;
    if (p.complete) text = `단서는 모두 모았다. ${this.getDef(p.lockId).name}으로 가서 단서를 조합해 봐.`;
    else {
      const miss = p.clues.find((c) => !c.found);
      text = `아직 못 찾은 단서가 있다… '${miss.where}'을(를) 살펴봐.`;
    }
    this._s.hintsUsed++;
    this._emit('change');
    return { ok: true, text, left: this.maxHints - this._s.hintsUsed };
  }

  // ---------------- AI용 요약 (정답 절대 포함 X) ----------------
  getSummaryForAI() {
    const s = this._s;
    const sc = this.scenario;
    const targets = Object.entries(sc.interactables)
      .filter(([, d]) => d.room === s.currentRoom)
      .map(([id, d]) => ({ id, name: d.name, aliases: d.aliases ?? [], type: d.type, unlocked: this.isUnlocked(id) }));
    return {
      room: { id: s.currentRoom, name: sc.rooms[s.currentRoom].name },
      status: s.status,
      timeLeftSec: Math.ceil(s.timeLeft),
      hintsLeft: this.maxHints - s.hintsUsed,
      inventory: s.inventory.map((id) => ({ id, name: sc.items[id].name })),
      foundClues: s.cluesFound.map((id) => ({ id, name: sc.interactables[id].name })),
      openedDevices: s.unlocked.map((id) => sc.interactables[id].name),
      clueProgress: this.currentClueProgress() && { found: this.currentClueProgress().found, total: this.currentClueProgress().total },
      targets,
    };
  }

  // ---------------- 내부 ----------------
  _addItem(itemId) {
    if (this.hasItem(itemId)) return;
    this._s.inventory.push(itemId);
    this._s.taken.push(itemId);
    this._emit('item', { itemId });
  }

  _unlock(id) {
    const def = this.getDef(id);
    this._s.unlocked.push(id);
    const gained = [];
    // 열리면 나오는 아이템 (하나면 givesItemOnOpen, 여러 개면 givesItemsOnOpen)
    const items = def.givesItemsOnOpen ?? (def.givesItemOnOpen ? [def.givesItemOnOpen] : []);
    for (const it of items) {
      this._addItem(it);
      gained.push(it);
    }
    this._emit('unlock', { id });
    // 잠금을 풀어야 찾은 것으로 치는 단서(휴대폰·책장·궤짝)면 진행도 알림
    for (const [lockId, set] of Object.entries(this.scenario.clueSets ?? {})) {
      if (set.clues.some((c) => c.unlock && c.id === id)) {
        const p = this.clueProgress(lockId);
        this._emit('clue', { lockId, title: set.title, found: p.found, total: p.total, complete: p.complete });
      }
    }
    this._emit('change');
    return gained;
  }

  _end(won) {
    if (this._s.status !== 'playing') return;
    this._s.status = won ? 'won' : 'lost';
    const timeUsed = Math.round(this.scenario.meta.timeLimitSec - this._s.timeLeft);
    this._emit('ending', { won, timeUsed, hintsUsed: this._s.hintsUsed, clues: this._s.cluesFound.length });
    this._emit('change');
  }

  _emit(type, detail = {}) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }
}

export const gameState = new GameState();

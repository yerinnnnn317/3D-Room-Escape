// =============================================================
// game/puzzles.js
// 플레이어 행동 → 게임 규칙 연결 담당.
// - interact(id)     : E 키로 물체를 조사했을 때 (대화창/키패드 띄우기)
// - handleAction(a)  : 채팅(AI 게임 마스터)이 해석한 행동 {type, target, value} 처리
// 실제 정답 판정·상태 변경은 전부 gameState.js에 맡기고,
// 여기서는 "어떤 UI를 띄울지"와 "결과를 어떤 모양으로 돌려줄지"만 정한다.
// =============================================================
import { gameState } from './gameState.js';
import { gainedLines, getItemName } from './items.js';

export class Puzzles {
  /** @param {{ dialog: import('../ui/dialog.js').Dialog }} deps */
  constructor({ dialog, phone, bookshelf, diary, clueBoard, calendarView }) {
    this.calendarView = calendarView; // 달력 크게 보기 (ui/calendarView.js)
    this.clueBoard = clueBoard; // 단서 수첩 (ui/clueBoard.js)
    this.diary = diary; // 일기장 화면 (ui/diary.js)
    this.dialog = dialog;
    this.phone = phone; // 피해자 휴대폰 화면 (ui/phone.js)
    this.bookshelf = bookshelf; // 책장 화면 (ui/bookshelf.js)
  }

  def(id) {
    return gameState.getDef(id);
  }

  // ---------------- E 키 조사 ----------------
  interact(id) {
    const def = this.def(id);
    if (!def || gameState.status !== 'playing') return;

    if (def.type === 'clue' || def.type === 'prop') {
      const r = gameState.inspect(id);
      this.dialog.show(r.title, [r.text, ...gainedLines(r.gained)].join('\n'));
      return;
    }

    // 들어온 문: 이미 잠겨서 안 열림 (설명만)
    if (def.type === 'entryLock') return this.dialog.show(def.name, def.text);

    if (def.type === 'bookshelf') {
      gameState.inspect(id);
      this.bookshelf?.open();
      return;
    }

    // 달력: 설명 글 없이 달력을 크게 띄워 직접 보게 함
    if (def.type === 'calendar') {
      gameState.inspect(id);
      this.calendarView?.open();
      return;
    }

    if (def.type === 'diary') {
      gameState.inspect(id);
      this.diary?.open();
      return;
    }

    if (def.type === 'phone') {
      gameState.inspect(id);
      this.phone?.open();
      return;
    }

    if (def.type === 'codeLock') {
      if (gameState.isUnlocked(id)) return this.dialog.show(def.name, def.openedText);
      this.openKeypad(id);
      return;
    }

    // 문: 이 방의 단서를 다 모았는지 보여주고, 다 모았으면 조합 → 번호 입력
    if (def.type === 'clueLock') {
      if (gameState.isUnlocked(id)) return this.dialog.show(def.name, def.openedText);
      this.clueBoard?.open(id);
      return;
    }

    if (def.type === 'keyLock') {
      if (gameState.isUnlocked(id)) return this.dialog.show(def.name, def.openedText);
      // 맞는 열쇠를 갖고 있으면 [열쇠 사용하기] 버튼을 보여주고, 눌러야 연다
      if (gameState.hasItem(def.requiresItem)) {
        const keyName = getItemName(def.requiresItem);
        this.dialog.show(def.name, `${def.lockedText}\n소지품에 ${keyName}가 있다.`, {
          actions: [
            {
              label: `🗝 ${keyName} 사용하기`,
              onClick: () => {
                const r = gameState.useItem(id);
                this.dialog.show(def.name, [r.text, ...gainedLines(r.gained)].join('\n'));
              },
            },
          ],
        });
      } else {
        this.dialog.show(def.name, def.lockedText);
      }
    }
  }

  openKeypad(id, prompt) {
    const def = this.def(id);
    this.dialog.openKeypad({
      title: def.name,
      text: prompt ?? def.lockedText,
      digits: def.digits,
      // 정답 비교는 gameState가 한다. 키패드는 입력만 전달.
      onSubmit: (code) => {
        const r = gameState.submitCode(id, code);
        return { ok: r.ok, text: [r.text, ...gainedLines(r.gained)].join('\n') };
      },
    });
  }

  // ---------------- 채팅 행동 ----------------
  /**
   * @param {{type:'inspect'|'use'|'input'|'talk', target?:string|null, value?:string}} action
   * @returns {{kind:string, ok:boolean, targetName?:string, text:string}}
   */
  handleAction(action) {
    if (gameState.status !== 'playing') return { kind: 'blocked', ok: false, text: '이미 끝난 밤이다.' };
    if (!action || action.type === 'talk') return { kind: 'talk', ok: true, text: '' };

    const def = action.target ? this.def(action.target) : null;
    if (!def) return { kind: 'unknown', ok: false, text: '' };
    if (def.room !== gameState.state.currentRoom) {
      return { kind: 'blocked', ok: false, targetName: def.name, text: `${def.name}은(는) 이 방에 없다.` };
    }
    const base = { targetName: def.name };

    switch (action.type) {
      case 'inspect': {
        if (def.type === 'phone') {
          const r = gameState.inspect(action.target);
          this.phone?.open();
          return { ...base, kind: 'inspect', ok: true, text: r.text };
        }
        if (def.type === 'diary') {
          const r = gameState.inspect(action.target);
          this.diary?.open();
          return { ...base, kind: 'inspect', ok: true, text: r.text };
        }
        if (def.type === 'calendar') {
          const r = gameState.inspect(action.target);
          this.calendarView?.open();
          return { ...base, kind: 'inspect', ok: true, text: r.text };
        }
        if (def.type === 'bookshelf') {
          const r = gameState.inspect(action.target);
          this.bookshelf?.open();
          return { ...base, kind: 'inspect', ok: true, text: r.text };
        }
        if (def.type === 'clue' || def.type === 'prop') {
          const r = gameState.inspect(action.target);
          return { ...base, kind: 'inspect', ok: true, text: [r.text, ...gainedLines(r.gained)].join(' ') };
        }
        const opened = gameState.isUnlocked(action.target);
        return { ...base, kind: 'inspect', ok: true, text: opened ? def.openedText : def.lockedText };
      }
      case 'use': {
        if (def.type === 'clueLock') return this.handleAction({ ...action, type: 'inspect' });
        if (def.type === 'keyLock') {
          const r = gameState.useItem(action.target);
          return { ...base, kind: r.ok ? 'unlock' : 'locked', ok: r.ok, text: [r.text, ...gainedLines(r.gained)].join(' ') };
        }
        if (def.type === 'clueLock') {
          if (gameState.isUnlocked(action.target)) return { ...base, kind: 'inspect', ok: true, text: def.openedText };
          this.clueBoard?.open(action.target);
          const p = gameState.clueProgress(action.target);
          return { ...base, kind: 'inspect', ok: true, text: p.complete ? '단서를 모두 모았다. 조합해 보자.' : `단서를 다 찾지 못했습니다. (${p.found} / ${p.total})` };
        }
        if (def.type === 'codeLock') {
          if (gameState.isUnlocked(action.target)) return { ...base, kind: 'inspect', ok: true, text: def.openedText };
          this.openKeypad(action.target);
          return { ...base, kind: 'keypad', ok: true, text: def.lockedText };
        }
        const r = gameState.inspect(action.target);
        return { ...base, kind: 'inspect', ok: true, text: r.text };
      }
      case 'input': {
        if (!['codeLock', 'clueLock', 'phone'].includes(def.type)) return { ...base, kind: 'fail', ok: false, text: '숫자를 넣을 곳이 보이지 않는다.' };
        const r = gameState.submitCode(action.target, action.value);
        return { ...base, kind: r.ok ? 'unlock' : 'fail', ok: r.ok, text: [r.text, ...gainedLines(r.gained)].join(' ') };
      }
      default:
        return { kind: 'unknown', ok: false, text: '' };
    }
  }
}

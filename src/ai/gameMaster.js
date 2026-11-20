// =============================================================
// ai/gameMaster.js
// AI 게임 마스터 연결 지점. (지금은 LLM 없이 "가짜 응답"으로 동작)
//
//   interpretAction(text, state) → { type: 'inspect'|'use'|'input'|'talk', target, value? }
//   narrate(result, state)       → 공포 분위기 문장(string)
//
// ▶ 나중에 실제 LLM API로 바꿀 때는 이 파일만 수정하면 된다.
//   - 두 함수의 이름, 인자, 반환 모양만 그대로 유지할 것 (둘 다 async).
//   - state 는 gameState.getSummaryForAI() 요약이다.
//     정답(solutions)은 들어 있지 않으며, 절대 프롬프트에 넣지 않는다.
//   - 정답 판정은 AI가 아니라 gameState.submitCode()가 코드로 한다.
//     AI는 "어떤 행동인지 해석"과 "결과 묘사"만 한다.
//   - LLM 응답의 target은 반드시 state.targets의 id 중 하나인지 검증할 것.
// =============================================================

// ---------- (참고) 실제 LLM 연결 시 사용할 프롬프트 뼈대 ----------
export function buildInterpretPrompt(text, state) {
  return [
    '너는 공포 방탈출 게임의 게임 마스터다. 플레이어 입력을 행동 JSON으로만 변환하라.',
    '형식: {"type":"inspect|use|input|talk","target":"<targets 중 id 또는 null>","value":"<숫자 또는 생략>"}',
    `현재 방: ${state.room.name}`,
    `조사 가능한 대상: ${state.targets.map((t) => `${t.id}(${t.name})`).join(', ')}`,
    `소지품: ${state.inventory.map((i) => i.name).join(', ') || '없음'}`,
    `플레이어 입력: ${text}`,
  ].join('\n');
}
// 예시:
// export async function interpretAction(text, state) {
//   const res = await fetch('/api/gm/interpret', { method: 'POST', body: JSON.stringify({ prompt: buildInterpretPrompt(text, state) }) });
//   const action = await res.json();
//   if (action.target && !state.targets.some((t) => t.id === action.target)) action.target = null;
//   return action;
// }

// ---------- 가짜 구현 ----------
const VERBS = {
  use: ['사용', '쓴다', '써', '꽂', '넣어', '연다', '열어', '열기', '열자', '열래', '돌려', '따'],
  inspect: ['조사', '살펴', '본다', '봐', '보자', '확인', '뒤져', '검사', '읽', '만져', '찾아', '들여다'],
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

function matchTarget(text, targets) {
  let best = null;
  let bestLen = 0;
  for (const t of targets) {
    for (const word of [t.name, ...t.aliases]) {
      if (word && text.includes(word) && word.length > bestLen) {
        best = t;
        bestLen = word.length;
      }
    }
  }
  return best;
}

export async function interpretAction(text, state) {
  await wait(250); // 네트워크 응답처럼 보이게
  const t = text.trim();
  const target = matchTarget(t, state.targets);
  const num = t.match(/\d{3,8}/);

  if (num) {
    const codeTarget =
      target?.type === 'codeLock' || target?.type === 'clueLock'
        ? target
        : state.targets.find((x) => (x.type === 'codeLock' || x.type === 'clueLock') && !x.unlocked) ?? target;
    return { type: 'input', target: codeTarget?.id ?? null, value: num[0] };
  }
  if (VERBS.use.some((v) => t.includes(v)) && target) return { type: 'use', target: target.id };
  if (target || VERBS.inspect.some((v) => t.includes(v))) return { type: 'inspect', target: target?.id ?? null };
  return { type: 'talk', target: null };
}

const OPENERS = {
  inspect: ['손전등 빛이 가늘게 떨린다.', '등 뒤에서 마룻바닥이 한 번 삐걱거린다.', '숨을 죽이고 가까이 다가간다.', '차가운 공기가 목덜미를 스친다.'],
  unlock: ['무언가 풀려나는 소리가 어둠 속에 길게 울린다.', '심장이 한 박자 늦게 뛴다.', '멀리서 누군가 웃은 것 같다.'],
  fail: ['틀렸다. 그리고 무언가가 그것을 알아챘다.', '정적이 조금 더 무거워졌다.'],
  locked: ['꿈쩍도 하지 않는다.', '손잡이가 차갑게 손바닥을 밀어낸다.'],
  keypad: ['숫자판 위에 마른 피가 엉겨 있다.'],
  blocked: ['그건 여기 없다. 여기 있는 건… 너와 다른 무언가뿐이다.'],
};
const TALK = [
  '…대답은 없다. 다만 벽 너머에서 누군가 숨을 고르는 소리가 들린다.',
  '네 목소리가 천장에 부딪혀 낯선 목소리로 돌아온다.',
  '전구가 지직거린다. 마치 대답하려는 것처럼.',
];

export async function narrate(result, state) {
  await wait(200);
  const left = state.timeLeftSec;
  const clock = left < 180 ? ' 시간이 얼마 남지 않았다.' : '';

  if (result.kind === 'talk') return pick(TALK) + clock;
  if (result.kind === 'unknown') {
    const names = state.targets.map((t) => t.name).join(', ');
    return `어둠은 네 말을 이해하지 못한다. (이 방에서 살펴볼 수 있는 것: ${names})`;
  }
  const opener = pick(OPENERS[result.kind] ?? OPENERS.inspect);
  return `${opener} ${result.text}${clock}`.trim();
}

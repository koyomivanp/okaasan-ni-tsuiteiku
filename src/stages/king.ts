import { kingStart, nestStart } from "../route.ts";
import { bestPocket, hash01 } from "./common.ts";
import type { StageLogic } from "./types.ts";

// ---- 調整用の数値 ----
// 王の間の扉の位置（王の間の入口からの距離）。お母さんはここで檻に捕まる
export const DOOR = 9;
// 王の立つ位置（扉からさらに奥）
export const KING_BEHIND = 2;
// 王の間で動ける横の幅（片側）
export const KING_BOUND = 1.3;
// 戦うあいだ、お母さんの何歩うしろに立つか。迫ってくるものを見て考える距離になる
const STAND_BACK = 4.5;
// 集める鍵の数
export const KEYS_TO_WIN = 3;
// 檻が落ちてから最初の攻撃までの秒数
const INTRO = 1.8;
// 鍵を取ったあと、次の攻撃までに空ける秒数
const KEY_PAUSE = 0.9;
// 段階ごとの攻撃（鍵を取るほど強くなる）：攻撃の間隔（秒）、波の速さ、すき間の半分の幅
const PHASES = [
  { every: 2.3, speed: 3.4, gap: 0.5 },
  { every: 2.1, speed: 3.8, gap: 0.42 },
  { every: 1.9, speed: 4.2, gap: 0.36 },
];
// 呪いの波のすき間の位置（順番に使う）と、波の厚み（当たり判定）
const GAPS = [-0.75, 0.6, -0.2, 0.85, -0.65, 0.2, 0.8, -0.85];
const WAVE_ALONG = 0.2;
// 波のすき間の端にどれだけ余裕を持たせるか（子どもの体の幅）
const WAVE_MARGIN = 0.1;
// 呪いのビーム（第2段階から）：波が通り過ぎてから撃つまでの秒数、予告の秒数、当たる秒数、半分の幅
const BEAM_DELAY = 0.1;
export const BEAM_WARN = 0.65;
export const BEAM_LIVE = 0.4;
export const BEAM_HALF = 0.26;
// 大岩（第3段階）：波から遅れて転がり出す秒数、速さ、半径
const BOULDER_DELAY = 0.8;
const BOULDER_SPEED = 3.2;
export const BOULDER_RADIUS = 0.45;
// 鍵：流れてくる速さ、拾える近さ（道に沿った方向・横方向）、取りそこねてから次が出るまでの秒数
// ビームと大岩：出てくる範囲（片側）、ビームと大岩を離す距離（間に通り道が残る幅）、
// 同じ種類が前回からずれる最低の距離（すべて横位置）
const SHOT_REACH = 1.15;
const SHOT_APART = 1.25;
const SHOT_MOVE = 0.7;
const KEY_SPEED = 2;
const KEY_ALONG = 0.3;
const KEY_SIDE = 0.32;
const KEY_MISS = 0.6;
// 鍵を取ってから次の鍵が出るまでの秒数と、最初の鍵が出るまでの秒数（各段階の攻撃を味わう時間）
const KEY_REST = 3;
const KEY_FIRST = 2.3;
const KEY_SPOTS = [0.8, -0.8, 0.1, -0.45, 1, -1, 0.45];
// 反撃：檻が壊れてからお母さんが飛ぶまで・飛ぶ秒数、きょうだいが飛び始めるまで・飛ぶ秒数、
// きょうだいの間隔の上限、飛びつき終えるまでの幅、王の上から戻り始めるまで・戻る秒数、扉へ歩き出すまで
const MOM_LEAP_AT = 0.45;
const MOM_LEAP = 0.4;
const CHICK_LEAP_AT = 0.95;
const CHICK_LEAP = 0.38;
const CHICK_STEP = 0.09;
const CHICK_SPREAD = 0.85;
export const RUSH_BACK_AT = 2.55;
const RUSH_BACK = 0.55;
export const RUSH_TIME = 3.2;

export const CURSED = "王の呪いのビームに当たってしまった😿";
export const WASHED = "呪いの波にのまれてしまった😿";
export const CRUSHED = "大岩につぶされてしまった😿";

export type Wave = { kind: "wave"; born: number; speed: number; gap: number; half: number };
export type Beam = { kind: "beam"; born: number; lateral: number; turn: number };
export type Boulder = { kind: "boulder"; born: number; lateral: number; turn: number };
type Hazard = Wave | Beam | Boulder;

type Fight = {
  start: number;
  front: number;
  got: number;
  beat: number;
  nextBeat: number;
  hazards: Hazard[];
  key: { born: number; lateral: number } | null;
  nextKey: number;
  seed: number;
  shots: number;
  lastLane: { beam: number; boulder: number };
  rush: number | null;
  won: number | null;
};

let fight: Fight | null = null;
let clock = -Infinity;
let keySpot = 0;

// Everything comes down the hall from the door.
const line = () => kingStart + DOOR - 0.2;

export function kingFight(): Fight | null {
  return fight;
}

export function waveS(wave: Wave, time: number): number {
  return line() - wave.speed * (time - wave.born);
}

export function boulderS(boulder: Boulder, time: number): number {
  return line() - BOULDER_SPEED * (time - boulder.born);
}

export function keyS(key: { born: number }, time: number): number {
  return line() - KEY_SPEED * (time - key.born);
}

export function beamState(beam: Beam, time: number): { state: "wait" | "warn" | "live" | "done"; t: number } {
  const t = time - beam.born;
  if (t < 0) return { state: "wait", t: 0 };
  if (t < BEAM_WARN) return { state: "warn", t: t / BEAM_WARN };
  if (t < BEAM_WARN + BEAM_LIVE) return { state: "live", t: (t - BEAM_WARN) / BEAM_LIVE };
  return { state: "done", t: 1 };
}

export function kingCaged(time: number): boolean {
  return fight !== null && time >= fight.start && !kingWon(time) && (fight.rush === null || time < fight.rush + MOM_LEAP_AT);
}

// The line behind shuffles anxiously while mom is caged.
export function kingAnxious(time: number): boolean {
  return kingCaged(time);
}

export function kingWon(time: number): boolean {
  return fight !== null && fight.won !== null && time >= fight.won;
}

// Seconds since the last key broke the cage, while the family is piling onto the king.
export function kingRush(time: number): number | null {
  if (!fight || fight.rush === null || fight.won === null || time >= fight.won) return null;
  return time - fight.rush;
}

function leapStart(order: number, count: number): number {
  if (order === 0) return MOM_LEAP_AT;
  return CHICK_LEAP_AT + (order - 1) * Math.min(CHICK_STEP, CHICK_SPREAD / Math.max(1, count));
}

// When member `order` of the family (0 is mom) lands on the king.
export function leapImpact(order: number, count: number): number {
  return leapStart(order, count) + (order === 0 ? MOM_LEAP : CHICK_LEAP);
}

// 0 where the walk left them, 1 piled on the king.
export function leapAmount(rush: number, order: number, count: number): number {
  const a = Math.min(1, Math.max(0, (rush - leapStart(order, count)) / (order === 0 ? MOM_LEAP : CHICK_LEAP)));
  const back = Math.min(1, Math.max(0, (rush - RUSH_BACK_AT) / RUSH_BACK));
  return a * (1 - back);
}

// Where each one clings on, so the pile spreads over his robe and headdress.
export function leapTarget(order: number): { s: number; lateral: number; y: number } {
  if (order === 0) return { s: kingStart + DOOR + KING_BEHIND - 0.55, lateral: 0, y: 1.6 };
  return {
    s: kingStart + DOOR + KING_BEHIND - 0.5,
    lateral: ((order * 0.37) % 1) * 1.1 - 0.55,
    y: 0.7 + ((order * 0.53) % 1) * 1.3,
  };
}

function launch(next: Fight, time: number): void {
  const phase = PHASES[Math.min(next.got, PHASES.length - 1)];
  const gap = GAPS[next.beat % GAPS.length];
  const wave: Wave = { kind: "wave", born: time, speed: phase.speed, gap, half: phase.gap };
  next.hazards.push(wave);
  // Each wave passes the chick, then the next attack starts, so there is always a moment to cross.
  const passes = (line() - next.front) / phase.speed;
  if (next.got >= 1) {
    next.hazards.push({ kind: "beam", born: time + passes + BEAM_DELAY, lateral: Number.NaN, turn: next.beat });
  }
  if (next.got >= 2) {
    next.hazards.push({ kind: "boulder", born: time + BOULDER_DELAY, lateral: Number.NaN, turn: next.beat });
  }
  if (!next.key && time >= next.nextKey) {
    // Off to one side of this wave's gap, arriving between this wave and the next: slip through, then fetch it.
    for (let tries = 0; tries < KEY_SPOTS.length; tries++) {
      const pick = KEY_SPOTS[keySpot++ % KEY_SPOTS.length];
      if (Math.abs(pick - gap) > 0.7) {
        next.key = { born: time, lateral: pick };
        break;
      }
    }
  }
  next.beat += 1;
  next.nextBeat = time + phase.every;
}

// A fresh lane each fight: clear of whatever else is on its way, and away from where this kind last went.
function freeLane(next: Fight, taken: number[], last: number): number {
  let best = 0;
  let bestScore = -Infinity;
  for (let tries = 0; tries < 12; tries++) {
    const lane = (hash01(next.seed, next.shots++, 7) * 2 - 1) * SHOT_REACH;
    const apart = Math.min(SHOT_APART, ...taken.map((other) => Math.abs(lane - other)));
    const moved = Number.isNaN(last) ? SHOT_MOVE : Math.min(SHOT_MOVE, Math.abs(lane - last));
    if (apart >= SHOT_APART && moved >= SHOT_MOVE) return lane;
    const score = apart * 10 + moved;
    if (score > bestScore) {
      bestScore = score;
      best = lane;
    }
  }
  // Nothing drawn left a way through: the far wall always does.
  const gapFrom = (lane: number) => Math.min(SHOT_APART, ...taken.map((other) => Math.abs(lane - other)));
  if (gapFrom(best) >= SHOT_APART) return best;
  return gapFrom(SHOT_REACH) >= gapFrom(-SHOT_REACH) ? SHOT_REACH : -SHOT_REACH;
}

// Beams take turns: at the chick, over the key, then somewhere else to cut the floor in two.
// Boulders go elsewhere every other time and at the chick in between. Neither lands on the other.
function pickLane(next: Fight, hazard: Beam | Boulder, lateral: number, turn: number): number {
  const taken: number[] = [];
  for (const other of next.hazards) {
    if (other !== hazard && other.kind !== "wave" && !Number.isNaN(other.lateral)) taken.push(other.lateral);
  }
  const clear = (lane: number) => taken.every((other) => Math.abs(lane - other) >= SHOT_APART);
  const last = next.lastLane[hazard.kind];
  const fresh = (lane: number) => Number.isNaN(last) || Math.abs(lane - last) >= SHOT_MOVE;
  const mode = hazard.kind === "beam" ? turn % 3 : turn % 2 === 0 ? 2 : 0;
  let lane: number;
  if (mode === 0 && clear(lateral) && fresh(lateral)) lane = lateral;
  else if (mode === 1 && next.key && clear(next.key.lateral) && fresh(next.key.lateral)) lane = next.key.lateral;
  else lane = freeLane(next, taken, last);
  next.lastLane[hazard.kind] = lane;
  return lane;
}

function clearAfter(front: number, time: number): (hazard: Hazard) => boolean {
  return (hazard) => {
    if (hazard.kind === "wave") return waveS(hazard, time) > front - 1;
    if (hazard.kind === "boulder") return boulderS(hazard, time) > front - 1.2;
    return beamState(hazard, time).state !== "done";
  };
}

export const king: StageLogic = {
  steer: 3.4,
  grip: 0.6,
  brake: 0.16,
  bound: KING_BOUND,
  leash: KING_BOUND,
  loseGap: 6,
  strand: 1.1,
  scatter: 1,
  hint: "お母さんについていこう",
  // The lead stands still in the fight, so its footprints say nothing: the line copies its sidesteps instead.
  queued(s) {
    return s < kingStart + DOOR - STAND_BACK + 0.05;
  },
  // Hang back during the fight to see what is coming; close up again once the door is open.
  get follow() {
    return kingWon(clock) ? 0.78 : STAND_BACK;
  },
  liveHint(time) {
    if (!fight) return null;
    if (fight.rush !== null) return kingWon(time) ? "扉がひらいた！" : "みんなで王に飛びかかれ！";
    if (time < fight.start + INTRO) return "お母さんが捕まった！";
    return `すき間をくぐって、鍵を集めよう ${fight.got}/${KEYS_TO_WIN}`;
  },
  watch(front, _tail, time, lateral) {
    if (time < clock) {
      fight = null;
      keySpot = 0;
    }
    clock = time;
    if (!fight && front >= kingStart + DOOR - STAND_BACK - 0.25 && front < nestStart) {
      fight = { start: time, front, got: 0, beat: 0, nextBeat: time + INTRO, hazards: [], key: null, nextKey: time + INTRO + KEY_FIRST, seed: Math.floor(Math.random() * 0x7fffffff), shots: 0, lastLane: { beam: Number.NaN, boulder: Number.NaN }, rush: null, won: null };
    }
    if (!fight) return;
    fight.front = front;
    if (fight.rush !== null) return;
    // Beams and boulders pick their lane the moment they start.
    for (const hazard of fight.hazards) {
      if (hazard.kind !== "wave" && Number.isNaN(hazard.lateral) && time >= hazard.born) hazard.lateral = pickLane(fight, hazard, lateral, hazard.turn);
    }
    fight.hazards = fight.hazards.filter(clearAfter(front, time));
    if (time >= fight.nextBeat) launch(fight, time);
    const key = fight.key;
    if (!key) return;
    const along = keyS(key, time) - front;
    if (Math.abs(along) < KEY_ALONG && Math.abs(lateral - key.lateral) < KEY_SIDE) {
      fight.got += 1;
      fight.key = null;
      fight.nextKey = time + KEY_REST;
      fight.nextBeat = Math.max(fight.nextBeat, time + KEY_PAUSE);
      if (fight.got >= KEYS_TO_WIN) {
        fight.rush = time;
        fight.won = time + RUSH_TIME;
        fight.hazards = [];
      }
    } else if (along < -KEY_ALONG) {
      fight.key = null;
      fight.nextKey = time + KEY_MISS;
    }
  },
  momPace(s, time, pace) {
    const door = kingStart + DOOR;
    if (fight && kingWon(time)) {
      // The cage is gone and the door is down: wait there for the chick to run up.
      return fight.front >= door - 1.2 || s > door + 0.1 ? pace : 0;
    }
    if (s >= door) return 0;
    const room = door - s;
    if (room <= 0.03) return 0;
    return pace * Math.min(1, Math.sqrt(room / 1.2));
  },
  mishap(s, lateral, time, lead) {
    // Only the chick you steer is at risk here, so the whole family is still there for the finish.
    if (!lead || !fight || fight.rush !== null || s < kingStart || s >= nestStart) return null;
    const dir = lateral >= 0 ? 1 : -1;
    for (const hazard of fight.hazards) {
      if (hazard.kind === "wave") {
        if (Math.abs(waveS(hazard, time) - s) >= WAVE_ALONG) continue;
        if (Math.abs(lateral - hazard.gap) > hazard.half - WAVE_MARGIN) return { message: WASHED, dir };
      } else if (hazard.kind === "beam") {
        if (beamState(hazard, time).state !== "live") continue;
        if (Math.abs(lateral - hazard.lateral) < BEAM_HALF) return { message: CURSED, dir: lateral >= hazard.lateral ? 1 : -1 };
      } else if (Math.hypot(boulderS(hazard, time) - s, lateral - hazard.lateral) < BOULDER_RADIUS + 0.05) {
        return { message: CRUSHED, dir: lateral >= hazard.lateral ? 1 : -1 };
      }
    }
    return null;
  },
  guide(s, lateral, time) {
    // Mom stays put in the cage; this only steers the probe's chick.
    if (!fight || s >= kingStart + DOOR - 0.6 || fight.rush !== null) return 0;
    const pockets = [-1.2, -1.05, -0.9, -0.75, -0.6, -0.45, -0.3, -0.15, 0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1.05, 1.2];
    let wave: Wave | null = null;
    let waveIn = Infinity;
    for (const hazard of fight.hazards) {
      if (hazard.kind !== "wave") continue;
      const ahead = waveS(hazard, time) - s;
      if (ahead > -WAVE_ALONG && ahead < waveIn) {
        wave = hazard;
        waveIn = ahead;
      }
    }
    const keyIn = fight.key ? keyS(fight.key, time) - s : Infinity;
    const chase = fight.key && keyIn > -KEY_ALONG && (!wave || waveIn / wave.speed > 0.8);
    const want = chase && fight.key ? fight.key.lateral : wave ? wave.gap : 0;
    return bestPocket(pockets, lateral, (pocket) => {
      let cost = Math.abs(pocket - want) * 6;
      if (wave && waveIn < 1.2 && Math.abs(pocket - wave.gap) > wave.half - WAVE_MARGIN - 0.1) cost += 300;
      for (const hazard of fight?.hazards ?? []) {
        if (hazard.kind === "beam") {
          const { state, t } = beamState(hazard, time);
          if ((state === "warn" || state === "live") && Math.abs(pocket - hazard.lateral) < BEAM_HALF + 0.1) cost += 200;
          // A burning beam is a wall: whatever is on the far side has to wait until it goes out.
          const crossing = (pocket - hazard.lateral) * (lateral - hazard.lateral) < 0;
          if (crossing && (state === "live" || (state === "warn" && t > 0.35))) cost += 1000;
        } else if (hazard.kind === "boulder" && time >= hazard.born) {
          const ahead = boulderS(hazard, time) - s;
          if (ahead > -0.6 && ahead < 1.6 && Math.abs(pocket - hazard.lateral) < BOULDER_RADIUS + 0.12) cost += 200;
          // Nor run across its path once it is nearly here.
          if (ahead > -0.6 && ahead < 1.1 && (pocket - hazard.lateral) * (lateral - hazard.lateral) < 0) cost += 1000;
        }
      }
      return cost;
    }, 0.6);
  },
};

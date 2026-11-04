import { desertStart, poseAt, seaStart } from "../route.ts";
import { bestPocket, hash01, loopPass, MOM_PACE, spawnGate } from "./common.ts";
import type { StageLogic } from "./types.ts";

// ---- 調整用の数値 ----
// 泳げる横の幅（片側）
export const SEA_HALF = 1.5;
export const SEA_LENGTH = desertStart - seaStart;
// 最後に海が割れて道になる長さ（距離）。ここにはもう何も出ない
export const PART_LENGTH = 4.5;
// 泳ぎの重さ：左右の最高速、最高速までの秒数、止まるまでの秒数
const STEER = 2.6;
const GRIP = 0.75;
const BRAKE = 0.65;
// 魚の群れ：同時に泳ぐ数、速さ（距離/秒）、出てくるまでの待ち時間のばらつき（秒）
const SCHOOLS = 3;
const SCHOOL_SLOW = 1.9;
const SCHOOL_FAST = 3;
const SCHOOL_REST = 1.6;
// 群れが泳ぐ横の範囲と、群れの当たり判定（道に沿った方向・横方向）
const SCHOOL_REACH = 1.1;
export const SCHOOL_ALONG = 0.4;
export const SCHOOL_SIDE = 0.36;
// これより手前では新しい群れが出てこない（距離）
const SPAWN_MIN = 6;
// クラゲ：海の入口からの距離、ふだんの横位置、ゆれ幅、1往復の秒数（海流の中には置かない）
export const JELLIES = [
  { at: 2.4, lateral: 0.5, swing: 0.3, period: 4.6 },
  { at: 7.4, lateral: -0.45, swing: 0.35, period: 5.2 },
  { at: 12.2, lateral: 0.15, swing: 0.4, period: 4.2 },
];
// クラゲの当たり判定の半径
export const JELLY_RADIUS = 0.24;
// きょうだいを刺したクラゲが、次に刺せるようになるまでの秒数（列が次々に刺されないように）
const JELLY_REST = 3;
// 横向きの海流：海の入口からの距離、長さ、横へ流す速さ（距離/秒。+ で左）
export const CURRENTS = [
  { at: 3.6, length: 2.8, push: 1.1 },
  { at: 8.6, length: 2.6, push: -1.2 },
];

export const STUNG = "クラゲにさされてしまった😿";
export const FISHED = "魚の群れにぶつかってしまった😿";

// ---- 魚の群れ ----
export type School = { s: number; lateral: number; x: number; z: number; yaw: number; visible: boolean; speed: number; swim: number };

const gate = spawnGate(SPAWN_MIN);
let schoolKey = NaN;
let schoolCache: School[] = [];

export function seaSchools(time: number): School[] {
  if (time === schoolKey) return schoolCache;
  const entry = SEA_LENGTH - PART_LENGTH;
  const list: School[] = [];
  for (let i = 0; i < SCHOOLS; i++) {
    const id = 1100 + i;
    const ride = loopPass(id, i, SCHOOLS, time, entry, -0.6, SCHOOL_SLOW, SCHOOL_FAST, SCHOOL_REST);
    let lateral = 0;
    if (ride) {
      const base = (hash01(id, ride.pass, 4) * 2 - 1) * SCHOOL_REACH;
      lateral = base + Math.sin(ride.ride * 1.3 + id) * 0.1;
    }
    const s = seaStart + (ride ? ride.along : entry);
    const pose = poseAt(s, lateral);
    list.push({
      s,
      lateral,
      x: pose.x,
      z: pose.z,
      yaw: pose.yaw + Math.PI,
      visible: ride !== null && ride.along > 0.5 && gate.clear(id, ride.pass, s, ride.speed),
      speed: ride ? ride.speed : 0,
      swim: ride ? ride.ride : 0,
    });
  }
  schoolCache = list;
  schoolKey = time;
  return schoolCache;
}

// ---- クラゲ ----
const jellyStung = new Map<number, number>();
let jellyClock = -Infinity;

// 0 while a jelly is ready to sting, rising to 1 right after it stung a sibling and shrank back.
export function jellyRest(index: number, time: number): number {
  const at = jellyStung.get(index);
  if (at === undefined || time < at) return 0;
  return Math.max(0, 1 - (time - at) / JELLY_REST);
}

export function jellyLateral(jelly: (typeof JELLIES)[number], time: number): number {
  return jelly.lateral + Math.sin((time / jelly.period) * Math.PI * 2) * jelly.swing;
}

export function currentAt(s: number): number {
  for (const current of CURRENTS) {
    const at = s - seaStart - current.at;
    if (at >= 0 && at < current.length) return current.push;
  }
  return 0;
}

const POCKETS = [-1.2, -0.9, -0.6, -0.3, 0, 0.3, 0.6, 0.9, 1.2];

function pocketCost(s: number, lateral: number, time: number, pocket: number): number {
  let cost = 0;
  for (const jelly of JELLIES) {
    const ahead = seaStart + jelly.at - s;
    if (ahead < -0.4 || ahead > 3.5) continue;
    const there = jellyLateral(jelly, time + Math.max(0, ahead) / MOM_PACE);
    if (Math.abs(there - pocket) < JELLY_RADIUS + 0.32) cost += 80;
  }
  for (const school of seaSchools(time)) {
    if (!school.visible) continue;
    const ahead = school.s - s;
    if (ahead < -0.5 || ahead > 9) continue;
    const close = 1 - Math.max(0, ahead) / 9;
    if ((pocket - school.lateral) * (lateral - school.lateral) < 0) {
      const clearIn = (Math.abs(school.lateral - lateral) + 0.6) / 1.6 + GRIP;
      const arriveIn = Math.max(0, ahead) / (school.speed + MOM_PACE);
      if (clearIn > arriveIn) cost += 10 + close * close * 60;
    }
    const gap = Math.abs(school.lateral - pocket);
    if (gap <= SCHOOL_SIDE + 0.25) cost += 60 + close * close * 90;
    else if (gap <= 0.9) cost += (0.9 - gap) * (10 + close * close * 30);
  }
  return cost;
}

export const sea: StageLogic = {
  steer: STEER,
  grip: GRIP,
  brake: BRAKE,
  bound: SEA_HALF,
  leash: 1.2,
  loseGap: 4.35,
  strand: 1.2,
  scatter: 3,
  hint: "ゆっくり曲がるよ。クラゲと魚と海流に気をつけて",
  checkpoint: "shore",
  watch(front, tail, time) {
    if (time < jellyClock) jellyStung.clear();
    jellyClock = time;
    gate.watch(front, tail, time);
  },
  drift(s) {
    return currentAt(s);
  },
  mishap(s, lateral, time, lead) {
    if (s < seaStart || s >= desertStart - PART_LENGTH) return null;
    for (const [index, jelly] of JELLIES.entries()) {
      if (!lead && jellyRest(index, time) > 0) continue;
      const j = jellyLateral(jelly, time);
      if (Math.hypot(s - seaStart - jelly.at, lateral - j) < JELLY_RADIUS + 0.08) {
        if (!lead) jellyStung.set(index, time);
        return { message: STUNG, dir: lateral >= j ? 1 : -1 };
      }
    }
    for (const school of seaSchools(time)) {
      if (!school.visible) continue;
      if (Math.abs(s - school.s) < SCHOOL_ALONG && Math.abs(lateral - school.lateral) < SCHOOL_SIDE) {
        return { message: FISHED, dir: lateral >= school.lateral ? 1 : -1 };
      }
    }
    return null;
  },
  guide(s, lateral, time) {
    return bestPocket(POCKETS, lateral, (pocket) => pocketCost(s, lateral, time, pocket));
  },
};

import { caveStart, poseAt, shoreStart } from "../route.ts";
import { bestPocket, hash01, loopPass, MOM_PACE, spawnGate } from "./common.ts";
import type { StageLogic } from "./types.ts";

// ---- 調整用の数値 ----
// 道の中心から岩壁までの幅（片側）
export const CAVE_HALF = 1.2;
export const CAVE_LENGTH = shoreStart - caveStart;
// 落石：先頭の子がこの距離まで近づくと、床が光って予告が始まる
const ROCK_TRIGGER = 5.6;
// 予告から落ち始めるまでの秒数と、落ちきるまでの秒数
export const ROCK_WARN = 2.3;
export const ROCK_FALL = 0.3;
// 落ちた石の当たり判定の半径（落ちたあとも道に残る）
export const ROCK_RADIUS = 0.3;
// 落石の場所（洞窟の入口からの距離と横位置）
const ROCK_SPOTS = [
  { at: 4, lateral: 0.05 },
  { at: 8.5, lateral: -0.55 },
  { at: 12, lateral: 0.6 },
  { at: 18.5, lateral: -0.1 },
  { at: 23, lateral: 0.5 },
  { at: 30, lateral: -0.45 },
];
// コウモリ：同時に飛ぶ数、速さ（距離/秒）、出てくるまでの待ち時間のばらつき（秒）
const BATS = 4;
const BAT_SLOW = 2.4;
const BAT_FAST = 3.8;
const BAT_REST = 2.2;
// コウモリが飛ぶ横の範囲と、当たり判定（道に沿った方向・横方向）
const BAT_REACH = 0.9;
const BAT_ALONG = 0.3;
const BAT_SIDE = 0.24;
// これより手前では新しいコウモリが出てこない（距離）
const SPAWN_MIN = 6;
// 入口からこれより奥でだけコウモリが見える（距離）
const INSIDE = 0.7;
// お化け：いる場所、左右に漂う幅、1往復の秒数、当たり判定
export const GHOSTS = [
  { at: 15, swing: 1.05, period: 3.4, phase: 0 },
  { at: 26.5, swing: 1.05, period: 2.8, phase: 1.9 },
];
const GHOST_ALONG = 0.3;
const GHOST_SIDE = 0.28;
// お母さんの何歩うしろを歩くか（距離）。離れるほど闇に溶けて見失いそうになる
const FOLLOW = 2.1;
// 地下水の水たまりで横に流される速さ（距離/秒）
const SLIP = 1.5;

export const ROCKED = "落石に当たってしまった😿";
export const BATTED = "コウモリにぶつかってしまった😿";
export const SPOOKED = "お化けにおどろいてしまった😿";

export type CavePuddle = { s: number; lateral: number; radius: number };

export const cavePuddles: CavePuddle[] = [
  { s: caveStart + 6.2, lateral: 0.55, radius: 0.36 },
  { s: caveStart + 20.5, lateral: 0.6, radius: 0.38 },
  { s: caveStart + 32.5, lateral: 0.1, radius: 0.34 },
];

// ---- 落石 ----
export type FallingRock = { s: number; lateral: number; state: "idle" | "warn" | "fall" | "down"; t: number };

const rockSpots = ROCK_SPOTS.map((spot) => ({ s: caveStart + spot.at, lateral: spot.lateral }));
const rockStart = new Map<number, number>();
let rockClock = -Infinity;

function watchRocks(front: number, time: number): void {
  // Time only runs backwards when a fresh run begins: clear every fallen rock.
  if (time < rockClock) rockStart.clear();
  rockClock = time;
  rockSpots.forEach((spot, index) => {
    if (!rockStart.has(index) && front >= spot.s - ROCK_TRIGGER && front < spot.s) rockStart.set(index, time);
  });
}

export function caveRocks(time: number): FallingRock[] {
  return rockSpots.map((spot, index) => {
    const t0 = rockStart.get(index);
    if (t0 === undefined) return { ...spot, state: "idle", t: 0 };
    const t = time - t0;
    if (t < ROCK_WARN) return { ...spot, state: "warn", t: t / ROCK_WARN };
    if (t < ROCK_WARN + ROCK_FALL) return { ...spot, state: "fall", t: (t - ROCK_WARN) / ROCK_FALL };
    return { ...spot, state: "down", t: 1 };
  });
}

// ---- コウモリ ----
export type Bat = { s: number; lateral: number; x: number; z: number; yaw: number; visible: boolean; speed: number; flap: number };

const gate = spawnGate(SPAWN_MIN);
let batKey = NaN;
let batCache: Bat[] = [];

// Flocks come at the chick out of the dark; only their eyes show from far off.
export function caveBats(time: number): Bat[] {
  if (time === batKey) return batCache;
  const entry = CAVE_LENGTH - 0.6;
  const list: Bat[] = [];
  for (let i = 0; i < BATS; i++) {
    const id = 900 + i;
    const ride = loopPass(id, i, BATS, time, entry, -0.6, BAT_SLOW, BAT_FAST, BAT_REST);
    let lateral = 0;
    if (ride) {
      const base = (hash01(id, ride.pass, 4) * 2 - 1) * BAT_REACH;
      const weave = Math.sin(ride.ride * 2.6 + id) * 0.12;
      lateral = Math.max(-BAT_REACH, Math.min(BAT_REACH, base + weave));
    }
    const s = caveStart + (ride ? ride.along : entry);
    const pose = poseAt(s, lateral);
    list.push({
      s,
      lateral,
      x: pose.x,
      z: pose.z,
      yaw: pose.yaw + Math.PI,
      visible: ride !== null && ride.along > INSIDE && gate.clear(id, ride.pass, s, ride.speed),
      speed: ride ? ride.speed : 0,
      flap: ride ? ride.ride * 14 : 0,
    });
  }
  batCache = list;
  batKey = time;
  return batCache;
}

// ---- お化け ----
export function ghostLateral(ghost: (typeof GHOSTS)[number], time: number): number {
  return Math.sin((time / ghost.period) * Math.PI * 2 + ghost.phase) * ghost.swing;
}

const POCKETS = [-0.9, -0.6, -0.3, 0, 0.3, 0.6, 0.9];

function pocketCost(s: number, lateral: number, time: number, pocket: number): number {
  let cost = 0;
  for (const puddle of cavePuddles) {
    const ahead = puddle.s - s;
    if (ahead < -0.4 || ahead > 2.4) continue;
    if (Math.abs(puddle.lateral - pocket) < puddle.radius + 0.18) cost += 25 * (1 - Math.max(0, ahead) / 2.4);
  }
  for (const rock of caveRocks(time)) {
    if (rock.state === "idle") continue;
    const ahead = rock.s - s;
    if (ahead < -0.5 || ahead > ROCK_TRIGGER) continue;
    if (Math.abs(rock.lateral - pocket) < ROCK_RADIUS + 0.3) cost += ahead < 1.6 ? 400 : 90;
    // Never cut across a stone that is about to be underfoot.
    if (ahead < 0.9 && (pocket - rock.lateral) * (lateral - rock.lateral) < 0) cost += 400;
  }
  for (const ghost of GHOSTS) {
    const ahead = caveStart + ghost.at - s;
    if (ahead < -0.4 || ahead > 3) continue;
    const there = ghostLateral(ghost, time + Math.max(0, ahead) / MOM_PACE);
    if (Math.abs(there - pocket) < GHOST_SIDE + 0.3) cost += 70;
  }
  for (const bat of caveBats(time)) {
    if (!bat.visible) continue;
    const ahead = bat.s - s;
    if (ahead < -0.5 || ahead > 8) continue;
    const close = 1 - Math.max(0, ahead) / 8;
    if ((pocket - bat.lateral) * (lateral - bat.lateral) < 0) {
      const clearIn = (Math.abs(bat.lateral - lateral) + 0.5) / 2.4;
      const arriveIn = Math.max(0, ahead) / (bat.speed + MOM_PACE);
      if (clearIn > arriveIn) cost += 8 + close * close * 60;
    }
    const gap = Math.abs(bat.lateral - pocket);
    if (gap <= BAT_SIDE + 0.2) cost += 60 + close * close * 90;
    else if (gap <= 0.7) cost += (0.7 - gap) * (10 + close * close * 30);
  }
  return cost;
}

export const cave: StageLogic = {
  steer: 3.2,
  grip: 0.6,
  brake: 0.16,
  bound: CAVE_HALF,
  leash: 1.0,
  loseGap: 4.35,
  strand: 0.95,
  scatter: 6,
  hint: "落石・コウモリ・お化けをよけよう",
  follow: FOLLOW,
  watch(front, tail, time) {
    gate.watch(front, tail, time);
    watchRocks(front, time);
  },
  steerClear(s, lateral, from) {
    let lat = lateral;
    for (const rock of caveRocks(rockClock)) {
      if (rock.state !== "down" && rock.state !== "fall") continue;
      if (Math.abs(s - rock.s) > ROCK_RADIUS + 0.55) continue;
      const room = ROCK_RADIUS + 0.22;
      if (Math.abs(lat - rock.lateral) < room) lat = rock.lateral + (from >= rock.lateral ? room : -room);
    }
    return lat;
  },
  drift(s, lateral) {
    for (const puddle of cavePuddles) {
      const d = lateral - puddle.lateral;
      if (Math.hypot(s - puddle.s, d) >= puddle.radius) continue;
      return (d >= 0 ? 1 : -1) * SLIP;
    }
    return 0;
  },
  mishap(s, lateral, time, lead) {
    if (s < caveStart - 0.6 || s >= shoreStart) return null;
    const dir = lateral >= 0 ? 1 : -1;
    for (const rock of caveRocks(time)) {
      if (rock.state !== "down") continue;
      if (Math.hypot(s - rock.s, lateral - rock.lateral) < ROCK_RADIUS + 0.08) return { message: ROCKED, dir };
    }
    // A ghost sweeps back and forth across the whole line; only the lead chick takes fright,
    // or every pass would empty the brood.
    for (const ghost of lead ? GHOSTS : []) {
      const g = ghostLateral(ghost, time);
      if (Math.abs(s - caveStart - ghost.at) < GHOST_ALONG && Math.abs(lateral - g) < GHOST_SIDE) {
        return { message: SPOOKED, dir: lateral >= g ? 1 : -1 };
      }
    }
    for (const bat of caveBats(time)) {
      if (!bat.visible) continue;
      if (Math.abs(s - bat.s) < BAT_ALONG && Math.abs(lateral - bat.lateral) < BAT_SIDE) {
        return { message: BATTED, dir: lateral >= bat.lateral ? 1 : -1 };
      }
    }
    return null;
  },
  guide(s, lateral, time) {
    return bestPocket(POCKETS, lateral, (pocket) => pocketCost(s, lateral, time, pocket));
  },
};

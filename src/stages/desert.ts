import { desertStart, kingStart } from "../route.ts";
import { bestPocket, smoothstep } from "./common.ts";
import type { StageLogic } from "./types.ts";

// ---- 調整用の数値 ----
// 砂の上で動ける横の幅（片側）
const DESERT_BOUND = 2.1;
// 道からこれ以上外れると、蜃気楼にだまされてはぐれる（横位置）
export const TRAIL_LOST = 1.65;
// サボテン：砂漠の入口からの距離、横位置、当たり判定の半径
export const CACTI = [
  { at: 2.6, lateral: 0.35, radius: 0.24 },
  { at: 4.8, lateral: -0.55, radius: 0.24 },
  { at: 6.4, lateral: 0.7, radius: 0.22 },
  { at: 9.6, lateral: -0.15, radius: 0.26 },
  { at: 12.8, lateral: 0.55, radius: 0.24 },
  { at: 15.6, lateral: -0.6, radius: 0.24 },
  { at: 18.2, lateral: 0.2, radius: 0.24 },
];
// 流砂：砂漠の入口からの距離、中心の横位置、半径、引っ張る速さ（距離/秒）
export const QUICKSANDS = [
  { at: 7.8, lateral: 1.0, radius: 0.85, pull: 1.3 },
  { at: 14.2, lateral: -1.0, radius: 0.85, pull: 1.3 },
];
// 流砂の中で歩みが遅くなる割合（0..1）
const SINK_SLOW = 0.55;
// 蜃気楼：始まりと終わり（砂漠の入口からの距離）、偽物のお母さんが見える横のずれ
export const MIRAGES = [
  { from: 5, to: 9, side: -1.75 },
  { from: 15, to: 19.5, side: 1.75 },
];
// 蜃気楼のあいだ、本物のお母さんの見え方（1 でふつう、0 で消える）
export const REAL_MOM_SHOW = 0.28;

export const PRICKED = "サボテンにささってしまった😿";
export const FOOLED = "蜃気楼にだまされてはぐれてしまった😿";

// 0..1: how strongly the mirage is showing at this spot (eases in and out at its ends).
export function mirageAt(s: number): { strength: number; side: number } {
  const at = s - desertStart;
  for (const mirage of MIRAGES) {
    const strength = smoothstep(mirage.from - 1, mirage.from, at) * (1 - smoothstep(mirage.to, mirage.to + 1, at));
    if (strength > 0) return { strength, side: mirage.side };
  }
  return { strength: 0, side: 0 };
}

function sandAt(s: number, lateral: number) {
  for (const sand of QUICKSANDS) {
    const d = lateral - sand.lateral;
    if (Math.hypot(s - desertStart - sand.at, d) < sand.radius) return { sand, d };
  }
  return null;
}

const POCKETS = [-1.2, -0.9, -0.6, -0.3, 0, 0.3, 0.6, 0.9, 1.2];

export const desert: StageLogic = {
  steer: 3.2,
  grip: 0.62,
  brake: 0.18,
  bound: DESERT_BOUND,
  leash: 1.2,
  loseGap: 4.35,
  strand: 1.1,
  scatter: 4,
  hint: "サボテンと流砂をよけて、本物のお母さんについていこう",
  steerClear(s, lateral, from) {
    let lat = lateral;
    for (const cactus of CACTI) {
      const ds = s - desertStart - cactus.at;
      if (Math.abs(ds) > cactus.radius + 0.55) continue;
      const room = cactus.radius + 0.24;
      if (Math.abs(lat - cactus.lateral) < room) lat = cactus.lateral + (from >= cactus.lateral ? room : -room);
    }
    return lat;
  },
  drift(s, lateral) {
    const hit = sandAt(s, lateral);
    // The sand drags you sideways into its middle.
    return hit ? -Math.sign(hit.d || 1) * hit.sand.pull * Math.min(1, Math.abs(hit.d) / 0.25) : 0;
  },
  slow(s, lateral) {
    return sandAt(s, lateral) ? SINK_SLOW : 0;
  },
  mishap(s, lateral, _time, lead) {
    if (s < desertStart || s >= kingStart) return null;
    for (const cactus of CACTI) {
      if (Math.hypot(s - desertStart - cactus.at, lateral - cactus.lateral) < cactus.radius + 0.08) {
        return { message: PRICKED, dir: lateral >= cactus.lateral ? 1 : -1 };
      }
    }
    if (lead && Math.abs(lateral) > TRAIL_LOST) return { message: FOOLED, dir: Math.sign(lateral) };
    return null;
  },
  guide(s, lateral) {
    return bestPocket(POCKETS, lateral, (pocket) => {
      let cost = 0;
      for (const cactus of CACTI) {
        const ahead = desertStart + cactus.at - s;
        if (ahead < -0.4 || ahead > 2.6) continue;
        if (Math.abs(cactus.lateral - pocket) < cactus.radius + 0.3) cost += 90;
      }
      for (const sand of QUICKSANDS) {
        const ahead = desertStart + sand.at - s;
        if (Math.abs(ahead) > sand.radius + 1.2) continue;
        if (Math.abs(sand.lateral - pocket) < sand.radius + 0.25) cost += 40;
      }
      return cost;
    });
  },
};

import { seaStart, shoreStart } from "../route.ts";
import { MOM_PACE } from "./common.ts";
import type { StageLogic } from "./types.ts";

// ---- 調整用の数値 ----
// 波が道を洗う場所：浜辺の入口からの距離、幅（距離）、1回の寄せ引きの秒数、道が水をかぶっている秒数、ずらし（秒）
export const WAVE_ZONES = [
  { at: 4.2, width: 2.2, period: 3.8, wet: 1.4, phase: 0.6 },
  { at: 10.4, width: 2.6, period: 4.2, wet: 1.5, phase: 2.3 },
];
// 波が道に届く何秒前から、白い波頭が寄せてくるのが見えるか
export const WAVE_WARN = 0.9;
// 引いていく波が見えている秒数（もう当たらない）
export const WAVE_EBB = 0.7;
// お母さんが渡るときの速さ（ふだんの何倍か）
const MOM_BURST = 1.55;
// お母さんが波打ち際の手前で止まる距離
const MOM_EDGE = 0.2;
// 渡りきるのに使う、波が引いている残り時間の余裕（秒）
const MOM_MARGIN = 0.3;
// 1回の波でさらわれるきょうだいの数（列の最後尾から）
const TAKE_PER_WAVE = 1;
// 最後尾からこの距離までにいるきょうだいだけがさらわれる
const TAIL_REACH = 0.6;

export const SWEPT = "波にさらわれてしまった😿";

export type WaveZone = (typeof WAVE_ZONES)[number];

export function zoneStart(zone: WaveZone): number {
  return shoreStart + zone.at;
}

function cycle(zone: WaveZone, time: number): number {
  return (((time + zone.phase) % zone.period) + zone.period) % zone.period;
}

export function waveWet(zone: WaveZone, time: number): boolean {
  return cycle(zone, time) < zone.wet;
}

// Seconds of dry sand left before the next wave reaches the path (0 while it is wet).
export function dryLeft(zone: WaveZone, time: number): number {
  const t = cycle(zone, time);
  return t < zone.wet ? 0 : zone.period - t;
}

// How far the water has come up the beach: 0 none, 1 over the path. For the view.
export function waveReach(zone: WaveZone, time: number): number {
  const t = cycle(zone, time);
  if (t < zone.wet) return 1;
  if (t < zone.wet + WAVE_EBB) return 1 - (t - zone.wet) / WAVE_EBB;
  const comeIn = zone.period - t;
  if (comeIn < WAVE_WARN) return 1 - comeIn / WAVE_WARN;
  return 0;
}

// Which wave this is, counted per zone, so each one takes its share only once.
function waveIndex(zone: WaveZone, time: number): number {
  return Math.floor((time + zone.phase) / zone.period);
}

let tail = -Infinity;
let clock = -Infinity;
const taken = new Map<string, number>();

function zoneAt(s: number): WaveZone | null {
  for (const zone of WAVE_ZONES) {
    const s0 = zoneStart(zone);
    if (s >= s0 && s < s0 + zone.width) return zone;
  }
  return null;
}

function nextZone(s: number): WaveZone | null {
  for (const zone of WAVE_ZONES) if (zoneStart(zone) + zone.width > s) return zone;
  return null;
}

// Mom's rule: cross only if the sand stays dry the whole way over, with a little to spare.
function safeToCross(zone: WaveZone, time: number, speed: number): boolean {
  return dryLeft(zone, time) >= (zone.width + 0.3) / speed + MOM_MARGIN;
}

export const shore: StageLogic = {
  steer: 3.2,
  grip: 0.6,
  brake: 0.16,
  bound: 1.4,
  leash: 1.1,
  loseGap: 6,
  strand: null,
  scatter: 1,
  hint: "波が引いたら走って渡ろう",
  watch(_front, last, time) {
    if (time < clock) taken.clear();
    clock = time;
    tail = last;
  },
  momPace(s, time, pace) {
    if (zoneAt(s)) return pace * MOM_BURST;
    const zone = nextZone(s);
    if (!zone) return pace;
    const room = zoneStart(zone) - MOM_EDGE - s;
    if (room > 1.2) return pace;
    if (safeToCross(zone, time + Math.max(0, room) / pace, pace * MOM_BURST)) return pace;
    if (room <= 0.03) return 0;
    return pace * Math.min(1, Math.sqrt(room / 1.2));
  },
  hold(s, time) {
    if (zoneAt(s)) return false;
    const zone = nextZone(s);
    if (!zone) return false;
    const room = zoneStart(zone) - s;
    if (room > 0.75) return false;
    return !safeToCross(zone, time + Math.max(0, room) / (MOM_PACE * 1.85), MOM_PACE * 1.85);
  },
  mishap(s, _lateral, time, lead) {
    if (s < shoreStart || s >= seaStart) return null;
    const zone = zoneAt(s);
    if (!zone || !waveWet(zone, time)) return null;
    if (lead) return { message: SWEPT, dir: -1 };
    // A wave drags off the stragglers at the back of the line, a few at most.
    if (s > tail + TAIL_REACH) return null;
    const key = `${zone.at}:${waveIndex(zone, time)}`;
    const count = taken.get(key) ?? 0;
    if (count >= TAKE_PER_WAVE) return null;
    taken.set(key, count + 1);
    return { message: SWEPT, dir: -1 };
  },
};

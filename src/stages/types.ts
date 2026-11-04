import type { SegmentId } from "../route.ts";

// What went wrong, and which way the chick tumbles (-1 / 1; 0 sinks in place).
export type Mishap = { message: string; dir: number };

// Everything play.ts needs to know about one added stage. No three.js here: the probes run this in Node.
export type StageLogic = {
  // 左右の最高速（距離/秒）
  steer: number;
  // 止まった状態から最高速までの秒数（大きいほど重い・滑る）
  grip: number;
  // 最高速から止まるまでの秒数（大きいほど止まりにくい）
  brake: number;
  // 道の中心から横に動ける幅。ここで壁に当たって止まる
  bound: number;
  // きょうだいが横に広がれる幅
  leash: number;
  // お母さんとこれだけ離れたら、はぐれて失敗
  loseGap: number;
  // 飛ばされたきょうだいが落ちる横位置（null なら助けられない）
  strand: number | null;
  // はぐれた子の位置を毎回ずらす範囲（道に沿った距離）
  scatter: number;
  hint: string;
  // A hint that changes as the stage goes on; null falls back to `hint`.
  liveHint?(time: number): string | null;
  // How far behind mom the lead chick walks (default 0.78). Further back, she melts into fog or dark.
  follow?: number;
  // Resume at another segment's checkpoint instead of this one (the second half of a stage).
  checkpoint?: SegmentId;
  // Called once a frame before anything moves: the lead chick's s and lateral, and the last sibling's s.
  watch?(front: number, tail: number, time: number, lateral: number): void;
  // Sideways speed forced on a body standing here (puddles, currents, pulls).
  drift?(s: number, lateral: number, time: number): number;
  // 0..1 slowdown of the forward walk at this spot.
  slow?(s: number, lateral: number, time: number): number;
  // lead: the player's chick (true) or a sibling in the line behind (false).
  mishap?(s: number, lateral: number, time: number, lead: boolean): Mishap | null;
  // Go/stop stages: how fast mom walks here now, given her usual pace.
  momPace?(s: number, time: number, pace: number): number;
  // Go/stop stages: whether a chick standing at s should wait rather than walk on (mom's rule, used by the probe).
  hold?(s: number, time: number): boolean;
  // Siblings copy the lead's sidestep a moment late and would cut the corner: nudge their line
  // clear of anything that stands still here, passing on the side the sibling is already on.
  steerClear?(s: number, lateral: number, from: number): number;
  // The lead chick is not walking here: a sibling at s follows the one in front of it, not the footprints.
  queued?(s: number): boolean;
  // Where mom (and the probe's autopilot) would rather be right now.
  guide?(s: number, lateral: number, time: number): number;
};

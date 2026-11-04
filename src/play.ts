import {
  crowdEnd,
  crowdStart,
  goal,
  inLake,
  lostChicks,
  nestStart,
  pathHalf,
  pointAt,
  poseAt,
  clearLateral,
  parkClimb,
  parkGuideMax,
  parkGuideMin,
  parkMaxL,
  parkMinL,
  parkBlocked,
  parkOffTrail,
  slidePark,
  roadEnd,
  roadStart,
  segmentAt,
  segments,
  walkHedge,
  walkProps,
  walkSide,
  walkStart,
  type LostChick,
  type SegmentId,
} from "./route.ts";
import { byStage, STAGE_LIST, stageOf } from "./stages/index.ts";

export const MOM_SPEED = 1.75;
const RESCUE_REACH = 0.52;
const RESCUE_PASS = 1.9;
export const LOSE_GAP = 4.35;
export const ROAD_LOSE_GAP = 11;
export const WALK_LOSE_GAP = 3.3;
export const FOLLOW_GAP = 0.78;
// How close behind mom the chick stops when she waits on a go/stop stage.
const MOM_BUMP = 0.42;
export const OVERTAKE_LEAD = 0.55;
export const BROOD_COUNT = 9;
// Living siblings are the lives. A failure spends one; none left means a full restart.
const STAR_TWO = 6;
const STAR_THREE = BROOD_COUNT;
// Chicks waiting at the edge only get run into once the player is close enough to see it happen.
const STRAY_DANGER = 7;
const MAX_BROOD_BODIES = 240;
export const ROAD_CRUISE = MOM_SPEED;
export const ROAD_FAST = MOM_SPEED * 1.85;
export const ROAD_RATE = 3.1;
// Seconds from a standstill to a full dash while holding forward.
const ROAD_LAUNCH = 0.7;
const ROAD_STOP = 14;
export const YEET_TIME = 0.72;

export const OVERTURN = "お母さんを追い越してしまった😿";
export const YEETED = "車に飛ばされてしまった😿";
export const KICKED = "人の足にぶつかってしまった😿";
export const BINNED = "ゴミ箱にぶつかってしまった😿";
export const SOAKED = "水たまりにはまってしまった😿";
export const BIKED = "自転車にぶつかってしまった😿";
export const DROWNED = "湖に落ちてしまった😿";

export type Phase = "ready" | "play" | "yeet" | "result";

export type FrameInput = {
  left: boolean;
  right: boolean;
  forward: boolean;
  back: boolean;
};

export type Pose = { x: number; z: number; yaw: number };

export type VehicleKind = "car" | "suv" | "van" | "bus" | "truck";

export type Car = {
  x: number;
  z: number;
  dir: number;
  speed: number;
  color: number;
  kind: VehicleKind;
  length: number;
  width: number;
};

export type Person = {
  x: number;
  z: number;
  s: number;
  lateral: number;
  dir: number;
  yaw: number;
  color: number;
  length: number;
  width: number;
  visible: boolean;
  fade: number;
  stride: number;
  run: boolean;
};

export type BroodMood = "cling" | "wander" | "dawdle" | "dash" | "zigzag";
export type BroodPhase = "walk" | "yeet" | "stranded" | "gone";

export type StrollMode = "follow" | "zigzag" | "drift" | "stop" | "dart" | "turn";

export type Broodling = {
  s: number;
  lateral: number;
  mood: BroodMood;
  stroll: StrollMode;
  strollUntil: number;
  strollAim: number;
  strollSide: number;
  strollFlip: number;
  strollBeat: number;
  rand: () => number;
  phase: BroodPhase;
  yeet: number;
  yeetDir: number;
  seed: number;
  moved: number;
  stray: boolean;
  rescueable: boolean;
};

export type Game = {
  phase: Phase;
  time: number;
  momS: number;
  childS: number;
  lateral: number;
  lateralVel: number;
  pause: number;
  curbUsed: boolean;
  medianWait: boolean;
  medianReady: number;
  medianUsed: boolean;
  yeet: number;
  yeetDir: number;
  message: string;
  outcome: string;
  success: boolean;
  checkpoint: SegmentId;
  savedBrood: number;
  childDelta: number;
  momDelta: number;
  roadSpeed: number;
  crowdAt: number;
  momLateral: number;
  brood: Broodling[];
  broodHeadcount: number;
  rescuePop: number;
  rescuePopText: string;
  rescued: number;
  savedRescued: number;
  continues: number;
    trail: { s: number; lateral: number; time: number }[];
};

const BROOD_MOODS: BroodMood[] = [
  "cling",
  "wander",
  "dawdle",
  "dash",
  "zigzag",
  "cling",
  "wander",
  "dawdle",
  "zigzag",
];

const LANES: {
  t: number;
  speed: number;
  phase: number;
  dir: number;
  spacing: number;
  count: number;
  color: number;
  kind: VehicleKind;
  length: number;
  width: number;
}[] = [
  { t: 0.085, speed: 8.4, phase: 0.5, dir: -1, spacing: 23, count: 3, color: 0xc4483a, kind: "car", length: 1.8, width: 0.8 },
  { t: 0.201, speed: 6.6, phase: 7.2, dir: -1, spacing: 26, count: 3, color: 0x2f6fbe, kind: "suv", length: 1.9, width: 0.92 },
  { t: 0.316, speed: 9.1, phase: 3.4, dir: -1, spacing: 22, count: 3, color: 0xe0a020, kind: "car", length: 1.8, width: 0.8 },
  { t: 0.437, speed: 5.8, phase: 11, dir: -1, spacing: 36, count: 2, color: 0xd8dde3, kind: "truck", length: 3.7, width: 1.12 },
  { t: 0.627, speed: 7.2, phase: 2.2, dir: 1, spacing: 28, count: 3, color: 0x3d8f6a, kind: "van", length: 2.35, width: 0.96 },
  { t: 0.73, speed: 10.2, phase: 8.8, dir: 1, spacing: 26, count: 3, color: 0xb9c4ce, kind: "car", length: 1.8, width: 0.8 },
  { t: 0.838, speed: 6.1, phase: 5.1, dir: 1, spacing: 40, count: 2, color: 0xf2f4f6, kind: "bus", length: 4.5, width: 1.16 },
  { t: 0.949, speed: 8, phase: 14.4, dir: 1, spacing: 28, count: 3, color: 0x8a4b2f, kind: "suv", length: 1.9, width: 0.92 },
];

export function createGame(): Game {
  const game: Game = {
    phase: "ready",
    time: (4.72 - 0.22) / MOM_SPEED,
    momS: 5.5,
    childS: 4.72,
    lateral: 0,
    lateralVel: 0,
    pause: 0,
    curbUsed: false,
    medianWait: false,
    medianReady: 0,
    medianUsed: false,
    yeet: 0,
    yeetDir: 1,
    message: "",
    outcome: "",
    success: false,
    checkpoint: "park",
    savedBrood: BROOD_COUNT,
    childDelta: 0,
    momDelta: 0,
    roadSpeed: 0,
    crowdAt: -1,
    momLateral: 0,
    brood: createBrood(),
    broodHeadcount: BROOD_COUNT,
    rescuePop: 0,
    rescuePopText: "",
    rescued: 0,
    savedRescued: 0,
    continues: 0,
    trail: [{ s: 0.22, lateral: 0, time: 0 }],
  };
  placeBrood(game);
  placeStrays(game, -1);
  return game;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeBroodling(index: number, mood: BroodMood): Broodling {
  return {
    s: 0,
    lateral: 0,
    mood,
    stroll: "follow",
    strollUntil: 0,
    strollAim: 0,
    strollSide: index % 2 === 0 ? 1 : -1,
    strollFlip: 0,
    strollBeat: 0.5,
    rand: mulberry32(Math.floor(Math.random() * 0x7fffffff) + index * 17 + 3),
    phase: "walk",
    yeet: 0,
    yeetDir: 1,
    seed: index * 1.7 + 0.4,
    moved: 0,
    stray: false,
    rescueable: false,
  };
}

function createBrood(): Broodling[] {
  const moods = [...BROOD_MOODS];
  for (let i = moods.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [moods[i], moods[j]] = [moods[j], moods[i]];
  }
  return moods.map((mood, index) => makeBroodling(index, mood));
}

function plantChick(kid: Broodling, game: Game, slot: number): void {
  const live = Math.max(1, walkingBrood(game) + (kid.phase === "walk" ? 0 : 1));
  kid.phase = "walk";
  kid.yeet = 0;
  kid.yeetDir = 1;
  kid.moved = 0;
  kid.stroll = "follow";
  kid.strollUntil = 0;
  kid.rescueable = false;
  const pos = followerSlot(slot, live, game.childS);
  kid.s = Math.max(0, game.childS - pos.ds);
  kid.lateral = game.lateral + pos.lat;
}

function addBrood(game: Game, n: number): void {
  let need = n;
  for (const kid of game.brood) {
    if (need <= 0) break;
    if (kid.phase !== "gone" || kid.stray) continue;
    plantChick(kid, game, n - need);
    need--;
  }
  while (need > 0) {
    const index = game.brood.length;
    const kid = makeBroodling(index, BROOD_MOODS[index % BROOD_MOODS.length]);
    plantChick(kid, game, n - need);
    game.brood.push(kid);
    need--;
  }
}

function walkingBrood(game: Game): number {
  let n = 0;
  for (const kid of game.brood) if (kid.phase === "walk") n++;
  return n;
}

function topUpBrood(game: Game): void {
  const want = Math.min(game.broodHeadcount, MAX_BROOD_BODIES);
  const have = walkingBrood(game);
  if (have < want) addBrood(game, want - have);
}

function dropChick(game: Game, kid: Broodling, next: BroodPhase, yeetDir = 1): void {
  if (kid.phase !== "walk") return;
  game.broodHeadcount = Math.max(0, game.broodHeadcount - 1);
  kid.moved = 0;
  kid.stroll = "follow";
  const drown = next === "yeet" && yeetDir === 0;
  const id = segmentAt(kid.s).id;
  const spot = drown || id === "road" ? null : strandSpot(kid.s, kid.lateral, yeetDir, id);
  if (!spot) {
    kid.rescueable = false;
    kid.phase = next === "yeet" || drown ? "yeet" : "gone";
    if (kid.phase === "yeet") {
      kid.yeet = 0;
      kid.yeetDir = yeetDir;
    }
    return;
  }
  kid.phase = "yeet";
  kid.yeet = 0;
  kid.yeetDir = yeetDir === 0 ? Math.sign(kid.lateral || 1) : yeetDir;
  kid.rescueable = true;
  kid.s = spot.s;
  kid.lateral = spot.lateral;
}

function packSpeed(): number {
  return MOM_SPEED;
}

function strandSpot(s: number, lateral: number, dir: number, id: SegmentId): { s: number; lateral: number } | null {
  const side = (dir || lateral) >= 0 ? 1 : -1;
  const edge = STRAND[id];
  if (edge === null) return null;
  const lat = side * edge;
  const tryAt = (along: number, offset: number) => {
    const pose = poseAt(along, offset);
    return inLake(pose.x, pose.z) ? null : { s: along, lateral: offset };
  };
  return tryAt(s + 0.08, lat) ?? tryAt(s + 0.08, -lat);
}

// Where a knocked-over sibling lands to wait for rescue; null means it is gone for good.
const STRAND: Record<SegmentId, number | null> = {
  park: 1.58,
  walk: 1.56,
  road: null,
  crowd: 0.94,
  nest: 0.86,
  ...byStage((stage) => stage.strand),
};

// How far along the path each lost chick may wander from its listed spot.
const SCATTER: Record<SegmentId, number> = {
  park: 1.6,
  walk: 10,
  road: 1.6,
  crowd: 4,
  nest: 1.6,
  ...byStage((stage) => stage.scatter),
};

function passedStray(game: Game, kid: Broodling): boolean {
  if (game.childS > kid.s + RESCUE_PASS) return true;
  return game.momS - kid.s > loseGap(segmentAt(kid.s).id) + 1.2;
}

function rescueReach(game: Game, kid: Broodling): boolean {
  return Math.hypot(kid.s - game.childS, kid.lateral - game.lateral) <= RESCUE_REACH;
}

function rescueChick(game: Game, kid: Broodling): void {
  game.broodHeadcount += 1;
  game.rescued += 1;
  plantChick(kid, game, 0);
  game.rescuePop = 0.95;
  game.rescuePopText = "助かった！";
}

function gatherRescues(game: Game): void {
  for (const kid of game.brood) {
    if (kid.phase === "yeet" && kid.rescueable && rescueReach(game, kid)) {
      rescueChick(game, kid);
      continue;
    }
    if (kid.phase !== "stranded") continue;
    if (rescueReach(game, kid)) rescueChick(game, kid);
    else if (passedStray(game, kid)) kid.phase = "gone";
  }
}

// Lost chicks turn up somewhere a little different every run, so the spots can't just be memorised.
function scatterSpot(spot: LostChick): LostChick {
  const seg = segmentAt(spot.s);
  const range = SCATTER[seg.id];
  for (let i = 0; i < 16; i++) {
    const s = spot.s + (Math.random() * 2 - 1) * range;
    const lateral = (Math.random() < 0.5 ? -1 : 1) * Math.abs(spot.lateral);
    if (s < seg.start + 3 || s > seg.end - 3) continue;
    const pose = poseAt(s, lateral);
    if (inLake(pose.x, pose.z)) continue;
    if (seg.id === "park" && (lateral < parkMinL || lateral > parkMaxL || !parkReachable(s, lateral))) continue;
    if (walkProps.some((prop) => Math.hypot(s - prop.s, lateral - prop.lateral) < prop.radius + 0.4)) continue;
    return { s, lateral };
  }
  return spot;
}

// The spot and the stretch leading up to it from the trail must be free of rocks.
function parkReachable(s: number, lateral: number): boolean {
  if (parkBlocked(s, lateral, 0.24)) return false;
  for (const back of [0.5, 1, 1.6, 2.2]) {
    for (const part of [0.25, 0.55, 0.85]) {
      if (parkBlocked(s - back, lateral * part, 0.3)) return false;
    }
  }
  return true;
}

function placeStrays(game: Game, afterS: number): void {
  game.brood = game.brood.filter((kid) => !kid.stray);
  for (const lost of lostChicks) {
    const spot = scatterSpot(lost);
    if (spot.s <= afterS + 0.4) continue;
    const kid = makeBroodling(game.brood.length, "cling");
    kid.phase = "stranded";
    kid.stray = true;
    kid.rescueable = true;
    kid.s = spot.s;
    kid.lateral = spot.lateral;
    kid.stroll = "stop";
    game.brood.push(kid);
  }
}

function placeBrood(game: Game): void {
  const want = Math.min(Math.max(0, game.broodHeadcount), MAX_BROOD_BODIES);
  const family: Broodling[] = [];
  for (const kid of game.brood) {
    if (kid.stray) continue;
    family.push(kid);
    if (family.length >= want) break;
  }
  while (family.length < want) {
    const index = family.length;
    family.push(makeBroodling(index, BROOD_MOODS[index % BROOD_MOODS.length]));
  }
  family.forEach((kid, index) => {
    kid.stray = false;
    kid.rescueable = false;
    kid.phase = "walk";
    kid.yeet = 0;
    kid.yeetDir = 1;
    kid.moved = 0;
    kid.stroll = "follow";
    kid.strollUntil = 0;
    const pos = followerSlot(index, want, game.childS);
    kid.s = Math.max(0, game.childS - pos.ds);
    kid.lateral = game.lateral + pos.lat;
  });
  game.brood = family;
  resetTrail(game);
}

// The second half of a stage keeps the first half's checkpoint.
function checkpointOf(id: SegmentId): SegmentId {
  return stageOf(id)?.checkpoint ?? id;
}

function reachCheckpoint(game: Game, id: SegmentId): void {
  if (game.checkpoint === id) return;
  game.checkpoint = id;
  game.savedBrood = game.broodHeadcount;
  game.savedRescued = game.rescued;
}

export function begin(game: Game): void {
  const fresh = createGame();
  Object.assign(game, fresh);
  placeBrood(game);
  placeStrays(game, -1);
  game.phase = "play";
}

export function canContinue(game: Game): boolean {
  return !game.success && game.broodHeadcount - 1 >= 1;
}

export function retry(game: Game): void {
  const resume = canContinue(game);
  const id = resume ? game.checkpoint : "park";
  const savedBrood = resume ? game.broodHeadcount - 1 : BROOD_COUNT;
  const continues = resume ? game.continues + 1 : 0;
  const savedRescued = resume ? game.rescued : 0;
  startAt(game, id, savedBrood, continues, savedRescued);
}

// Developer skip: start fresh (full brood, no continues) at a stage's checkpoint.
export function warpTo(game: Game, id: SegmentId): void {
  startAt(game, checkpointOf(id), BROOD_COUNT, 0, 0);
}

// The stages a warp can land on: one per checkpoint, in course order.
export function warpStops(): { id: SegmentId; name: string }[] {
  return segments.filter((seg) => checkpointOf(seg.id) === seg.id).map((seg) => ({ id: seg.id, name: seg.name }));
}

function startAt(game: Game, id: SegmentId, savedBrood: number, continues: number, savedRescued: number): void {
  const fresh = createGame();
  Object.assign(game, fresh);
  game.phase = "play";
  game.checkpoint = id;
  game.savedBrood = savedBrood;
  game.broodHeadcount = savedBrood;
  game.continues = continues;
  game.savedRescued = savedRescued;
  game.rescued = savedRescued;
  if (id === "walk") {
    game.momS = walkStart + 1.1;
    game.childS = walkStart + 0.18;
  } else if (id === "road") {
    game.momS = roadStart;
    game.childS = roadStart - 0.72;
    game.pause = 0.95;
    game.curbUsed = true;
  } else if (id === "crowd") {
    game.momS = crowdStart + 1.15;
    game.childS = crowdStart + 0.12;
    game.curbUsed = true;
    game.crowdAt = 0;
  } else if (id === "nest") {
    game.momS = nestStart + 0.9;
    game.childS = nestStart + 0.12;
    game.curbUsed = true;
  } else if (stageOf(id)) {
    const seg = segments.find((segment) => segment.id === id)!;
    game.childS = seg.start + 0.18;
    game.momS = game.childS + Math.max(0.92, (stageOf(id)?.follow ?? FOLLOW_GAP) + 0.1);
    game.curbUsed = true;
  }
  placeBrood(game);
  placeStrays(game, game.childS);
}

const CROWD_LANES = [-0.78, 0, 0.78];

type TrafficLane = {
  lateral: number;
  speed: number;
  delay: number;
  spacing: number;
  count: number;
  color: number;
};

function laneCount(length: number, spacing: number, recycleGap: number): number {
  const cycle = length + 1.2 + recycleGap;
  return Math.max(5, Math.floor((cycle - 0.45) / spacing));
}

const crowdLength = Math.max(0.001, crowdEnd - crowdStart);
const walkLength = Math.max(0.001, roadStart - walkStart);
const CROWD_GAP = 1.15;

const PEOPLE: TrafficLane[] = [
  { lateral: CROWD_LANES[0], speed: 1.9, delay: 0.15, spacing: 4.05, count: 0, color: 0x3d5a80 },
  { lateral: CROWD_LANES[1], speed: 1.9, delay: 1.5, spacing: 4.05, count: 0, color: 0xc4493a },
  { lateral: CROWD_LANES[2], speed: 1.9, delay: 2.85, spacing: 4.05, count: 0, color: 0x2f6f4e },
];
for (const lane of PEOPLE) lane.count = laneCount(crowdLength, lane.spacing, CROWD_GAP);

// The whole walk before the road is people on foot: strollers, plus a few joggers who close in much faster
// and keep nearer the hedges. Each pass rolls its own pace.
const WALKERS = 70;
const WALKER_SLOW = 0.85;
const WALKER_FAST = 1.5;
const WALKER_REST = 1.2;
const WALKER_STRIDE = 4.9;
const RUNNERS = 14;
const RUNNER_SLOW = 3;
const RUNNER_FAST = 4.2;
const RUNNER_REST = 1.4;
const RUNNER_STRIDE = 3.8;
// Everyone keeps to the middle of the pavement, so the strip along either edge is always clear.
const WALK_CROWD_REACH = 0.72;
// Where mom walks, and where the guide heads: inside that clear strip, short of the hedge.
const WALK_EDGE = 1.08;
// The crowd thins out this far from the park, leaving time to get to the edge.
const WALK_CROWD_EXIT = 6;
// And it starts this far short of the highway, so nobody walks into the brood bunching up at the curb.
const WALK_CROWD_ENTRY = 7;
const WALKER_COLORS = [0x3d5a80, 0xc46b3a, 0x2f6f4e, 0x8a5a9e, 0xb8873a, 0x4a7f9a, 0x9e3d4f];

// Only the crowd after the road has bikes.
const CROWD_BIKES = 5;
const CROWD_BIKE_REACH = 0.95;
const BIKE_COLORS = [0x2a6fdb, 0xd9473b, 0x2f8f5b, 0xe0a020, 0x7a4fc4, 0x1d2430, 0xe86fa0];
const BIKE_REST = 1.4;
const BIKE_SLOW = 4.3;
const BIKE_FAST = 6.6;

// Nothing may pop up right in front of the lead chick, nor on top of the brood behind it: a body whose
// pass would begin inside that stretch sits the whole pass out. Decided once per pass, then kept.
const SPAWN_MIN = 6;
const SPAWN_LEAD = 1.5;
let spawnFront = Infinity;
let spawnTail = Infinity;
let spawnClock = -Infinity;
const spawnGate = new Map<string, boolean>();

export function watchSpawns(front: number, tail: number, time: number): void {
  if (time < spawnClock) spawnGate.clear();
  spawnFront = front;
  spawnTail = tail;
  spawnClock = time;
}

function spawnClear(id: number, pass: number, s: number, speed: number): boolean {
  const key = `${id}:${pass}`;
  let ok = spawnGate.get(key);
  if (ok === undefined) {
    const lead = Math.max(SPAWN_MIN, (speed + MOM_SPEED) * SPAWN_LEAD);
    ok = s - spawnFront > lead || s < spawnTail - 1;
    spawnGate.set(key, ok);
  }
  return ok;
}

type Oncoming = {
  x: number;
  z: number;
  s: number;
  lateral: number;
  yaw: number;
  fade: number;
  stride: number;
  speed: number;
  color: number;
};

function oncomingAt(
  clock: number,
  originS: number,
  length: number,
  lanes: TrafficLane[],
  zone0: number,
  zone1: number,
  recycleGap: number,
  strideRate: number,
): Oncoming[] {
  const entry = length;
  const exit = -1.2;
  const span = entry - exit;
  const list: Oncoming[] = [];
  lanes.forEach((lane, laneIndex) => {
    for (let i = 0; i < lane.count; i++) {
      const delay = lane.delay + lane.spacing * i;
      const traveled = clock < 0 ? -1 : clock * lane.speed - delay;
      let along = entry;
      let fade = 0;
      let stride = 0;
      if (traveled >= 0) {
        const cycle = span + recycleGap;
        const into = ((traveled % cycle) + cycle) % cycle;
        along = entry - into;
        const zoneIn = Math.min(1, Math.max(0, (along - zone0) / 1.15));
        const zoneOut = Math.min(1, Math.max(0, (zone1 - along) / 1.15));
        const fadeIn = Math.min(1, Math.max(0, (entry - along) / 1.35));
        const fadeOut = Math.min(1, Math.max(0, (along - exit) / 0.8));
        fade = along > entry || along < exit ? 0 : Math.min(fadeIn, fadeOut, zoneIn, zoneOut);
        if (!spawnClear(500 + laneIndex * 100 + i, Math.floor(traveled / cycle), originS + along, lane.speed)) fade = 0;
        stride = traveled * strideRate;
      }
      const s = originS + along;
      const pose = poseAt(s, lane.lateral);
      list.push({
        x: pose.x,
        z: pose.z,
        s,
        lateral: lane.lateral,
        yaw: pose.yaw + Math.PI,
        fade,
        stride,
        speed: lane.speed,
        color: lane.color,
      });
    }
  });
  return list;
}

function toPerson(body: Oncoming): Person {
  return {
    x: body.x,
    z: body.z,
    s: body.s,
    lateral: body.lateral,
    dir: -1,
    yaw: body.yaw,
    color: body.color,
    length: 0.36,
    width: 0.24,
    visible: body.fade > 0.04,
    fade: body.fade,
    stride: body.stride,
    run: false,
  };
}

let peopleKey = "";
let peopleCache: Person[] = [];

export function peopleAt(time: number, crowdAt: number): Person[] {
  const key = `${time}|${crowdAt}`;
  if (key === peopleKey) return peopleCache;
  const clock = crowdAt < 0 ? -1 : time - crowdAt;
  const bodies = oncomingAt(clock, crowdStart, crowdLength, PEOPLE, -8, crowdLength + 8, CROWD_GAP, 8.2);
  peopleCache = bodies.map((body) => toPerson(body));
  peopleKey = key;
  return peopleCache;
}

export type Bike = {
  s: number;
  lateral: number;
  radius: number;
  yaw: number;
  x: number;
  z: number;
  visible: boolean;
  speed: number;
  color: number;
};

let bikeKey = "";
let bikeCache: Bike[] = [];

function hash01(a: number, b: number, salt: number): number {
  let h = Math.imul(a + 0x9e37, 0x85ebca6b) ^ Math.imul(b + 0x7f4a, 0xc2b2ae35) ^ Math.imul(salt, 0x27d4eb2f);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}

// Every body loops forever; each pass rolls a fresh speed and start delay (and the caller a fresh lane),
// so the timing and the side they come down never settle into a pattern.
function loopPass(
  id: number,
  slot: number,
  count: number,
  time: number,
  entry: number,
  exit: number,
  slow: number,
  fast: number,
  rest: number,
): { pass: number; ride: number; along: number; speed: number } | null {
  const slowest = (entry - exit) / slow;
  const cycle = slowest + rest * 2;
  const shifted = time + (slot * cycle) / count + hash01(id, -1, 3) * 1.6;
  const pass = Math.floor(shifted / cycle);
  const local = shifted - pass * cycle;
  const speed = slow + (fast - slow) * hash01(id, pass, 1);
  const delay = hash01(id, pass, 2) * rest * 2;
  const ride = local - delay;
  if (ride < 0) return null;
  const along = entry - ride * speed;
  if (along < exit) return null;
  return { pass, ride, along, speed };
}

function bikeAt(id: number, slot: number, count: number, clock: number, originS: number, entry: number): Bike {
  const ride = clock >= 0 ? loopPass(id, slot, count, clock, entry, -1.2, BIKE_SLOW, BIKE_FAST, BIKE_REST) : null;
  let lateral = 0;
  if (ride) {
    const base = (hash01(id, ride.pass, 4) * 2 - 1) * CROWD_BIKE_REACH;
    const sway = Math.sin(ride.ride * (1.6 + hash01(id, ride.pass, 5) * 1.4) + id) * 0.07;
    lateral = Math.max(-CROWD_BIKE_REACH, Math.min(CROWD_BIKE_REACH, base + sway));
  }
  const along = ride ? ride.along : entry + 2;
  const s = originS + along;
  const pose = poseAt(s, lateral);
  // They roll in at the far end of their stretch and vanish before reaching the camera.
  const zone = along > 1.6 && along < entry - 0.5 && ride !== null && spawnClear(id, ride.pass, s, ride.speed);
  return {
    s,
    lateral,
    radius: 0.26,
    yaw: pose.yaw + Math.PI,
    x: pose.x,
    z: pose.z,
    visible: ride !== null && zone,
    speed: ride ? ride.speed : 0,
    color: BIKE_COLORS[id % BIKE_COLORS.length],
  };
}

// They only start once the brood is past the road.
export function bikesAt(time: number, crowdAt = -1): Bike[] {
  const key = `${time}|${crowdAt}`;
  if (key === bikeKey) return bikeCache;
  const list: Bike[] = [];
  const clock = crowdAt < 0 ? -1 : time - crowdAt;
  for (let i = 0; i < CROWD_BIKES; i++) {
    list.push(bikeAt(100 + i, i, CROWD_BIKES, clock, crowdStart, crowdLength + 1.5));
  }
  bikeCache = list;
  bikeKey = key;
  return bikeCache;
}

// A little inside the visible edge, so a graze can overlap before it counts.
const BIKE_ALONG = 0.42;
const BIKE_SIDE = 0.22;
const PERSON_ALONG = 0.26;
const PERSON_SIDE = 0.22;
const CAR_ALONG = 0.12;
const CAR_SIDE = 0.1;
export const CHICK_BODY = 0.1;

export function bikeHits(s: number, lateral: number, bike: Bike): boolean {
  return bike.visible && Math.abs(s - bike.s) < BIKE_ALONG && Math.abs(lateral - bike.lateral) < BIKE_SIDE;
}

let walkerKey = NaN;
let walkerCache: Person[] = [];

export function walkersAt(time: number): Person[] {
  if (time === walkerKey) return walkerCache;
  const entry = walkLength - WALK_CROWD_ENTRY;
  const list: Person[] = [];
  for (let i = 0; i < WALKERS + RUNNERS; i++) {
    const run = i >= WALKERS;
    const id = 200 + i;
    const ride =
      time < 0
        ? null
        : run
          ? loopPass(id, i - WALKERS, RUNNERS, time, entry, WALK_CROWD_EXIT, RUNNER_SLOW, RUNNER_FAST, RUNNER_REST)
          : loopPass(id, i, WALKERS, time, entry, WALK_CROWD_EXIT, WALKER_SLOW, WALKER_FAST, WALKER_REST);
    const along = ride ? ride.along : entry;
    const lateral = ride ? (hash01(id, ride.pass, 4) * 2 - 1) * WALK_CROWD_REACH : 0;
    const s = walkStart + along;
    const pose = poseAt(s, lateral);
    const shown = ride !== null && spawnClear(id, ride.pass, s, ride.speed);
    const fade = shown ? Math.max(0, Math.min(1, (entry - along) / 1.35, (along - WALK_CROWD_EXIT) / 0.8)) : 0;
    list.push({
      x: pose.x,
      z: pose.z,
      s,
      lateral,
      dir: -1,
      yaw: pose.yaw + Math.PI,
      color: WALKER_COLORS[i % WALKER_COLORS.length],
      length: 0.36,
      width: 0.24,
      visible: fade > 0.04,
      fade,
      stride: ride ? ride.ride * ride.speed * (run ? RUNNER_STRIDE : WALKER_STRIDE) : 0,
      run,
    });
  }
  walkerCache = list;
  walkerKey = time;
  return walkerCache;
}

export function carsAt(time: number): Car[] {
  const roadLen = roadEnd - roadStart;
  const list: Car[] = [];
  for (const lane of LANES) {
    const spot = pointAt(roadStart + lane.t * roadLen);
    const span = lane.spacing * lane.count;
    for (let i = 0; i < lane.count; i++) {
      const raw = time * lane.speed * lane.dir + lane.phase + lane.spacing * i;
      const u = ((raw % span) + span) % span;
      list.push({
        x: spot.x - span / 2 + u,
        z: spot.z,
        dir: lane.dir,
        speed: lane.speed,
        color: lane.color,
        kind: lane.kind,
        length: lane.length,
        width: lane.width,
      });
    }
  }
  return list;
}

export function oncomingFlip(s: number): number {
  const roadLen = roadEnd - roadStart;
  const t = (s - roadStart) / roadLen;
  const u = Math.min(1, Math.max(0, (t - 0.44) / 0.12));
  return u * u * (3 - 2 * u);
}

export function hitsCar(child: Pose, car: Car): boolean {
  return Math.abs(child.x - car.x) < car.length * 0.5 + CAR_ALONG && Math.abs(child.z - car.z) < car.width * 0.5 + CAR_SIDE;
}

export function hitsPerson(child: { s: number; lateral: number }, person: Person): boolean {
  if (!person.visible || person.fade < 0.72) return false;
  return Math.abs(child.s - person.s) < PERSON_ALONG && Math.abs(child.lateral - person.lateral) < PERSON_SIDE;
}

export function motherPose(game: Game): Pose {
  return poseAt(game.momS, game.momLateral);
}

export function childPose(game: Game): Pose {
  return poseAt(game.childS, game.lateral);
}

export function broodPose(game: Game, index: number): Pose {
  const kid = game.brood[index];
  return poseAt(kid.s, kid.lateral);
}

export function broodFlight(game: Game, index: number): { x: number; y: number; spin: number } | null {
  const kid = game.brood[index];
  if (kid.phase !== "yeet") return null;
  const t = Math.min(1, kid.yeet / YEET_TIME);
  if (kid.yeetDir === 0) return sinkFlight(t);
  if (kid.rescueable) {
    return {
      x: 0,
      y: Math.sin(t * Math.PI) * 0.55,
      spin: t * Math.PI * 0.9 * kid.yeetDir,
    };
  }
  return {
    x: kid.yeetDir * t * 3.4,
    y: Math.sin(t * Math.PI) * 1.55,
    spin: t * Math.PI * 4,
  };
}

export function broodWaiting(game: Game): number {
  let n = 0;
  for (const kid of game.brood) if (kid.phase === "stranded") n++;
  return n;
}

export function broodNearby(game: Game): number {
  let n = 0;
  for (const kid of game.brood) {
    if (kid.phase !== "stranded") continue;
    const ahead = kid.s - game.childS;
    if (ahead > -0.7 && ahead < 5.8) n++;
  }
  return n;
}

export function broodAlive(game: Game): number {
  return game.broodHeadcount;
}

export function placeName(game: Game): string {
  if (game.medianWait) return "空いたら渡ろう";
  return shownSegment(game).name;
}

const HINTS: Record<SegmentId, string> = {
  park: "左右で岩や切り株をよけよう",
  walk: "人がいっぱい！はじっこを歩こう",
  road: "左右で進む・戻る。車線のあいだで待って渡ろう",
  crowd: "人と自転車のすきまを左右でぬけよう",
  nest: "あと少し！",
  ...byStage((stage) => stage.hint),
};

export function placeHint(game: Game): string {
  if (broodNearby(game) > 0) return "はぐれた子に近づいて助けよう";
  const shown = shownSegment(game).id;
  return stageOf(shown)?.liveHint?.(game.time) ?? HINTS[shown];
}

export function controlMode(game: Game): "lateral" | "longitudinal" {
  return shownSegment(game).control;
}

function shownSegment(game: Game) {
  return segmentAt(game.childS);
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function finish(game: Game, message: string, success: boolean, yeetDir?: number): void {
  game.outcome = message;
  game.message = message;
  game.success = success;
  game.childDelta = 0;
  game.momDelta = 0;
  if (yeetDir === undefined) {
    game.phase = "result";
    return;
  }
  game.phase = "yeet";
  game.yeet = 0;
  game.yeetDir = yeetDir;
}

export function update(game: Game, input: FrameInput, dt: number): void {
  if (game.phase === "yeet") {
    game.yeet += dt;
    game.childDelta = 0;
    game.momDelta = 0;
    if (game.yeet >= YEET_TIME) {
      game.yeet = YEET_TIME;
      game.phase = "result";
    }
    return;
  }
  if (game.phase !== "play") return;

  const step = Math.min(dt, 0.05);
  game.time += step;
  if (game.rescuePop > 0) game.rescuePop = Math.max(0, game.rescuePop - step);
  if (game.crowdAt < 0 && game.childS >= roadEnd) game.crowdAt = game.time;
  let tail = game.childS;
  for (const kid of game.brood) if (kid.phase === "walk" && !kid.stray) tail = Math.min(tail, kid.s);
  watchSpawns(game.childS, tail, game.time);
  for (const stage of STAGE_LIST) stage.watch?.(game.childS, tail, game.time, game.lateral);
  const crowdPeople = peopleAt(game.time, game.crowdAt);
  const crowdBikes = bikesAt(game.time, game.crowdAt);
  const momOnSidewalk = game.momS >= crowdStart - 0.15 && game.momS < crowdEnd + 0.15;
  const momOnWalk = game.momS >= walkStart && game.momS < roadStart;
  const momOnPark = game.momS < walkStart;
  const momTarget = momOnSidewalk
    ? crowdPocket(game.momS, game.momLateral, crowdPeople, crowdBikes)
    : momOnWalk
      ? WALK_EDGE
      : momOnPark
        ? clearLateral(game.momS + 0.6, game.momLateral, 0.36, parkGuideMin, parkGuideMax)
        : (stageOf(segmentAt(game.momS).id)?.guide?.(game.momS, game.momLateral, game.time) ?? 0);
  const momPull = momOnPark ? 5.4 : momOnWalk || momOnSidewalk ? 5.2 : 3.5;
  game.momLateral += (momTarget - game.momLateral) * Math.min(1, step * momPull);

  const momBefore = game.momS;
  if (game.momS >= roadStart && !game.curbUsed) {
    game.curbUsed = true;
    game.pause = 0.95;
    game.momS = roadStart;
  }
  let momSpeed = 0;
  const medianStop = medianStopS();
  if (game.momS < goal) {
    if (game.pause > 0) {
      game.pause = Math.max(0, game.pause - step);
      game.momS = roadStart;
    } else if (!game.medianUsed && game.momS < roadEnd && (game.medianWait || game.momS >= medianStop)) {
      if (!game.medianWait) game.medianReady = game.time + 0.7;
      game.medianWait = true;
      game.momS = Math.min(game.momS, medianStop);
      if (game.time >= game.medianReady && input.forward) {
        game.medianWait = false;
        game.medianUsed = true;
        momSpeed = motherSpeed(game, carsAt(game.time), step);
      }
    } else {
      momSpeed = motherSpeed(game, carsAt(game.time), step);
    }
    // Go/stop stages tell mom when it is safe to walk on.
    const momPace = stageOf(segmentAt(game.momS).id)?.momPace;
    if (momPace && momSpeed > 0) momSpeed = momPace(game.momS, game.time, momSpeed);
  }
  game.momS = Math.min(goal, game.momS + momSpeed * step);
  if (!game.medianUsed && game.momS >= medianStop && game.momS < roadEnd) {
    if (!game.medianWait) game.medianReady = game.time + 0.7;
    game.momS = medianStop;
    game.medianWait = true;
  }
  game.momDelta = game.momS - momBefore;
  if (game.momS < walkStart) game.momLateral = slidePark(game.momS, game.momLateral, 0.34);

  const view = shownSegment(game);
  if (game.childS >= view.start - 0.2) reachCheckpoint(game, checkpointOf(view.id));

  const childBefore = game.childS;
  if (view.control === "lateral") {
    const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    const stage = stageOf(view.id);
    const steerRate = STEER[view.id];
    const want = steer * steerRate;
    game.lateralVel = footSpeed(game.lateralVel, want, steerRate, GRIP[view.id], BRAKE[view.id], step);
    game.lateral += game.lateralVel * step;
    if (stage?.drift) game.lateral += stage.drift(game.childS, game.lateral, game.time) * step;
    const limit = view.id === "nest" ? 1.7 : view.id === "park" ? Math.max(-parkMinL, parkMaxL) + 0.15 : 3.1;
    const bound = stage ? stage.bound : view.id === "crowd" ? 1.1 : view.id === "walk" ? walkSide : limit;
    if (Math.abs(game.lateral) > bound) {
      game.lateral = Math.sign(game.lateral) * bound;
      game.lateralVel = 0;
    }
    const off = Math.abs(game.lateral);
    const hedge = view.id === "walk" ? walkHedgeDepth(game.lateral) : 0;
    if (hedge > 0) game.lateralVel *= Math.max(0, 1 - step * 4 * hedge);
    const slow = stage
      ? (stage.slow?.(game.childS, game.lateral, game.time) ?? 0)
      : view.id === "crowd"
        ? 0
        : view.id === "park"
          ? Math.max(smoothstep(2.35, 3.05, off), parkOffTrail(game.childS, game.lateral))
          : view.id === "walk"
            ? hedge
            : smoothstep(0.32, 1.15, off);
    const drag = view.id === "walk" ? 0.8 : 0.72;
    // Lead chick: stay just behind mom, and hurry a little after a detour.
    const follow = stage?.follow ?? FOLLOW_GAP;
    const lag = game.momS - game.childS - follow;
    const hurry = 1 + Math.max(-0.3, Math.min(0.35, lag * 0.3));
    game.childS += packSpeed() * hurry * (1 - slow * drag) * step;
    const cap = game.pause > 0 ? game.momS - 0.12 : game.momS - follow;
    // Coming off a go/stop stretch the chick may be closer to mom than it likes: wait for her to pull
    // ahead rather than stepping back across the seam (which flicked the stage back for a frame).
    if (game.childS > cap) game.childS = Math.max(Math.min(childBefore, game.childS), cap);
  } else {
    game.lateralVel = 0;
    game.lateral += (0 - game.lateral) * Math.min(1, step * 10);
    let target = game.pause > 0 ? 0 : packSpeed();
    if (input.forward && !game.medianWait) target = packSpeed() * 1.85;
    if (input.back) target = 0;
    if (game.medianWait && game.childS >= medianStop - 0.08) target = 0;
    const stage = stageOf(view.id);
    const top = packSpeed() * 1.85;
    const coast = top / ROAD_RATE;
    game.roadSpeed = footSpeed(
      game.roadSpeed,
      target,
      top,
      input.forward ? ROAD_LAUNCH : coast,
      input.forward || input.back ? top / ROAD_STOP : coast,
      step,
    );
    game.roadSpeed = Math.max(0, game.roadSpeed);
    game.childS += game.roadSpeed * step;
    const rear = roadStart - 0.95;
    if (game.childS < rear) game.childS = rear;
    if (target === 0) holdLane(game, step);
    if (!game.medianUsed && game.childS >= roadStart && game.childS < roadEnd && game.childS > medianStop) {
      game.childS = medianStop;
      game.roadSpeed = 0;
    }
    // On the added go/stop stages the chick bumps up behind a waiting mom instead of overtaking her.
    if (stage && game.childS > game.momS - MOM_BUMP) {
      game.childS = Math.max(childBefore, game.momS - MOM_BUMP);
      game.roadSpeed = Math.min(game.roadSpeed, Math.max(0, game.momDelta / Math.max(step, 1e-4)));
    }
  }
  if (view.id === "park") {
    const body = CHICK_BODY;
    const climb = parkClimb(game.childS, game.lateral, body);
    if (climb > 0) {
      const gained = game.childS - childBefore;
      game.childS = childBefore + gained * (1 - climb * 0.68);
    }
    const slid = slidePark(game.childS, game.lateral, body);
    if (Math.abs(slid - game.lateral) > 1e-4) game.lateralVel *= 0.3;
    game.lateral = slid;
  }
  game.childDelta = game.childS - childBefore;
  recordTrail(game);
  gatherRescues(game);
  updateBrood(game, step);

  const after = shownSegment(game);
  if (game.childS >= after.start - 0.2) reachCheckpoint(game, checkpointOf(after.id));

  const child = childPose(game);
  if (Math.abs(game.lateral) > pathHalf && inLake(child.x, child.z)) {
    finish(game, DROWNED, false, 0);
    return;
  }

  if (after.control === "lateral") {
    if (after.id === "park" && (game.lateral < parkMinL || game.lateral > parkMaxL)) {
      finish(game, after.lost, false);
      return;
    }
    if (after.id === "nest" && Math.abs(game.lateral) > 1.28) {
      finish(game, after.lost, false);
      return;
    }
  }

  const leaveGap = loseGap(after.id);
  if (game.momS - game.childS > leaveGap) {
    finish(game, after.lost, false);
    return;
  }

  if (after.control === "longitudinal" && game.childS > game.momS + OVERTAKE_LEAD) {
    finish(game, OVERTURN, false);
    return;
  }

  if (after.id === "road") {
    for (const car of carsAt(game.time)) {
      if (hitsCar(child, car)) {
        finish(game, YEETED, false, car.dir);
        return;
      }
    }
  }

  if (after.id === "walk") {
    const trip = walkMishap(game.childS, game.lateral, game.time);
    if (trip) {
      finish(game, trip.message, false, trip.dir);
      return;
    }
  }

  if (after.id === "crowd" && game.childS < crowdEnd + 0.35) {
    for (const person of crowdPeople) {
      if (!hitsPerson({ s: game.childS, lateral: game.lateral }, person)) continue;
      finish(game, KICKED, false, person.dir);
      return;
    }
    for (const bike of crowdBikes) {
      if (!bikeHits(game.childS, game.lateral, bike)) continue;
      finish(game, BIKED, false, game.lateral >= 0 ? 1 : -1);
      return;
    }
  }

  const stageTrip = stageOf(after.id)?.mishap?.(game.childS, game.lateral, game.time, true);
  if (stageTrip) {
    finish(game, stageTrip.message, false, stageTrip.dir);
    return;
  }

  if (game.momS >= goal - 0.04 && game.momS - game.childS < 1.4 && Math.abs(game.lateral) < 1.22) {
    finish(game, homeMessage(game), true);
  }
}

export function homeStars(game: Game): number {
  const n = broodAlive(game);
  if (n >= STAR_THREE) return 3;
  if (n >= STAR_TWO) return 2;
  return 1;
}

function homeMessage(game: Game): string {
  const stars = homeStars(game);
  const mark = "★".repeat(stars) + "☆".repeat(3 - stars);
  const runs = game.continues === 0 ? "ノーコンティニュー" : `コンティニュー ${game.continues}回`;
  return `巣まで帰れた！ ${mark} きょうだい ${broodAlive(game)}羽（助けた ${game.rescued}羽・${runs}）`;
}

// Seconds from standstill to full sideways pace.
const GRIP: Record<SegmentId, number> = {
  park: 0.6,
  walk: 0.6,
  road: 0.5,
  crowd: 0.55,
  nest: 0.6,
  ...byStage((stage) => stage.grip),
};

// Seconds from full sideways pace to a stop.
const BRAKE: Record<SegmentId, number> = {
  park: 0.16,
  walk: 0.17,
  road: 0.14,
  crowd: 0.15,
  nest: 0.15,
  ...byStage((stage) => stage.brake),
};

// Top sideways pace.
const STEER: Record<SegmentId, number> = {
  park: 2.85,
  walk: 4.2,
  road: 2.2,
  crowd: 5.2,
  nest: 2.2,
  ...byStage((stage) => stage.steer),
};

// Feet, not ice: the first step already moves at a quarter of top speed, then a push that builds with speed
// picks up into a run. Stopping or turning back stays a couple of quick steps.
const FIRST_STEP = 0.25;
const PUSH_START = 0.3;
// Scales the push so the build-up still takes exactly `grip` seconds.
const PUSH_SCALE = Math.log(1 / PUSH_START) / (1 - PUSH_START);

export function footSpeed(vel: number, want: number, top: number, grip: number, brake: number, step: number): number {
  if (want !== 0 && want * vel >= 0 && Math.abs(vel) < top * FIRST_STEP) vel = Math.sign(want) * Math.min(Math.abs(want), top * FIRST_STEP);
  const braking = want * vel < 0 || Math.abs(want) < Math.abs(vel);
  const pace = Math.min(1, Math.abs(vel) / top);
  const rate = braking ? top / brake : (top / grip) * PUSH_SCALE * (PUSH_START + (1 - PUSH_START) * pace);
  const gap = want - vel;
  return vel + (Math.abs(gap) <= rate * step ? gap : Math.sign(gap) * rate * step);
}

function roadHuddle(s: number): boolean {
  return s >= roadStart - 1.2 && s < roadEnd + 1.2;
}

// Body length is about 0.52; keep a little air so the line does not melt into one blob.
const CHICK_SPACE = 0.5;
const CHICK_SEP = 0.46;
const ROAD_LINE_SPACE = 0.38;

function followerSlot(rank: number, live: number, s: number): { ds: number; lat: number } {
  const mid = (Math.max(1, live) - 1) / 2;
  if (roadHuddle(s)) {
    // Same crossing slot, spread along the highway so the pack still fits the gap.
    return { ds: 0.14, lat: (rank - mid) * ROAD_LINE_SPACE };
  }
  const ds = CHICK_SPACE * (rank + 1);
  if (s - ds >= 0.05) return { ds, lat: 0 };
  // Not enough path behind yet: stand in a row, then peel into single file.
  return { ds: Math.max(0.08, Math.min(ds, s - 0.05)), lat: (rank - mid) * ROAD_LINE_SPACE };
}

function resetTrail(game: Game): void {
  game.trail = [{ s: game.childS, lateral: game.lateral, time: game.time }];
}

function recordTrail(game: Game): void {
  const last = game.trail[0];
  if (last && Math.abs(last.s - game.childS) < 0.05 && Math.abs(last.lateral - game.lateral) < 0.025) return;
  game.trail.unshift({ s: game.childS, lateral: game.lateral, time: game.time });
  const keepBehind = game.childS - 16;
  while (game.trail.length > 160 && game.trail[game.trail.length - 1].s < keepBehind) game.trail.pop();
}

// Siblings aim at the footprint this far ahead of themselves, so they start a sidestep a beat early
// but still dodge where the lead chick dodged. Keep it under CHICK_SPACE or they cut corners into obstacles.
const STEER_LOOKAHEAD = 0.35;

function trailLateral(game: Game, s: number): number {
  const marks = game.trail;
  if (marks.length === 0) return game.lateral;
  if (s >= marks[0].s) return marks[0].lateral;
  for (let i = 0; i < marks.length - 1; i++) {
    const a = marks[i];
    const b = marks[i + 1];
    if (s <= a.s && s >= b.s) {
      const span = a.s - b.s;
      const t = span <= 1e-6 ? 0 : (a.s - s) / span;
      return a.lateral + (b.lateral - a.lateral) * t;
    }
  }
  return marks[marks.length - 1].lateral;
}

// How far the siblings may spread sideways.
const LEASH: Record<SegmentId, number> = {
  park: 1.7,
  walk: 1.58,
  road: 1.7,
  crowd: 1.06,
  nest: 0.7,
  ...byStage((stage) => stage.leash),
};

const LOSE: Record<SegmentId, number> = {
  park: LOSE_GAP,
  walk: WALK_LOSE_GAP,
  road: ROAD_LOSE_GAP,
  crowd: ROAD_LOSE_GAP,
  nest: ROAD_LOSE_GAP,
  ...byStage((stage) => stage.loseGap),
};

function lateralLeash(id: SegmentId): number {
  return LEASH[id];
}

function loseGap(id: SegmentId): number {
  return LOSE[id];
}

// 0 on the pavement, 1 once the chick is pushed fully into the hedge on either side.
export function walkHedgeDepth(lateral: number): number {
  return smoothstep(walkHedge - 0.1, walkHedge + 0.28, Math.abs(lateral));
}

// A chick waiting at the sidewalk edge can still be run over; returns the direction it flies, or 0.
// The crowd's walkers step around it, otherwise its lost chick would never live to be found.
function strayStruck(game: Game, kid: Broodling): number {
  if (segmentAt(kid.s).id !== "walk") return 0;
  const trip = walkMishap(kid.s, kid.lateral, game.time);
  return trip && trip.message === KICKED ? trip.dir : 0;
}

function walkMishap(s: number, lateral: number, time: number): { message: string; dir: number } | null {
  if (s < walkStart || s >= roadStart) return null;
  const dir = lateral >= 0 ? 1 : -1;
  for (const prop of walkProps) {
    if (Math.hypot(s - prop.s, lateral - prop.lateral) >= prop.radius + 0.02) continue;
    return { message: prop.kind === "puddle" ? SOAKED : BINNED, dir };
  }
  for (const person of walkersAt(time)) {
    if (!hitsPerson({ s, lateral }, person)) continue;
    return { message: KICKED, dir: person.dir };
  }
  return null;
}

export function guideLateral(s: number, lateral: number, time: number, crowdAt: number): number {
  const id = segmentAt(s).id;
  if (id === "crowd") return crowdPocket(s, lateral, peopleAt(time, crowdAt), bikesAt(time, crowdAt));
  if (id === "walk") return lateral >= 0 ? WALK_EDGE : -WALK_EDGE;
  return stageOf(id)?.guide?.(s, lateral, time) ?? lateral;
}

function crowdPocket(s: number, lateral: number, people: Person[], bikes: Bike[]): number {
  let best = CROWD_LANES[0];
  let bestScore = -Infinity;
  for (const pocket of CROWD_LANES) {
    let score = -Math.abs(pocket - lateral) * 2.4;
    for (const person of people) {
      if (!person.visible || person.fade < 0.4) continue;
      const ahead = person.s - s;
      if (ahead < -0.3 || ahead > 5) continue;
      const gap = Math.abs(person.lateral - pocket);
      if (gap > 0.4) continue;
      const close = 1 - Math.max(0, ahead) / 5;
      if (gap <= 0.3) score -= 90;
      score -= (0.4 - gap) * (4 + close * close * 20);
    }
    for (const bike of bikes) {
      if (!bike.visible) continue;
      const ahead = bike.s - s;
      if (ahead < -0.5 || ahead > 8) continue;
      const close = 1 - Math.max(0, ahead) / 8;
      const gap = Math.abs(bike.lateral - pocket);
      if (gap <= bike.radius + 0.22) score -= 55 + close * close * 80;
      else if (gap <= 0.7) score -= (0.7 - gap) * (10 + close * close * 30);
    }
    if (score > bestScore) {
      bestScore = score;
      best = pocket;
    }
  }
  return best;
}

function laneClearance(lane: (typeof LANES)[number]): number {
  return lane.width * 0.5 + 0.55;
}

function medianStopS(): number {
  const roadLen = roadEnd - roadStart;
  let last = roadStart;
  let width = 1;
  for (const lane of LANES) {
    if (lane.dir > 0) continue;
    const laneS = roadStart + lane.t * roadLen;
    if (laneS < last) continue;
    last = laneS;
    width = lane.width;
  }
  return last + width * 0.5 + 1.5;
}

function nextLane(s: number): { laneS: number; edge: number; far: number } | null {
  if (s < roadStart - 0.35 || s >= roadEnd - 0.45) return null;
  const roadLen = roadEnd - roadStart;
  let best: { laneS: number; clearance: number } | null = null;
  for (const lane of LANES) {
    const laneS = roadStart + lane.t * roadLen;
    const clearance = laneClearance(lane);
    if (s > laneS + clearance) continue;
    if (best === null || laneS < best.laneS) best = { laneS, clearance };
  }
  if (best === null) return null;
  return { laneS: best.laneS, edge: best.laneS - best.clearance, far: best.laneS + best.clearance };
}

function holdLane(game: Game, step: number): void {
  const roadLen = roadEnd - roadStart;
  for (const lane of LANES) {
    const laneS = roadStart + lane.t * roadLen;
    const half = lane.width * 0.5 + 0.2;
    if (game.childS < laneS - half || game.childS > laneS + half) continue;
    if (game.childS < laneS) {
      game.childS = laneS - half - 0.08;
      game.roadSpeed = 0;
      return;
    }
    const cruise = packSpeed();
    game.roadSpeed = Math.max(game.roadSpeed, cruise);
    game.childS = Math.min(laneS + half + 0.08, game.childS + cruise * step);
    return;
  }
}

const MOM_BRAKE = 1.45;

function crossingNeed(gate: { edge: number; far: number }, pace: number): number {
  const burst = pace * 1.55;
  const span = Math.max(0.25, gate.far - gate.edge);
  return span / burst + 0.5;
}

export function motherGlance(game: Game): number {
  const gap = Math.max(0, game.momS - game.childS);
  const limit = loseGap(shownSegment(game).id);
  const worry = smoothstep(limit * 0.4, limit * 0.82, gap);
  const gate = nextLane(game.momS);
  let depart = 0;
  if (gate && game.momS < gate.edge) {
    const eta = opening(carsAt(game.time), gate.laneS, 0);
    const need = crossingNeed(gate, packSpeed());
    const room = gate.edge - game.momS;
    if (room < 0.85 && eta >= need) depart = 1;
  }
  let looking = 0;
  for (const kid of game.brood) {
    if (kid.phase !== "stranded") continue;
    const behind = game.momS - kid.s;
    if (behind > 0 && behind < 5.2) looking = Math.max(looking, 0.62);
  }
  return Math.max(worry, depart, looking);
}

function motherSpeed(game: Game, cars: Car[], step: number): number {
  const s = game.momS;
  const pace = packSpeed();
  const gate = nextLane(s);
  const midLane = gate !== null && s >= gate.edge && s < gate.far;
  const onWalk = s >= walkStart && s < roadStart - 0.6;
  // A stage that keeps the chick well back must not leave mom waiting for it.
  const waitAt = Math.max(3.6, (stageOf(segmentAt(s).id)?.follow ?? 0) + 0.4);
  if (!midLane && !onWalk && s - game.childS > waitAt) return 0;
  if (!gate) return pace;
  const eta = opening(cars, gate.laneS, 0);
  const burst = pace * 1.55;
  const need = crossingNeed(gate, pace);
  if (s >= gate.edge && s < gate.far) return burst;
  if (eta >= need) return pace;
  const room = gate.edge - s;
  const hold = 0.06;
  if (room <= hold) return 0;
  const eased = pace * Math.sqrt(Math.min(1, room / MOM_BRAKE));
  const arrive = (room - hold) / Math.max(step, 1e-4);
  return Math.min(eased, arrive);
}

function opening(cars: Car[], s: number, lateral: number): number {
  const pose = poseAt(s, lateral);
  let nearest = Infinity;
  for (const car of cars) {
    if (Math.abs(car.z - pose.z) > car.width * 0.5 + 0.22) continue;
    const ahead = (pose.x - car.x) * car.dir;
    const reach = car.length * 0.5 + 0.28;
    if (ahead < -reach) continue;
    const eta = ahead <= reach ? 0 : car.speed <= 0 ? Infinity : ahead / car.speed;
    if (eta < nearest) nearest = eta;
  }
  return nearest;
}

function updateBrood(game: Game, step: number): void {
  const cars = carsAt(game.time);
  const liveIdx: number[] = [];
  for (let i = 0; i < game.brood.length; i++) {
    if (game.brood[i].phase === "walk") liveIdx.push(i);
  }
  const packHuddle = roadHuddle(game.childS);
  if (packHuddle) liveIdx.sort((a, b) => game.brood[a].lateral - game.brood[b].lateral);
  else liveIdx.sort((a, b) => game.brood[b].s - game.brood[a].s);
  const live = liveIdx.length;
  const rankOf = new Array<number>(game.brood.length);
  for (let r = 0; r < liveIdx.length; r++) rankOf[liveIdx[r]] = r;
  game.brood.forEach((kid, index) => {
    if (kid.phase === "gone") return;
    if (kid.phase === "yeet") {
      kid.yeet += step;
      kid.moved = 0;
      if (kid.yeet >= YEET_TIME) {
        kid.yeet = YEET_TIME;
        kid.phase = kid.rescueable ? "stranded" : "gone";
      }
      return;
    }
    if (kid.phase === "stranded") {
      kid.moved = 0;
      if (passedStray(game, kid)) {
        kid.phase = "gone";
        return;
      }
      const struck = kid.s - game.childS < STRAY_DANGER ? strayStruck(game, kid) : 0;
      if (struck !== 0) {
        kid.phase = "yeet";
        kid.yeet = 0;
        kid.yeetDir = struck;
        kid.rescueable = false;
      }
      return;
    }

    const before = kid.s;
    const rank = rankOf[index] ?? 0;
    const huddle = roadHuddle(game.childS) || roadHuddle(kid.s);
    const slot = followerSlot(rank, live, huddle ? roadStart : game.childS);
    const desired = game.childS - slot.ds;
    const gap = desired - kid.s;
    const pace = packSpeed();
    const playerPace = game.childDelta / Math.max(step, 1e-4);
    let speed: number;
    if (huddle) {
      const catchup = gap / Math.max(step, 1e-4);
      speed = Math.max(playerPace, 0) + Math.max(-pace * 2, Math.min(pace * 3.4, catchup));
    } else if (gap < -0.02) {
      speed = Math.max(0, pace * (1 + gap * 3.2));
    } else {
      speed = pace + Math.min(pace * 0.85, Math.max(0, gap) * 2.4);
    }
    const maxS = Math.min(goal, huddle ? game.childS - 0.08 : game.childS - CHICK_SEP * 0.9, game.momS - 0.18);
    if (kid.s + speed * step > maxS) speed = (maxS - kid.s) / step;
    kid.s = Math.min(goal, Math.max(0, kid.s + speed * step));
    if (kid.s > maxS) kid.s = Math.max(0, maxS);

    const seg = segmentAt(kid.s);
    const queued = stageOf(seg.id)?.queued?.(kid.s) ?? false;
    const ahead = queued && rank > 0 ? game.brood[liveIdx[rank - 1]].lateral : game.lateral;
    let target = huddle ? game.lateral + slot.lat : queued ? ahead : trailLateral(game, kid.s + STEER_LOOKAHEAD) + slot.lat;
    target += Math.sin(game.time * 1.7 + kid.seed) * (huddle ? 0.01 : 0.018);
    if (seg.id === "park") target = clearLateral(kid.s + 0.4, target, CHICK_BODY, parkGuideMin, parkGuideMax);
    const clearOf = stageOf(seg.id)?.steerClear;
    if (clearOf) target = clearOf(kid.s, target, kid.lateral);
    const leash = lateralLeash(seg.id);
    target = Math.min(leash, Math.max(-leash, target));
    // In a queue each chick lags the one in front, so a sidestep ripples back down the line.
    const pull = queued ? 9 : 26;
    kid.lateral += (target - kid.lateral) * Math.min(1, step * pull);
    if (seg.id === "park") {
      const climb = parkClimb(kid.s, kid.lateral, CHICK_BODY);
      if (climb > 0) kid.s = before + (kid.s - before) * (1 - climb * 0.62);
      kid.lateral = slidePark(kid.s, kid.lateral, CHICK_BODY);
      kid.lateral = Math.min(leash, Math.max(-leash, kid.lateral));
    }
    kid.moved = kid.s - before;

    const now = segmentAt(kid.s);
    const pose = poseAt(kid.s, kid.lateral);
    if (Math.abs(kid.lateral) > pathHalf && inLake(pose.x, pose.z)) {
      dropChick(game, kid, "yeet", 0);
      return;
    }
    if (now.id === "park" && (kid.lateral < parkMinL || kid.lateral > parkMaxL)) {
      dropChick(game, kid, "gone");
      return;
    }
    if (now.id === "walk" && Math.abs(kid.lateral) > walkSide) {
      dropChick(game, kid, "gone");
      return;
    }
    if (now.id === "nest" && Math.abs(kid.lateral) > 1.28) {
      dropChick(game, kid, "gone");
      return;
    }
    if (now.id === "road" && Math.abs(kid.lateral) > 6) {
      dropChick(game, kid, "gone");
      return;
    }
    // Bunching at the curb asks the whole line to close up at once, which is not falling behind.
    if (!huddle && desired - kid.s > 2) {
      dropChick(game, kid, "gone");
      return;
    }
    if (now.id === "walk") {
      const trip = walkMishap(kid.s, kid.lateral, game.time);
      if (trip) {
        dropChick(game, kid, "yeet", trip.dir);
        return;
      }
    }
    if (now.id === "crowd" && kid.s < crowdEnd + 0.35) {
      for (const person of peopleAt(game.time, game.crowdAt)) {
        if (!hitsPerson({ s: kid.s, lateral: kid.lateral }, person)) continue;
        dropChick(game, kid, "yeet", person.dir);
        return;
      }
      for (const bike of bikesAt(game.time, game.crowdAt)) {
        if (!bikeHits(kid.s, kid.lateral, bike)) continue;
        dropChick(game, kid, "yeet", kid.lateral >= 0 ? 1 : -1);
        return;
      }
    }
    const stageTrip = stageOf(now.id)?.mishap?.(kid.s, kid.lateral, game.time, false);
    if (stageTrip) {
      dropChick(game, kid, "yeet", stageTrip.dir);
      return;
    }
    if (now.id !== "road") return;
    for (const car of cars) {
      if (!hitsCar(pose, car)) continue;
      dropChick(game, kid, "yeet", car.dir);
      break;
    }
  });
  separateBrood(game);
  topUpBrood(game);
}

function separateBrood(game: Game): void {
  const kids = game.brood.filter((kid) => kid.phase === "walk");
  if (kids.length === 0) return;
  const huddle = roadHuddle(game.childS);
  const lined = !huddle && game.childS >= CHICK_SPACE * kids.length + 0.25;
  if (!lined) {
    kids.sort((a, b) => a.lateral - b.lateral);
    const minLat = ROAD_LINE_SPACE;
    for (const kid of kids) {
      const d = kid.lateral - game.lateral;
      if (Math.abs(d) < minLat * 0.72 && Math.abs(kid.s - game.childS) < 0.55) {
        kid.lateral = game.lateral + Math.sign(d || kid.strollSide || 1) * minLat;
      }
    }
    for (let i = 0; i < kids.length; i++) {
      for (let j = i + 1; j < kids.length; j++) {
        if (Math.abs(kids[j].s - kids[i].s) > 0.55) continue;
        const d = kids[j].lateral - kids[i].lateral;
        if (Math.abs(d) >= minLat) continue;
        const push = (minLat - Math.abs(d || 0)) * 0.5;
        const dir = Math.sign(d || 1);
        kids[i].lateral -= dir * push;
        kids[j].lateral += dir * push;
      }
    }
    for (const kid of kids) {
      const leash = lateralLeash(segmentAt(kid.s).id);
      kid.lateral = Math.min(leash, Math.max(-leash, kid.lateral));
    }
    return;
  }
  kids.sort((a, b) => b.s - a.s);
  for (const kid of kids) {
    if (game.childS - kid.s < CHICK_SEP) kid.s = Math.max(0, game.childS - CHICK_SEP);
  }
  for (let i = 0; i < kids.length; i++) {
    for (let j = i + 1; j < kids.length; j++) {
      if (kids[i].s - kids[j].s >= CHICK_SEP) continue;
      kids[j].s = Math.max(0, kids[i].s - CHICK_SEP);
    }
  }
}

function sinkFlight(t: number): { x: number; y: number; spin: number } {
  const u = Math.min(1, Math.max(0, t));
  return { x: 0, y: -u * u * 1.2, spin: u * 1.15 };
}

export function flightOffset(game: Game): { x: number; y: number; spin: number } | null {
  const drowning = game.outcome === DROWNED;
  const visible =
    game.phase === "yeet" || (game.phase === "result" && (game.outcome === YEETED || game.outcome === KICKED || drowning));
  if (!visible) return null;
  const t = Math.min(1, game.yeet / YEET_TIME);
  if (drowning) return sinkFlight(t);
  return {
    x: game.yeetDir * t * 3.4,
    y: Math.sin(t * Math.PI) * 1.55,
    spin: t * Math.PI * 4,
  };
}

import {
  crowdEnd,
  crowdStart,
  goal,
  inLake,
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
  parkOffTrail,
  slidePark,
  roadEnd,
  roadStart,
  segmentAt,
  tangentAt,
  walkStart,
  type SegmentId,
} from "./route.ts";

export const MOM_SPEED = 1.75;
export const LOSE_GAP = 4.35;
export const ROAD_LOSE_GAP = 11;
export const FOLLOW_GAP = 0.78;
export const OVERTAKE_LEAD = 0.55;
export const BROOD_COUNT = 9;
export const ROAD_CRUISE = MOM_SPEED;
export const ROAD_FAST = MOM_SPEED * 1.85;
export const ROAD_RATE = 3.1;
export const YEET_TIME = 0.72;

export const OVERTURN = "お母さんを追い越してしまった😿";
export const YEETED = "車に飛ばされてしまった😿";
export const KICKED = "人の足にぶつかってしまった😿";
export const DROWNED = "湖に落ちてしまった😿";
export const HOME = "巣まで帰れた！";

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
};

export type BroodMood = "cling" | "wander" | "dawdle" | "dash" | "zigzag";
export type BroodPhase = "walk" | "yeet" | "gone";

export type Broodling = {
  s: number;
  lateral: number;
  mood: BroodMood;
  phase: BroodPhase;
  yeet: number;
  yeetDir: number;
  seed: number;
  moved: number;
};

export type Game = {
  phase: Phase;
  time: number;
  momS: number;
  childS: number;
  lateral: number;
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
  childDelta: number;
  momDelta: number;
  roadSpeed: number;
  crowdAt: number;
  momLateral: number;
  brood: Broodling[];
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
    time: 0,
    momS: 1,
    childS: 0.22,
    lateral: 0,
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
    childDelta: 0,
    momDelta: 0,
    roadSpeed: 0,
    crowdAt: -1,
    momLateral: 0,
    brood: createBrood(),
  };
  placeBrood(game.brood, game.momS);
  return game;
}

function createBrood(): Broodling[] {
  return BROOD_MOODS.map((mood, index) => ({
    s: 0,
    lateral: 0,
    mood,
    phase: "walk",
    yeet: 0,
    yeetDir: 1,
    seed: index * 1.7 + 0.4,
    moved: 0,
  }));
}

function placeBrood(brood: Broodling[], momS: number): void {
  brood.forEach((kid, index) => {
    kid.phase = "walk";
    kid.yeet = 0;
    kid.yeetDir = 1;
    kid.moved = 0;
    kid.s = Math.max(0, momS - 0.4 - index * 0.12);
    kid.lateral = (index % 2 === 0 ? -1 : 1) * (0.16 + (index % 3) * 0.08);
  });
}

export function begin(game: Game): void {
  const fresh = createGame();
  Object.assign(game, fresh);
  placeBrood(game.brood, game.momS);
  game.phase = "play";
}

export function retry(game: Game): void {
  const id = game.success ? "park" : game.checkpoint;
  const fresh = createGame();
  Object.assign(game, fresh);
  game.phase = "play";
  game.checkpoint = id;
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
  }
  placeBrood(game.brood, game.momS);
}

const CROWD_LANES = [-0.74, 0, 0.74];
const CROWD_POCKETS = [-1.02, -0.37, 0.37, 1.02];

const PEOPLE: { lateral: number; speed: number; delay: number; spacing: number; count: number; color: number }[] = [
  { lateral: CROWD_LANES[0], speed: 1.52, delay: 0.25, spacing: 6.6, count: 3, color: 0x3d5a80 },
  { lateral: CROWD_LANES[1], speed: 1.78, delay: 1.05, spacing: 7.4, count: 2, color: 0xc4493a },
  { lateral: CROWD_LANES[2], speed: 1.4, delay: 0.55, spacing: 6.9, count: 3, color: 0x2f6f4e },
];

export function peopleAt(time: number, crowdAt: number): Person[] {
  const length = Math.max(0.001, crowdEnd - crowdStart);
  const origin = pointAt(crowdStart);
  const tan = tangentAt((crowdStart + crowdEnd) / 2);
  const yaw = Math.atan2(-tan.x, -tan.z);
  const entry = length;
  const exit = -1.15;
  const span = entry - exit;
  const clock = crowdAt < 0 ? -1 : time - crowdAt;
  const list: Person[] = [];
  for (const lane of PEOPLE) {
    for (let i = 0; i < lane.count; i++) {
      const delay = lane.delay + lane.spacing * i;
      const traveled = clock < 0 ? -1 : clock * lane.speed - delay;
      let along = entry;
      let fade = 0;
      let stride = 0;
      if (traveled >= 0) {
        const cycle = span + 2.8;
        const into = traveled % cycle;
        along = entry - into;
        const fadeIn = Math.min(1, Math.max(0, (entry - along) / 1.35));
        const fadeOut = Math.min(1, Math.max(0, (along - exit) / 0.8));
        fade = along > entry || along < exit ? 0 : Math.min(fadeIn, fadeOut);
        stride = traveled * 8.2;
      }
      list.push({
        x: origin.x + tan.x * along + tan.z * lane.lateral,
        z: origin.z + tan.z * along - tan.x * lane.lateral,
        s: crowdStart + along,
        lateral: lane.lateral,
        dir: -1,
        yaw,
        color: lane.color,
        length: 0.36,
        width: 0.24,
        visible: fade > 0.04,
        fade,
        stride,
      });
    }
  }
  return list;
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
  return Math.abs(child.x - car.x) < car.length * 0.5 + 0.22 && Math.abs(child.z - car.z) < car.width * 0.5 + 0.2;
}

export function hitsPerson(child: Pose, person: Person): boolean {
  if (!person.visible || person.fade < 0.72) return false;
  return (
    Math.abs(child.x - person.x) < person.length * 0.5 + 0.06 &&
    Math.abs(child.z - person.z) < person.width * 0.5 + 0.06
  );
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
  return {
    x: kid.yeetDir * t * 3.4,
    y: Math.sin(t * Math.PI) * 1.55,
    spin: t * Math.PI * 4,
  };
}

export function broodAlive(game: Game): number {
  return game.brood.filter((kid) => kid.phase === "walk").length;
}

export function placeName(game: Game): string {
  if (game.medianWait) return "進むで渡ろう";
  return shownSegment(game).name;
}

const HINTS: Record<SegmentId, string> = {
  park: "左右で岩や切り株をよけよう",
  walk: "お母さんのうしろについていこう",
  road: "車線のあいだで待って、空いたら進む",
  crowd: "向かってくる人を左右によけよう",
  nest: "あと少し！",
};

export function placeHint(game: Game): string {
  return HINTS[shownSegment(game).id];
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
  if (game.crowdAt < 0 && game.childS >= roadEnd) game.crowdAt = game.time;
  const crowdPeople = peopleAt(game.time, game.crowdAt);
  const momOnSidewalk = game.momS >= crowdStart - 0.15 && game.momS < crowdEnd + 0.15;
  const momOnPark = game.momS < walkStart;
  const momTarget = momOnSidewalk
    ? crowdPocket(game.momS, game.momLateral, crowdPeople)
    : momOnPark
      ? clearLateral(game.momS + 0.6, game.momLateral, 0.36, parkGuideMin, parkGuideMax)
      : 0;
  const momPull = momOnPark ? 5.4 : 3.5;
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
  }
  game.momS = Math.min(goal, game.momS + momSpeed * step);
  if (!game.medianUsed && game.momS >= medianStop && game.momS < roadEnd) {
    if (!game.medianWait) game.medianReady = game.time + 0.7;
    game.momS = medianStop;
    game.medianWait = true;
  }
  game.momDelta = game.momS - momBefore;
  if (game.momS < walkStart) game.momLateral = slidePark(game.momS, game.momLateral, 0.34);
  updateBrood(game, step);

  const view = shownSegment(game);
  if (view.id !== "walk" && game.checkpoint !== view.id && game.childS >= view.start - 0.2) {
    game.checkpoint = view.id;
  }

  const childBefore = game.childS;
  if (view.control === "lateral") {
    const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    const steerRate = view.id === "crowd" ? 3.15 : view.id === "park" ? 2.85 : 2.2;
    game.lateral += steer * steerRate * step;
    const limit = view.id === "nest" ? 1.7 : view.id === "park" ? Math.max(-parkMinL, parkMaxL) + 0.15 : 3.1;
    game.lateral = Math.min(limit, Math.max(-limit, game.lateral));
    if (view.id === "crowd") {
      game.lateral = Math.min(1.08, Math.max(-1.08, game.lateral));
    }
    const off = Math.abs(game.lateral);
    const slow =
      view.id === "crowd"
        ? 0
        : view.id === "park"
          ? Math.max(smoothstep(2.35, 3.05, off), parkOffTrail(game.childS, game.lateral))
          : smoothstep(view.id === "nest" ? 0.32 : 0.7, view.id === "nest" ? 1.15 : 2.25, off);
    game.childS += MOM_SPEED * (1 - slow * 0.72) * step;
    const cap = game.pause > 0 ? game.momS - 0.12 : game.momS - FOLLOW_GAP;
    if (game.childS > cap) game.childS = cap;
  } else {
    game.lateral += (0 - game.lateral) * Math.min(1, step * 10);
    let target = game.pause > 0 ? 0 : ROAD_CRUISE;
    if (input.forward && !game.medianWait) target = ROAD_FAST;
    if (input.back) target = 0;
    if (game.medianWait && game.childS >= medianStop - 0.08) target = 0;
    const delta = target - game.roadSpeed;
    const launch = input.forward || input.back ? 14 : ROAD_RATE;
    const maxStep = launch * step;
    game.roadSpeed += Math.abs(delta) <= maxStep ? delta : Math.sign(delta) * maxStep;
    game.roadSpeed = Math.max(0, game.roadSpeed);
    game.childS += game.roadSpeed * step;
    const rear = roadStart - 0.95;
    if (game.childS < rear) game.childS = rear;
    if (target === 0) holdLane(game, step);
    if (!game.medianUsed && game.childS >= roadStart && game.childS < roadEnd && game.childS > medianStop) {
      game.childS = medianStop;
      game.roadSpeed = 0;
    }
  }
  if (view.id === "park") {
    const body = 0.24;
    const climb = parkClimb(game.childS, game.lateral, body);
    if (climb > 0) {
      const gained = game.childS - childBefore;
      game.childS = childBefore + gained * (1 - climb * 0.68);
    }
    game.lateral = slidePark(game.childS, game.lateral, body);
  }
  game.childDelta = game.childS - childBefore;

  const after = shownSegment(game);
  if (after.id !== "walk" && after.id !== game.checkpoint && game.childS >= after.start - 0.2) {
    game.checkpoint = after.id;
  }

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
    if (after.id === "walk" && game.lateral > 1.22) {
      finish(game, after.lost, false);
      return;
    }
    if (after.id === "nest" && Math.abs(game.lateral) > 1.28) {
      finish(game, after.lost, false);
      return;
    }
  }

  const leaveGap = after.id === "park" ? LOSE_GAP : ROAD_LOSE_GAP;
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

  if (after.id === "crowd" && game.childS < crowdEnd + 0.35) {
    for (const person of crowdPeople) {
      if (!hitsPerson(child, person)) continue;
      finish(game, KICKED, false, person.dir);
      return;
    }
  }

  if (game.momS >= goal - 0.04 && game.momS - game.childS < 1.4 && Math.abs(game.lateral) < 1.22) {
    finish(game, HOME, true);
  }
}

const TRAIL: Record<BroodMood, number> = {
  cling: 0.36,
  dash: 0.4,
  zigzag: 0.46,
  wander: 0.58,
  dawdle: 0.78,
};

const KEEN: Record<BroodMood, number> = {
  dash: 1,
  cling: 0.95,
  zigzag: 0.86,
  wander: 0.74,
  dawdle: 0.58,
};

const MARGIN: Record<BroodMood, number> = {
  dash: 0.08,
  zigzag: 0.22,
  cling: 0.4,
  wander: 0.7,
  dawdle: 1.15,
};

function homeLateral(index: number): number {
  const side = index % 2 === 0 ? -1 : 1;
  return side * (0.16 + (index % 3) * 0.08);
}

function lateralLeash(id: SegmentId): number {
  if (id === "park") return 1.7;
  if (id === "walk") return 1.15;
  if (id === "crowd") return 1.06;
  if (id === "nest") return 0.7;
  return 0.36;
}

function crowdPocket(s: number, lateral: number, people: Person[]): number {
  const inLane = CROWD_LANES.some((lane) => Math.abs(lane - lateral) < 0.24);
  const options = inLane ? CROWD_POCKETS : CROWD_POCKETS.concat(lateral);
  let best = options[0];
  let bestScore = -Infinity;
  for (const pocket of options) {
    let score = -Math.abs(pocket - lateral) * 0.85;
    for (const person of people) {
      if (!person.visible || person.fade < 0.45) continue;
      const ahead = person.s - s;
      if (ahead < -0.45 || ahead > 3.1) continue;
      const gap = Math.abs(person.lateral - pocket);
      if (gap > 0.46) continue;
      const close = 1 - Math.max(0, ahead) / 3.1;
      score -= (0.46 - gap) * (2.4 + close * 6);
    }
    if (score > bestScore) {
      bestScore = score;
      best = pocket;
    }
  }
  return best;
}

function leaderOf(game: Game, index: number): { s: number; sibling: Broodling | null } {
  for (let i = index - 1; i >= 0; i--) {
    const ahead = game.brood[i];
    if (ahead.phase === "walk") return { s: ahead.s, sibling: ahead };
  }
  return { s: game.momS, sibling: null };
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
    game.roadSpeed = Math.max(game.roadSpeed, ROAD_CRUISE);
    game.childS = Math.min(laneS + half + 0.08, game.childS + ROAD_CRUISE * step);
    return;
  }
}

const MOM_BRAKE = 1.45;

function crossingNeed(gate: { edge: number; far: number }): number {
  const burst = MOM_SPEED * 1.55;
  const span = Math.max(0.25, gate.far - gate.edge);
  return span / burst + 0.5;
}

export function motherGlance(game: Game): number {
  const gap = Math.max(0, game.momS - game.childS);
  const limit = shownSegment(game).id === "park" ? LOSE_GAP : ROAD_LOSE_GAP;
  const worry = smoothstep(limit * 0.4, limit * 0.82, gap);
  const gate = nextLane(game.momS);
  let depart = 0;
  if (gate && game.momS < gate.edge) {
    const eta = opening(carsAt(game.time), gate.laneS, 0);
    const need = crossingNeed(gate);
    const room = gate.edge - game.momS;
    if (room < 0.85 && eta >= need) depart = 1;
  }
  return Math.max(worry, depart);
}

function motherSpeed(game: Game, cars: Car[], step: number): number {
  const s = game.momS;
  const gate = nextLane(s);
  const midLane = gate !== null && s >= gate.edge && s < gate.far;
  if (!midLane && s - game.childS > 3.6) return 0;
  if (!gate) return MOM_SPEED;
  const eta = opening(cars, gate.laneS, 0);
  const burst = MOM_SPEED * 1.55;
  const need = crossingNeed(gate);
  if (s >= gate.edge && s < gate.far) return burst;
  if (eta >= need) return MOM_SPEED;
  const room = gate.edge - s;
  const hold = 0.06;
  if (room <= hold) return 0;
  const eased = MOM_SPEED * Math.sqrt(Math.min(1, room / MOM_BRAKE));
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
  game.brood.forEach((kid, index) => {
    if (kid.phase === "gone") return;
    if (kid.phase === "yeet") {
      kid.yeet += step;
      kid.moved = 0;
      if (kid.yeet >= YEET_TIME) kid.phase = "gone";
      return;
    }

    const before = kid.s;
    const seg = segmentAt(kid.s);
    const ahead = leaderOf(game, index);
    const aheadStopped = ahead.sibling !== null && Math.abs(ahead.sibling.moved) < 0.0015;
    const impatient = kid.mood === "dash";
    const behindMom = game.momS - kid.s;
    let desired = game.momS - (0.42 + index * 0.24 + Math.max(0, TRAIL[kid.mood] - 0.4));
    desired = Math.min(desired, game.momS - 0.2);
    if (ahead.sibling && !impatient && behindMom < 2.6) {
      desired = Math.min(desired, ahead.s - (aheadStopped ? 0.08 : 0.16));
    }
    const behind = desired - kid.s;
    let speed: number;
    if (behind < -0.02) {
      speed = Math.max(0, MOM_SPEED * (1 + behind * 3.2));
    } else {
      const catchup = MOM_SPEED * (1 + Math.min(0.55, Math.max(0, behind) * 0.6));
      speed = MOM_SPEED + (catchup - MOM_SPEED) * KEEN[kid.mood];
    }
    if (seg.id !== "road" && seg.id !== "crowd" && behind < 1.1) {
      const wobble = Math.sin(game.time * 0.55 + kid.seed);
      if (kid.mood === "dawdle" && wobble > 0.92) speed *= 0.4;
      if (kid.mood === "wander" && wobble > 0.9) speed *= 0.65;
    }

    const gate = nextLane(kid.s);
    const stray = Math.abs(kid.lateral) > 0.7;
    let crossing = false;
    let scared = false;
    if (gate) {
      const burst = MOM_SPEED * 2.05;
      const remaining = Math.max(0.2, gate.far - Math.max(kid.s, gate.edge));
      const need = remaining / burst + MARGIN[kid.mood] * (stray ? 0.55 : 1);
      const eta = opening(cars, gate.laneS, kid.lateral);
      if (eta < need && kid.s <= gate.edge + 0.1) {
        scared = true;
        if (kid.s < gate.edge) speed = Math.min(speed, Math.max(0, (gate.edge - kid.s) / step));
        else speed = kid.mood === "cling" && eta < 0.45 ? -0.32 : Math.min(speed, 0);
      } else if (kid.s < gate.far) {
        crossing = true;
        speed = Math.max(speed, burst);
      }
    }

    const maxS = Math.min(game.momS - 0.18, impatient || crossing ? game.momS - 0.18 : desired + 0.04);
    if (speed > 0 && kid.s < maxS && kid.s + speed * step > maxS) {
      speed = (maxS - kid.s) / step;
    }

    const momOnRoad = game.momS >= roadStart && game.momS < roadEnd;
    const kidOnRoad = kid.s >= roadStart && kid.s < roadEnd;
    if ((momOnRoad || kidOnRoad) && speed > 0) {
      const cap = game.momS - 0.18;
      if (kid.s >= cap) speed = 0;
      else speed = Math.min(speed, (cap - kid.s) / step);
    }

    kid.s = Math.min(goal, Math.max(0, kid.s + speed * step));
    if (kid.s >= roadStart && kid.s < roadEnd) {
      kid.s = Math.min(kid.s, game.momS - 0.18);
    }

    let target: number;
    if (scared) {
      target = 0;
    } else if (seg.id === "crowd" && kid.s >= crowdStart && kid.s < crowdEnd) {
      target = crowdPocket(kid.s, kid.lateral, peopleAt(game.time, game.crowdAt));
    } else if (seg.id === "park") {
      target = clearLateral(kid.s + 0.6, kid.lateral, 0.28, parkGuideMin, parkGuideMax);
    } else if (seg.id === "road" || seg.id === "crowd") {
      target = homeLateral(index);
    } else if (kid.mood === "wander") {
      const side = Math.sin(kid.seed) > 0 ? 1 : -1;
      const reach = seg.id === "nest" ? 0.55 : 1.28;
      target = Math.sin(game.time * 0.32 + kid.seed) > 0.2 ? side * reach : homeLateral(index);
    } else if (kid.mood === "zigzag") {
      const amp = seg.id === "nest" ? 0.48 : 0.78;
      target = Math.sin(game.time * 1.4 + kid.seed) * amp;
    } else if (kid.mood === "dawdle") {
      target = homeLateral(index) + Math.sin(game.time * 0.6 + kid.seed) * 0.1;
    } else {
      target = homeLateral(index) * (kid.mood === "dash" ? 0.6 : 1);
    }
    const leash = lateralLeash(seg.id);
    target = Math.min(leash, Math.max(-leash, target));
    const pull = seg.id === "crowd" ? 4.6 : seg.id === "park" ? 4.2 : scared ? 3.2 : kid.mood === "wander" ? 0.7 : 1.7;
    kid.lateral += (target - kid.lateral) * Math.min(1, step * pull);
    if (seg.id === "park") {
      const climb = parkClimb(kid.s, kid.lateral, 0.2);
      if (climb > 0) kid.s = before + (kid.s - before) * (1 - climb * 0.62);
      kid.lateral = slidePark(kid.s, kid.lateral, 0.22);
      kid.lateral = Math.min(leash, Math.max(-leash, kid.lateral));
    }
    kid.moved = kid.s - before;

    const now = segmentAt(kid.s);
    const pose = poseAt(kid.s, kid.lateral);
    if (Math.abs(kid.lateral) > pathHalf && inLake(pose.x, pose.z)) {
      kid.phase = "yeet";
      kid.yeet = 0;
      kid.yeetDir = 0;
      kid.moved = 0;
      return;
    }
    if (now.id === "park" && (kid.lateral < parkMinL || kid.lateral > parkMaxL)) {
      kid.phase = "gone";
      return;
    }
    if (now.id === "walk" && kid.lateral > 1.22) {
      kid.phase = "gone";
      return;
    }
    if (now.id === "nest" && Math.abs(kid.lateral) > 1.28) {
      kid.phase = "gone";
      return;
    }
    if (now.id === "road" && Math.abs(kid.lateral) > 6) {
      kid.phase = "gone";
      return;
    }
    if (game.momS - kid.s > LOSE_GAP) {
      kid.phase = "gone";
      return;
    }
    if (now.id === "crowd" && kid.s < crowdEnd + 0.35) {
      for (const person of peopleAt(game.time, game.crowdAt)) {
        if (!hitsPerson(pose, person)) continue;
        kid.phase = "yeet";
        kid.yeet = 0;
        kid.yeetDir = person.dir;
        return;
      }
    }
    if (now.id !== "road") return;
    for (const car of cars) {
      if (!hitsCar(pose, car)) continue;
      kid.phase = "yeet";
      kid.yeet = 0;
      kid.yeetDir = car.dir;
      break;
    }
  });
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

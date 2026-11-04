export type Point = { x: number; z: number };

// The added journey between the shopping street and the nest (now an oasis).
// "shore"/"sea" are the two halves of the sea; "desert"/"king" are one desert stage ending in the boss.
export type StageId = "forest" | "cave" | "shore" | "sea" | "desert" | "king";

export type SegmentId = "park" | "walk" | "road" | "crowd" | StageId | "nest";

export type Segment = {
  id: SegmentId;
  name: string;
  start: number;
  end: number;
  control: "lateral" | "longitudinal";
  camera: "chase" | "top";
  lost: string;
};

// The park and its lake sit this far along the world, which sets how long the sidewalk after them is.
export const PARK_SHIFT: Point = { x: 5.8, z: 46.8 };
const parkKnots: Point[] = [
  { x: 0, z: 0 },
  { x: 3.6, z: 5.2 },
  { x: -3.5, z: 10.6 },
  { x: 2.9, z: 15.8 },
  { x: 0.9, z: 20.1 },
].map((p) => ({ x: p.x + PARK_SHIFT.x, z: p.z + PARK_SHIFT.z }));
const walkKnots: Point[] = [
  parkKnots[parkKnots.length - 1],
  { x: 8.4, z: 72.2 },
  { x: 14.2, z: 78.2 },
  { x: 21.4, z: 82 },
  { x: 29.4, z: 83.6 },
  { x: 37.6, z: 84.2 },
  { x: 40.2, z: 84.5 },
  { x: 42.6, z: 85.5 },
  { x: 44.7, z: 87.1 },
  { x: 46.3, z: 89.2 },
  { x: 47.3, z: 91.6 },
  { x: 47.6, z: 94.2 },
];
const roadKnots: Point[] = [
  { x: 47.6, z: 94.2 },
  { x: 47.6, z: 114.2 },
];
const cornerKnots: Point[] = [
  { x: 47.6, z: 114.2 },
  { x: 48.1, z: 116.9 },
  { x: 49.5, z: 119.3 },
  { x: 51.6, z: 121.1 },
  { x: 54.2, z: 122.1 },
  { x: 55.6, z: 122.2 },
];
const crowdKnots: Point[] = [
  { x: 55.6, z: 122.2 },
  { x: 96, z: 122.2 },
];
// Off the shopping street through the gap in the wall, where the journey begins.
const turnKnots: Point[] = [
  { x: 96, z: 122.2 },
  { x: 98.2, z: 123.4 },
  { x: 100.2, z: 125.2 },
  { x: 101.6, z: 127.6 },
  { x: 102.4, z: 130.4 },
  { x: 102.8, z: 133.6 },
];
// Stage lengths along the path; mom covers 1.75 a second, so 35 is about 20 seconds.
export const FOREST_LENGTH = 17.5;
export const CAVE_LENGTH = 35;
export const SHORE_LENGTH = 17.5;
export const SEA_LENGTH = 17.5;
export const DESERT_LENGTH = 22;
export const KING_LENGTH = 13;
const JOURNEY_LENGTH =
  FOREST_LENGTH + CAVE_LENGTH + SHORE_LENGTH + SEA_LENGTH + DESERT_LENGTH + KING_LENGTH;
const TURN_LENGTH = 11.7;
// The forest drifts, then the cave twists left and right before a last straight run to the light.
const windKnots: Point[] = [
  { x: 102.8, z: 133.6 },
  { x: 102.4, z: 139.2 },
  { x: 100.2, z: 143.2 },
  { x: 103.4, z: 147 },
  { x: 100.8, z: 151 },
  { x: 103.2, z: 155 },
  { x: 102.8, z: 159.4 },
];
let windLength = TURN_LENGTH;
for (let i = 1; i < windKnots.length; i++) {
  windLength += Math.hypot(windKnots[i].x - windKnots[i - 1].x, windKnots[i].z - windKnots[i - 1].z);
}
// Everything after that sits on one long straight; fog and the per-stage scenery keep neighbours out of sight.
const journeyZ = 159.4 + JOURNEY_LENGTH - windLength + 2;
const journeyKnots: Point[] = [{ x: 102.8, z: 159.4 }];
for (let z = 159.4 + 30; z < journeyZ - 10; z += 30) journeyKnots.push({ x: 102.8, z });
journeyKnots.push({ x: 102.8, z: journeyZ });
const nestKnots: Point[] = [
  { x: 102.8, z: journeyZ },
  { x: 103.3, z: journeyZ + 2.6 },
  { x: 104.6, z: journeyZ + 5 },
  { x: 106.6, z: journeyZ + 6.9 },
  { x: 109, z: journeyZ + 8.1 },
];

const rawKnots: Point[] = [
  ...parkKnots,
  ...walkKnots.slice(1),
  ...roadKnots.slice(1),
  ...cornerKnots.slice(1),
  ...crowdKnots.slice(1),
  ...turnKnots.slice(1),
  ...windKnots.slice(1),
  ...journeyKnots.slice(1),
  ...nestKnots.slice(1),
];

const parkEnd = parkKnots.length - 1;
const walkEnd = parkEnd + walkKnots.length - 1;
const roadEndIndex = walkEnd + roadKnots.length - 1;
const cornerEnd = roadEndIndex + cornerKnots.length - 1;
const crowdEndIndex = cornerEnd + crowdKnots.length - 1;
const windEnd = crowdEndIndex + turnKnots.length - 1 + windKnots.length - 1;

// The hand-placed knots are joined with a centripetal Catmull-Rom curve so the
// path (and everything that faces along it) turns gradually instead of snapping
// at each knot. The highway and the straight shopping street stay ruler-straight.
const STRAIGHT = new Set([walkEnd, cornerEnd]);
for (let i = 0; i < journeyKnots.length - 1; i++) STRAIGHT.add(windEnd + i);
const CURVE_STEP = 0.3;

function catmull(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const knot = (a: Point, b: Point) => Math.max(1e-4, Math.sqrt(Math.hypot(b.x - a.x, b.z - a.z)));
  const t1 = knot(p0, p1);
  const t2 = t1 + knot(p1, p2);
  const t3 = t2 + knot(p2, p3);
  const u = t1 + (t2 - t1) * t;
  const lerp = (a: Point, b: Point, ta: number, tb: number): Point => {
    const k = (u - ta) / (tb - ta);
    return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k };
  };
  const a1 = lerp(p0, p1, 0, t1);
  const a2 = lerp(p1, p2, t1, t2);
  const a3 = lerp(p2, p3, t2, t3);
  const b1 = lerp(a1, a2, 0, t2);
  const b2 = lerp(a2, a3, t1, t3);
  return lerp(b1, b2, t1, t2);
}

const knots: Point[] = [rawKnots[0]];
const denseIndex: number[] = [0];
for (let i = 0; i < rawKnots.length - 1; i++) {
  const p1 = rawKnots[i];
  const p2 = rawKnots[i + 1];
  const p0 = rawKnots[i - 1] ?? { x: 2 * p1.x - p2.x, z: 2 * p1.z - p2.z };
  const p3 = rawKnots[i + 2] ?? { x: 2 * p2.x - p1.x, z: 2 * p2.z - p1.z };
  const steps = STRAIGHT.has(i) ? 1 : Math.max(1, Math.ceil(Math.hypot(p2.x - p1.x, p2.z - p1.z) / CURVE_STEP));
  for (let k = 1; k <= steps; k++) {
    knots.push(k === steps ? p2 : STRAIGHT.has(i) ? p2 : catmull(p0, p1, p2, p3, k / steps));
  }
  denseIndex.push(knots.length - 1);
}

const knotS: number[] = [0];
for (let i = 1; i < knots.length; i++) {
  const a = knots[i - 1];
  const b = knots[i];
  knotS.push(knotS[i - 1] + Math.hypot(b.x - a.x, b.z - a.z));
}

const sAtKnot = (raw: number) => knotS[denseIndex[raw]];

export const approachStart = sAtKnot(2);
export const walkStart = sAtKnot(parkEnd);
export const roadStart = sAtKnot(walkEnd);
export const roadEnd = sAtKnot(roadEndIndex);
export const crowdStart = sAtKnot(cornerEnd);
export const crowdEnd = sAtKnot(crowdEndIndex);
export const forestStart = sAtKnot(crowdEndIndex + 1);
export const caveStart = forestStart + FOREST_LENGTH;
export const shoreStart = caveStart + CAVE_LENGTH;
export const seaStart = shoreStart + SHORE_LENGTH;
export const desertStart = seaStart + SEA_LENGTH;
export const kingStart = desertStart + DESERT_LENGTH;
export const nestStart = kingStart + KING_LENGTH;
// Where the cave stops winding and runs straight toward the light.
export const caveStraight = sAtKnot(windEnd);
export const goal = knotS[knotS.length - 1];

export const lakeMinX = -15.5 + PARK_SHIFT.x;
export const lakeMaxX = -1.02 + PARK_SHIFT.x;
export const lakeMinZ = 21.6 + PARK_SHIFT.z;
export const lakeMaxZ = 27.22 + PARK_SHIFT.z;
export const lakeY = -1.2;
export const lakeCenter = {
  x: (lakeMinX + lakeMaxX) / 2,
  z: (lakeMinZ + lakeMaxZ) / 2,
};
export const lakeSize = {
  x: lakeMaxX - lakeMinX,
  z: lakeMaxZ - lakeMinZ,
};
export const pathHalf = 1.15;
export const walkHedge = 1.34;
export const walkSide = 1.95;

export type WalkPropKind = "bin" | "puddle";

export type WalkProp = {
  s: number;
  lateral: number;
  radius: number;
  kind: WalkPropKind;
};

const placedWalkProps: WalkProp[] = [
  { s: walkStart + 18.4, lateral: 0, radius: 0.4, kind: "puddle" },
  { s: walkStart + 36, lateral: 0, radius: 0.4, kind: "puddle" },
];
export const walkProps: WalkProp[] = placedWalkProps.filter(
  (prop) => prop.s > walkStart + 2 && prop.s < roadStart - 3.2,
);

export function inLake(x: number, z: number): boolean {
  return x >= lakeMinX && x <= lakeMaxX && z >= lakeMinZ && z <= lakeMaxZ;
}

export const segments: Segment[] = [
  {
    id: "park",
    name: "公園",
    start: 0,
    end: walkStart,
    control: "lateral",
    camera: "chase",
    lost: "森ではぐれてしまった😿",
  },
  {
    id: "walk",
    name: "歩道",
    start: walkStart,
    end: roadStart,
    control: "lateral",
    camera: "chase",
    lost: "歩道ではぐれてしまった😿",
  },
  {
    id: "road",
    name: "高速道路",
    start: roadStart,
    end: roadEnd,
    control: "longitudinal",
    camera: "top",
    lost: "高速道路で置いていかれてしまった😿",
  },
  {
    id: "crowd",
    name: "歩道",
    start: roadEnd,
    end: forestStart,
    control: "lateral",
    camera: "chase",
    lost: "歩道で置いていかれてしまった😿",
  },
  stage("forest", "樹海", forestStart, caveStart, "lateral", "樹海で見失ってしまった😿"),
  stage("cave", "洞窟", caveStart, shoreStart, "lateral", "洞窟ではぐれてしまった😿"),
  stage("shore", "海", shoreStart, seaStart, "longitudinal", "海ではぐれてしまった😿"),
  stage("sea", "海", seaStart, desertStart, "lateral", "海ではぐれてしまった😿"),
  stage("desert", "砂漠", desertStart, kingStart, "lateral", "砂漠ではぐれてしまった😿"),
  stage("king", "砂漠", kingStart, nestStart, "lateral", "ピラミッドの王に負けてしまった😿"),
  {
    id: "nest",
    name: "オアシス",
    start: nestStart,
    end: goal,
    control: "lateral",
    camera: "chase",
    lost: "巣の前で見失ってしまった😿",
  },
];

function stage(
  id: StageId,
  name: string,
  start: number,
  end: number,
  control: Segment["control"],
  lost: string,
): Segment {
  return { id, name, start, end, control, camera: control === "longitudinal" ? "top" : "chase", lost };
}

export function segmentAt(s: number): Segment {
  for (let i = segments.length - 1; i >= 0; i--) {
    if (s >= segments[i].start) return segments[i];
  }
  return segments[0];
}

export function clampS(s: number): number {
  return Math.min(goal, Math.max(0, s));
}

function spanAt(s: number): { a: Point; b: Point; t: number } {
  const c = clampS(s);
  let lo = 1;
  let hi = knotS.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (c > knotS[mid]) lo = mid + 1;
    else hi = mid;
  }
  const i = lo;
  const a = knots[i - 1];
  const b = knots[i];
  const length = knotS[i] - knotS[i - 1];
  const t = length === 0 ? 0 : (c - knotS[i - 1]) / length;
  return { a, b, t };
}

export function pointAt(s: number): Point {
  const { a, b, t } = spanAt(s);
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
}

export function tangentAt(s: number): Point {
  const { a, b } = spanAt(s);
  const length = Math.hypot(b.x - a.x, b.z - a.z) || 1;
  return { x: (b.x - a.x) / length, z: (b.z - a.z) / length };
}

export function poseAt(s: number, lateral: number): { x: number; z: number; yaw: number } {
  const p = pointAt(s);
  const t = tangentAt(s);
  const yaw = Math.atan2(t.x, t.z);
  return {
    x: p.x + t.z * lateral,
    z: p.z - t.x * lateral,
    yaw,
  };
}

export function samplePath(step: number): { s: number; x: number; z: number; yaw: number }[] {
  const out: { s: number; x: number; z: number; yaw: number }[] = [];
  for (let s = 0; s <= goal; s += step) {
    const p = poseAt(s, 0);
    out.push({ s, x: p.x, z: p.z, yaw: p.yaw });
  }
  return out;
}

export type ParkPropKind = "rock" | "stump" | "bush" | "log" | "bench" | "tree" | "thicket";

export type ParkProp = {
  s: number;
  lateral: number;
  radius: number;
  span: number;
  kind: ParkPropKind;
  tilt: number;
  scale?: number;
};

export type ParkMark = {
  s: number;
  lateral: number;
  half: number;
  along: number;
};

export type ParkGlade = {
  s: number;
  radius: number;
};

export const parkMinL = -2.95;
export const parkMaxL = 3.35;
export const parkGuideMin = -1.75;
export const parkGuideMax = 1.85;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Pocket = { s0: number; s1: number; side: number; mouth: number; depth: number };

function buildPark(): {
  props: ParkProp[];
  marks: ParkMark[];
  offTrail: (s: number, lateral: number) => number;
  glade: ParkGlade;
} {
  const rand = mulberry32(0x51a7e3);
  const bands: { s: number; lateral: number }[] = [];
  let lateral = 0.04;
  let phase = 0.6 + rand() * 0.4;
  const sEnd = walkStart - 2.7;
  for (let s = 2.4; s <= sEnd; s += 1.85) {
    phase += 0.85 + rand() * 0.25;
    const desired = Math.sin(phase) * (1.22 + rand() * 0.18);
    lateral += Math.max(-0.78, Math.min(0.78, desired - lateral));
    bands.push({ s, lateral });
  }
  bands.push({ s: walkStart - 1.45, lateral: 0.06 });

  const corridorAt = (s: number): number => {
    if (s <= bands[0].s) return (bands[0].lateral * Math.max(0, s)) / bands[0].s;
    for (let i = 1; i < bands.length; i++) {
      if (s <= bands[i].s) {
        const a = bands[i - 1];
        const b = bands[i];
        const t = (s - a.s) / (b.s - a.s);
        return a.lateral + (b.lateral - a.lateral) * t;
      }
    }
    const last = bands[bands.length - 1];
    const t = Math.min(1, Math.max(0, (s - last.s) / 1.15));
    return last.lateral + (0 - last.lateral) * t;
  };

  const glade0 = walkStart * 0.34;
  const glade1 = walkStart * 0.56;
  const glade: ParkGlade = { s: (glade0 + glade1) / 2, radius: 3.35 };
  const inGlade = (s: number, lat: number, reach = 1.85): boolean =>
    s > glade0 && s < glade1 && Math.abs(lat - corridorAt(s)) < reach;

  const pockets: Pocket[] = [];
  for (let i = 1; i < bands.length - 2; i += 2) {
    if (rand() < 0.22) continue;
    const band = bands[i];
    const mouth = corridorAt(band.s);
    const side = mouth - parkMinL > parkMaxL - mouth ? -1 : 1;
    const depth = side < 0 ? parkMinL + 0.42 : parkMaxL - 0.42;
    pockets.push({ s0: band.s - 0.15, s1: band.s + 1.25, side, mouth, depth });
  }

  const inPocket = (s: number, lat: number): boolean => {
    for (const pocket of pockets) {
      if (s < pocket.s0 || s > pocket.s1) continue;
      const lo = Math.min(pocket.mouth, pocket.depth);
      const hi = Math.max(pocket.mouth, pocket.depth);
      if (lat >= lo && lat <= hi) return true;
    }
    return false;
  };

  const nearCorridor = (s: number, lat: number, pad: number): boolean => {
    for (let ds = -0.7; ds <= 0.7; ds += 0.35) {
      if (Math.hypot(ds * 0.25, lat - corridorAt(s + ds)) < pad) return true;
    }
    return false;
  };

  const props: ParkProp[] = [];
  const occupied = (s: number, lat: number, reach: number): boolean => {
    for (const prop of props) {
      const half = prop.span * 0.5;
      const nearest = Math.min(prop.lateral + half, Math.max(prop.lateral - half, lat));
      if (Math.hypot(s - prop.s, lat - nearest) < reach + prop.radius * 0.85) return true;
    }
    return false;
  };

  const push = (prop: ParkProp): boolean => {
    if (prop.s < 1.05 || prop.s > walkStart - 0.85) return false;
    if (prop.lateral < parkMinL + 0.12 || prop.lateral > parkMaxL - 0.12) return false;
    if (occupied(prop.s, prop.lateral, prop.radius + (prop.span > 0 ? 0.15 : 0.28))) return false;
    props.push(prop);
    return true;
  };

  for (const pocket of pockets) {
    const gap = 1.7;
    const inner = pocket.mouth + pocket.side * gap;
    const outer = pocket.depth;
    if (Math.abs(outer - inner) < 0.7) continue;
    push({
      kind: "log",
      s: pocket.s1 - 0.02,
      lateral: (inner + outer) / 2,
      radius: 0.28,
      span: Math.abs(outer - inner),
      tilt: 0.15,
    });
    if (rand() < 0.65) {
      push({
        kind: "bench",
        s: (pocket.s0 + pocket.s1) * 0.5,
        lateral: pocket.mouth + pocket.side * (gap + 0.85),
        radius: 0.24,
        span: 0.8,
        tilt: 0,
      });
    }
  }

  const gateS = Math.min(walkStart - 3.4, glade1 + 1.55);
  const gateC = corridorAt(gateS);
  push({ kind: "rock", s: gateS, lateral: gateC - 0.98, radius: 0.5, span: 0, tilt: 0.4 });
  push({ kind: "rock", s: gateS + 0.18, lateral: gateC + 1.02, radius: 0.46, span: 0, tilt: 1.1 });
  push({
    kind: "stump",
    s: glade.s,
    lateral: corridorAt(glade.s) + 0.72,
    radius: 0.34,
    span: 0,
    tilt: 0.6,
  });

  const pocketOpens = (s: number, side: number): boolean => {
    for (const pocket of pockets) {
      if (pocket.side !== side) continue;
      if (s >= pocket.s0 - 0.25 && s <= pocket.s1 + 0.1) return true;
    }
    return false;
  };

  for (let s = 2.55; s < walkStart - 1.75; s += 0.92) {
    const center = corridorAt(s);
    for (const side of [-1, 1]) {
      if (pocketOpens(s, side)) continue;
      const ll = center + side * (1.14 + (rand() - 0.5) * 0.1);
      if (inGlade(s, ll, 2.2)) continue;
      const tall = rand() < 0.22;
      push({
        kind: tall ? "tree" : "thicket",
        s: s + (rand() - 0.5) * 0.14,
        lateral: ll,
        radius: 0.31,
        span: 0,
        tilt: rand() * Math.PI,
        scale: tall ? 0.92 + rand() * 0.5 : 0.85 + rand() * 0.45,
      });
    }
  }

  for (let s = 1.35; s < walkStart - 1.15; s += 1.05) {
    const jitter = (rand() - 0.5) * 0.28;
    const ss = s + (rand() - 0.5) * 0.2;
    for (const edge of [parkMinL + 0.28 + jitter, parkMaxL - 0.28 - jitter]) {
      if (inPocket(ss, edge)) continue;
      if (nearCorridor(ss, edge, 1.2)) continue;
      const tall = rand() < 0.45;
      push({
        kind: tall ? "tree" : "thicket",
        s: ss,
        lateral: edge,
        radius: 0.32,
        span: 0,
        tilt: rand() * Math.PI,
        scale: tall ? 1.05 + rand() * 0.4 : 0.95 + rand() * 0.5,
      });
    }
  }

  for (let s = 1.7; s < walkStart - 1.7; s += 0.96) {
    for (let lat = parkMinL + 0.85; lat <= parkMaxL - 0.75; lat += 0.86) {
      const ss = s + (rand() - 0.5) * 0.45;
      const ll = lat + (rand() - 0.5) * 0.4;
      if (nearCorridor(ss, ll, 1.28)) continue;
      if (inGlade(ss, ll)) continue;
      const tilt = rand() * Math.PI;
      if (inPocket(ss, ll)) {
        if (rand() < 0.5) {
          push({ kind: "bush", s: ss, lateral: ll, radius: 0.4 + rand() * 0.1, span: 0, tilt });
        }
        continue;
      }
      const roll = rand();
      if (roll < 0.2) {
        push({
          kind: "tree",
          s: ss,
          lateral: ll,
          radius: 0.28 + rand() * 0.06,
          span: 0,
          tilt,
          scale: 0.88 + rand() * 0.62,
        });
      } else if (roll < 0.66) {
        push({
          kind: "thicket",
          s: ss,
          lateral: ll,
          radius: 0.28 + rand() * 0.08,
          span: 0,
          tilt,
          scale: 0.8 + rand() * 0.6,
        });
      } else if (roll < 0.84) {
        push({ kind: "bush", s: ss, lateral: ll, radius: 0.4 + rand() * 0.14, span: 0, tilt });
      } else if (roll < 0.94) {
        const big = rand() < 0.4;
        if (big && nearCorridor(ss, ll, 1.5)) continue;
        push({ kind: "rock", s: ss, lateral: ll, radius: big ? 0.5 : 0.28, span: 0, tilt });
      } else {
        push({ kind: "stump", s: ss, lateral: ll, radius: 0.36, span: 0, tilt });
      }
    }
  }

  for (let s = 1.8; s < walkStart - 1.5; s += 2.3) {
    const center = corridorAt(s);
    for (const side of [-1, 1]) {
      if (rand() < 0.35) continue;
      const ll = center + side * (1.42 + rand() * 0.1);
      if (ll < parkMinL + 0.4 || ll > parkMaxL - 0.4) continue;
      if (inGlade(s, ll, 1.55)) continue;
      push({
        kind: "bush",
        s: s + (rand() - 0.5) * 0.3,
        lateral: ll,
        radius: 0.34,
        span: 0,
        tilt: rand() * 2,
      });
    }
  }

  const marks: ParkMark[] = [];
  for (let s = 0.35; s <= walkStart - 0.35; s += 0.62) {
    const open = s > glade0 && s < glade1;
    marks.push({ s, lateral: corridorAt(s), half: open ? 1.38 : 0.84, along: open ? 0.98 : 0.72 });
  }
  for (const pocket of pockets) {
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      marks.push({
        s: pocket.s0 + (pocket.s1 - pocket.s0) * 0.42,
        lateral: pocket.mouth + (pocket.depth - pocket.mouth) * t * 0.78,
        half: 0.58,
        along: 0.7,
      });
    }
  }

  const offTrail = (s: number, lat: number): number => {
    if (s < 0.4 || s >= walkStart - 0.2) return 0;
    let best = Math.abs(lat - corridorAt(s));
    for (let ds = -0.8; ds <= 0.8; ds += 0.4) best = Math.min(best, Math.abs(lat - corridorAt(s + ds)));
    for (const pocket of pockets) {
      if (s < pocket.s0 - 0.15 || s > pocket.s1 + 0.15) continue;
      const lo = Math.min(pocket.mouth, pocket.depth);
      const hi = Math.max(pocket.mouth, pocket.depth);
      const clamped = Math.min(hi, Math.max(lo, lat));
      const mid = (pocket.s0 + pocket.s1) * 0.5;
      best = Math.min(best, Math.hypot((s - mid) * 0.55, lat - clamped));
    }
    const pad = s > glade0 && s < glade1 ? 1.7 : 0.95;
    const t = Math.min(1, Math.max(0, (best - pad) / 1.15));
    return t * t * (3 - 2 * t);
  };

  return { props, marks, offTrail, glade };
}

const park = buildPark();

export const parkProps: ParkProp[] = park.props;
export const parkMarks: ParkMark[] = park.marks;
export const parkGlade: ParkGlade = park.glade;

export function parkOffTrail(s: number, lateral: number): number {
  return park.offTrail(s, lateral);
}

function isClimbable(prop: ParkProp): boolean {
  return prop.kind === "stump" || prop.kind === "bush" || (prop.kind === "rock" && prop.radius <= 0.34);
}

function propOverlap(prop: ParkProp, s: number, lateral: number, body: number): boolean {
  const half = prop.span * 0.5;
  const nearest = Math.min(prop.lateral + half, Math.max(prop.lateral - half, lateral));
  return Math.hypot(s - prop.s, lateral - nearest) < prop.radius + body;
}

export function parkBlocked(s: number, lateral: number, body: number): boolean {
  if (s >= walkStart - 0.15) return false;
  for (const prop of parkProps) {
    if (isClimbable(prop)) continue;
    if (Math.abs(s - prop.s) > prop.radius + prop.span + body + 0.2) continue;
    if (propOverlap(prop, s, lateral, body)) return true;
  }
  return false;
}

export function parkClimb(s: number, lateral: number, body: number): number {
  if (s >= walkStart - 0.15) return 0;
  let depth = 0;
  for (const prop of parkProps) {
    if (!isClimbable(prop)) continue;
    if (Math.abs(s - prop.s) > prop.radius + body + 0.2) continue;
    const half = prop.span * 0.5;
    const nearest = Math.min(prop.lateral + half, Math.max(prop.lateral - half, lateral));
    const dist = Math.hypot(s - prop.s, lateral - nearest);
    const reach = prop.radius + body;
    if (dist >= reach) continue;
    depth = Math.max(depth, (reach - dist) / reach);
  }
  return Math.min(1, depth);
}

export function slidePark(s: number, lateral: number, body: number): number {
  if (s >= walkStart - 0.15) return lateral;
  let lat = lateral;
  for (let pass = 0; pass < 3; pass++) {
    for (const prop of parkProps) {
      if (isClimbable(prop)) continue;
      if (Math.abs(s - prop.s) > prop.radius + prop.span + body + 0.2) continue;
      const half = prop.span * 0.5;
      const nearest = Math.min(prop.lateral + half, Math.max(prop.lateral - half, lat));
      const ds = s - prop.s;
      const dl = lat - nearest;
      const reach = prop.radius + body;
      if (Math.hypot(ds, dl) >= reach) continue;
      const room = reach * reach - ds * ds;
      if (room <= 0) continue;
      const sign = dl === 0 ? (lat >= prop.lateral ? 1 : -1) : Math.sign(dl);
      lat = nearest + sign * Math.sqrt(room);
    }
  }
  return lat;
}

export function clearLateral(s: number, prefer: number, body: number, minL: number, maxL: number): number {
  const steps = 32;
  let best = Math.min(maxL, Math.max(minL, prefer));
  let bestScore = Infinity;
  for (let i = 0; i <= steps; i++) {
    const lateral = minL + ((maxL - minL) * i) / steps;
    let blocked = false;
    for (const ahead of [0, 0.36, 0.72]) {
      if (parkBlocked(s + ahead, lateral, body)) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;
    const score = Math.abs(lateral - prefer);
    if (score < bestScore) {
      bestScore = score;
      best = lateral;
    }
  }
  return best;
}

export type LostChick = {
  s: number;
  lateral: number;
};

// A few chicks already sitting off the safe line. Reaching them is a detour.
export const lostChicks: LostChick[] = [
  { s: parkGlade.s - 1.55, lateral: -1.52 },
  { s: parkGlade.s + 2.05, lateral: 1.58 },
  { s: walkStart + 30, lateral: 1.82 },
  { s: crowdStart + 18.4, lateral: 0.94 },
  { s: forestStart + 9, lateral: 0.85 },
  { s: caveStart + 11, lateral: -0.92 },
  { s: caveStart + 24, lateral: 0.92 },
  { s: shoreStart + 8.2, lateral: 0.35 },
  { s: seaStart + 6, lateral: -1.1 },
  { s: seaStart + 12.5, lateral: 1.1 },
  { s: desertStart + 12, lateral: 1.1 },
];

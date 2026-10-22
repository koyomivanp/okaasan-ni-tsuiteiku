export type Point = { x: number; z: number };

export type SegmentId = "park" | "walk" | "road" | "crowd" | "nest";

export type Segment = {
  id: SegmentId;
  name: string;
  start: number;
  end: number;
  control: "lateral" | "longitudinal";
  camera: "chase" | "top";
  lost: string;
};

const knots: Point[] = [
  { x: 0, z: 0 },
  { x: 0, z: 14.2 },
  { x: 0.2, z: 20.7 },
  { x: 0.2, z: 23.2 },
  { x: 0.2, z: 27.6 },
  { x: 0.2, z: 47.6 },
  { x: 0.2, z: 49.3 },
  { x: 14.8, z: 49.3 },
  { x: 14.8, z: 54.8 },
  { x: 17.2, z: 59 },
  { x: 18.8, z: 61.2 },
];

const knotS: number[] = [0];
for (let i = 1; i < knots.length; i++) {
  const a = knots[i - 1];
  const b = knots[i];
  knotS.push(knotS[i - 1] + Math.hypot(b.x - a.x, b.z - a.z));
}

export const approachStart = knotS[2];
export const walkStart = knotS[3];
export const roadStart = knotS[4];
export const roadEnd = knotS[5];
export const crowdStart = knotS[6];
export const crowdEnd = knotS[7];
export const nestStart = knotS[8];
export const goal = knotS[knotS.length - 1];

export const lakeMinX = -15.5;
export const lakeMaxX = -1.02;
export const lakeMinZ = 21.6;
export const lakeMaxZ = 27.22;
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
    end: nestStart,
    control: "lateral",
    camera: "chase",
    lost: "歩道で置いていかれてしまった😿",
  },
  {
    id: "nest",
    name: "巣",
    start: nestStart,
    end: goal,
    control: "lateral",
    camera: "chase",
    lost: "巣の前で見失ってしまった😿",
  },
];

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
  let i = 1;
  while (i < knotS.length - 1 && c > knotS[i]) i++;
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

export type ParkPropKind = "rock" | "stump" | "bush" | "log" | "bench" | "tree";

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
      push({
        kind: "tree",
        s: s + (rand() - 0.5) * 0.14,
        lateral: ll,
        radius: 0.31,
        span: 0,
        tilt: rand() * Math.PI,
        scale: 0.92 + rand() * 0.5,
      });
    }
  }

  for (let s = 1.35; s < walkStart - 1.15; s += 1.05) {
    const jitter = (rand() - 0.5) * 0.28;
    const ss = s + (rand() - 0.5) * 0.2;
    for (const edge of [parkMinL + 0.28 + jitter, parkMaxL - 0.28 - jitter]) {
      if (inPocket(ss, edge)) continue;
      if (nearCorridor(ss, edge, 1.2)) continue;
      push({
        kind: "tree",
        s: ss,
        lateral: edge,
        radius: 0.32,
        span: 0,
        tilt: rand() * Math.PI,
        scale: 1.05 + rand() * 0.4,
      });
    }
  }

  for (let s = 1.7; s < walkStart - 1.7; s += 1.22) {
    for (let lat = parkMinL + 0.85; lat <= parkMaxL - 0.75; lat += 1.05) {
      const ss = s + (rand() - 0.5) * 0.45;
      const ll = lat + (rand() - 0.5) * 0.4;
      if (nearCorridor(ss, ll, 1.28)) continue;
      const tilt = rand() * Math.PI;
      if (inPocket(ss, ll)) {
        if (rand() < 0.5) {
          push({ kind: "bush", s: ss, lateral: ll, radius: 0.4 + rand() * 0.1, span: 0, tilt });
        }
        continue;
      }
      const roll = rand();
      if (roll < 0.7) {
        push({
          kind: "tree",
          s: ss,
          lateral: ll,
          radius: 0.28 + rand() * 0.06,
          span: 0,
          tilt,
          scale: 0.88 + rand() * 0.62,
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
    marks.push({ s, lateral: corridorAt(s), half: 0.84, along: 0.72 });
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
    const t = Math.min(1, Math.max(0, (best - 0.95) / 1.15));
    return t * t * (3 - 2 * t);
  };

  return { props, marks, offTrail };
}

const park = buildPark();

export const parkProps: ParkProp[] = park.props;
export const parkMarks: ParkMark[] = park.marks;

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

import { oncomingFlip, type Pose } from "./play.ts";
import { crowdEnd, crowdStart, nestStart, roadEnd, roadStart, walkStart } from "./route.ts";

export type Shot = {
  px: number;
  py: number;
  pz: number;
  tx: number;
  ty: number;
  tz: number;
  fov: number;
};

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function mixShot(a: Shot, b: Shot, t: number): Shot {
  return {
    px: mix(a.px, b.px, t),
    py: mix(a.py, b.py, t),
    pz: mix(a.pz, b.pz, t),
    tx: mix(a.tx, b.tx, t),
    ty: mix(a.ty, b.ty, t),
    tz: mix(a.tz, b.tz, t),
    fov: mix(a.fov, b.fov, t),
  };
}

export type ShotBlend = {
  s: number;
  road: number;
};

const BLEND_TAU = 0.7;

export function snapShotBlend(s: number, roadReady: boolean): ShotBlend {
  return { s, road: roadReady ? 1 : 0 };
}

export function stepShotBlend(blend: ShotBlend, s: number, roadReady: boolean, dt: number): void {
  const t = 1 - Math.exp(-Math.max(0, dt) / BLEND_TAU);
  blend.s += (s - blend.s) * t;
  const onto = Math.max(smoothstep(roadStart - 0.4, roadStart + 1.8, s), roadReady && s < roadEnd ? 1 : 0);
  const stillOnRoad = s < roadEnd ? 1 - smoothstep(roadEnd - 0.8, roadEnd, s) : 0;
  const goal = onto * stillOnRoad;
  const rate = 1 - Math.exp(-Math.max(0, dt) / (goal < blend.road ? 0.22 : BLEND_TAU));
  blend.road += (goal - blend.road) * rate;
}

export function shotFor(s: number, pose: Pose, roadK: number, blendS = s): Shot {
  const fx = Math.sin(pose.yaw);
  const fz = Math.cos(pose.yaw);
  const chase: Shot = {
    px: pose.x - fx * 1.85,
    py: 0.72,
    pz: pose.z - fz * 1.85,
    tx: pose.x + fx * 0.7,
    ty: 0.38,
    tz: pose.z + fz * 0.7,
    fov: 46,
  };
  const woods: Shot = {
    px: pose.x - fx * 2.25,
    py: 1.2,
    pz: pose.z - fz * 2.25,
    tx: pose.x + fx * 1.6,
    ty: 0.4,
    tz: pose.z + fz * 1.6,
    fov: 52,
  };
  const inWoods = 1 - smoothstep(walkStart - 0.8, walkStart + 0.55, blendS);
  const chaseShot = mixShot(chase, woods, inWoods);
  const rear: Shot = {
    px: pose.x - fx * 6.2,
    py: 4.2,
    pz: pose.z - fz * 6.2,
    tx: pose.x + fx * 8,
    ty: 0.25,
    tz: pose.z + fz * 8,
    fov: 62,
  };
  const road = highwayShot(pose, oncomingFlip(s));
  const crowd = crowdShot(pose);
  const rearK = smoothstep(walkStart - 0.15, walkStart + 2.2, blendS);
  const roadMix = Math.min(1, Math.max(0, roadK)) * (1 - smoothstep(roadEnd - 0.05, roadEnd + 0.28, s));
  const crowdK =
    smoothstep(crowdStart + 0.02, crowdStart + 0.72, s) * (1 - smoothstep(crowdEnd - 0.15, crowdEnd + 0.7, s));
  const nestK = smoothstep(nestStart - 0.6, nestStart + 1.2, blendS);
  const mixed = mixShot(mixShot(mixShot(chaseShot, rear, rearK * (1 - roadMix)), road, roadMix), crowd, crowdK);
  return mixShot(mixed, chase, nestK);
}

function crowdShot(pose: Pose): Shot {
  const fx = Math.sin(pose.yaw);
  const fz = Math.cos(pose.yaw);
  const rx = fz;
  const rz = -fx;
  return {
    px: pose.x - fx * 4.1 + rx * 0.35,
    py: 2.15,
    pz: pose.z - fz * 4.1 + rz * 0.35,
    tx: pose.x + fx * 9.5,
    ty: 0.7,
    tz: pose.z + fz * 9.5,
    fov: 50,
  };
}

function highwayShot(pose: Pose, flip: number): Shot {
  const eye = 2.55;
  const radius = 4.6;
  const lookDist = 18;
  const ahead = 0.3;
  const a = Math.PI + flip * Math.PI;
  const ox = Math.cos(a) * radius;
  const oz = Math.sin(a) * radius;
  const inv = radius;
  return {
    px: pose.x + ox,
    py: eye,
    pz: pose.z + oz + ahead,
    tx: pose.x + ox - (ox / inv) * lookDist,
    ty: 0.22,
    tz: pose.z + oz + ahead - (oz / inv) * lookDist,
    fov: 54,
  };
}

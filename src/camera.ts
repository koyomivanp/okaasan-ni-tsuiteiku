import { oncomingFlip, type Pose } from "./play.ts";
import { crowdEnd, crowdStart, nestStart, parkProps, poseAt, roadEnd, roadStart, segmentAt, walkStart } from "./route.ts";

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
  back: number;
  yaw: number;
  flip: number;
  woods: number;
  rear: number;
  crowd: number;
  nest: number;
  side: number;
  low: number;
  boss: number;
  cave: number;
  railS: number;
  railLateral: number;
};

// Every camera mode change eases in over about this long, whatever speed the chick is going.
const MODE_TAU = 0.85;
const YAW_TAU = 0.4;
const WOODS_BACK = 2.6;
const WOODS_EYE = 1.05;

function occludes(kind: string, radius: number): boolean {
  return kind === "tree" || kind === "thicket" || kind === "bush" || (kind === "rock" && radius > 0.4);
}

export function woodsBack(s: number, lateral: number): number {
  if (s >= walkStart) return WOODS_BACK;
  for (let d = 0.35; d <= WOODS_BACK + 0.25; d += 0.1) {
    const cs = s - d;
    for (const prop of parkProps) {
      if (Math.abs(prop.s - cs) > 1.2 || !occludes(prop.kind, prop.radius)) continue;
      if (Math.hypot(cs - prop.s, lateral - prop.lateral) < prop.radius * (prop.scale ?? 1) + 0.18) {
        return Math.max(0.5, d - 0.25);
      }
    }
  }
  return WOODS_BACK;
}

function modeGoals(s: number, roadReady: boolean) {
  const onto = Math.max(smoothstep(roadStart - 0.4, roadStart + 1.8, s), roadReady && s < roadEnd ? 1 : 0);
  const stillOnRoad = s < roadEnd ? 1 - smoothstep(roadEnd - 0.8, roadEnd, s) : 0;
  return {
    road: onto * stillOnRoad,
    woods: 1 - smoothstep(walkStart - 1.6, walkStart + 1.6, s),
    rear: smoothstep(walkStart - 0.6, walkStart + 3.2, s),
    crowd: smoothstep(crowdStart - 0.4, crowdStart + 1.8, s) * (1 - smoothstep(crowdEnd - 1, crowdEnd + 1.4, s)),
    nest: smoothstep(nestStart - 1.2, nestStart + 2, s),
    // The added go/stop stages are watched side-on, like the highway, with the way ahead to screen right.
    side: segmentAt(s).camera === "top" && segmentAt(s).id !== "road" ? 1 : 0,
    // Down at chick height in the forest, so the fog closes in around you.
    low: LOW_CAMERA.has(segmentAt(s).id) ? 1 : 0,
    // Pulled up and back in the king's hall so the pharaoh over the door stays in frame.
    boss: segmentAt(s).id === "king" ? 1 : 0,
    // High over the open-topped cave, so the floor shows past the bends before the chick gets there.
    cave: segmentAt(s).id === "cave" ? 1 : 0,
  };
}

function wrapAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

export function snapShotBlend(s: number, roadReady: boolean, lateral = 0): ShotBlend {
  const goals = modeGoals(s, roadReady);
  return {
    s,
    back: woodsBack(s, lateral),
    yaw: poseAt(s, lateral).yaw,
    flip: oncomingFlip(s),
    railS: s,
    railLateral: lateral,
    ...goals,
  };
}

export function stepShotBlend(blend: ShotBlend, s: number, roadReady: boolean, dt: number, lateral = 0): void {
  const ease = (tau: number) => 1 - Math.exp(-Math.max(0, dt) / tau);
  blend.s += (s - blend.s) * ease(MODE_TAU);
  const back = woodsBack(s, lateral);
  blend.back += (back - blend.back) * ease(back < blend.back ? 0.07 : 0.45);
  blend.yaw = wrapAngle(blend.yaw + wrapAngle(poseAt(s, lateral).yaw - blend.yaw) * ease(YAW_TAU));
  blend.flip += (oncomingFlip(s) - blend.flip) * ease(0.6);
  const goals = modeGoals(s, roadReady);
  const k = ease(MODE_TAU);
  blend.road += (goals.road - blend.road) * k;
  blend.woods += (goals.woods - blend.woods) * k;
  blend.rear += (goals.rear - blend.rear) * k;
  blend.crowd += (goals.crowd - blend.crowd) * k;
  blend.nest += (goals.nest - blend.nest) * k;
  blend.side += (goals.side - blend.side) * k;
  blend.low += (goals.low - blend.low) * k;
  blend.boss += (goals.boss - blend.boss) * k;
  blend.cave += (goals.cave - blend.cave) * k;
  blend.railS = s;
  blend.railLateral += (lateral - blend.railLateral) * ease(0.25);
}

export function shotFor(at: Pose, blend: ShotBlend): Shot {
  const pose: Pose = { x: at.x, z: at.z, yaw: blend.yaw };
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
  const back = blend.back;
  const tuck = 1 - back / WOODS_BACK;
  const woods: Shot = {
    px: pose.x - fx * back,
    py: WOODS_EYE + tuck * 0.22,
    pz: pose.z - fz * back,
    tx: pose.x + fx * 1.8,
    ty: 0.36,
    tz: pose.z + fz * 1.8,
    fov: 58,
  };
  const chaseShot = mixShot(chase, woods, blend.woods);
  const rear: Shot = {
    px: pose.x - fx * 3.15,
    py: 1.42,
    pz: pose.z - fz * 3.15,
    tx: pose.x + fx * 2.2,
    ty: 0.34,
    tz: pose.z + fz * 2.2,
    fov: 50,
  };
  const road = highwayShot(at, blend.flip);
  const crowd = crowdShot(pose);
  const roadMix = Math.min(1, Math.max(0, blend.road));
  const mixed = mixShot(mixShot(mixShot(chaseShot, rear, blend.rear * (1 - roadMix)), road, roadMix), crowd, blend.crowd);
  const lowered = mixShot(mixShot(mixed, chase, blend.nest), lowShot(pose), blend.low);
  const raised = mixShot(lowered, bossShot(pose), blend.boss);
  const sided = mixShot(raised, sideShot(at), blend.side);
  return mixShot(sided, caveShot(blend.railS, blend.railLateral), blend.cave);
}

const LOW_CAMERA = new Set(["forest"]);
// ローアングル：子どもの後ろの距離・目の高さ・前を見る距離
const LOW_BACK = 1.6;
const LOW_EYE = 0.82;
const LOW_LOOK = 2.6;

// 洞窟：道に沿って後ろから見下ろす。子どもの後ろの距離・高さ・前を見る距離・横の動きへの追従
const CAVE_BACK = 1.5;
const CAVE_EYE = 5.4;
const CAVE_LOOK = 1.5;
const CAVE_SWAY = 0.85;

// ボス戦：子どもの後ろの距離・目の高さ・前を見る距離と高さ
const BOSS_BACK = 3.2;
const BOSS_EYE = 4.3;
const BOSS_LOOK = 2.5;
const BOSS_AIM = 0.2;

// タイトル画面：家族の後ろから、帰り道の先まで見渡す
export function titleShot(pose: Pose, time: number): Shot {
  const fx = Math.sin(pose.yaw);
  const fz = Math.cos(pose.yaw);
  const sway = Math.sin(time * 0.22) * 0.28;
  const rx = fz;
  const rz = -fx;
  // Behind the family, looking the way home: the bushes ahead of mom would hide them from the front.
  return {
    px: pose.x - fx * 3 + rx * (1.3 + sway),
    py: 1.2,
    pz: pose.z - fz * 3 + rz * (1.3 + sway),
    tx: pose.x + fx * 2,
    ty: 0.5,
    tz: pose.z + fz * 2,
    fov: 50,
  };
}

function bossShot(pose: Pose): Shot {
  const fx = Math.sin(pose.yaw);
  const fz = Math.cos(pose.yaw);
  return {
    px: pose.x - fx * BOSS_BACK,
    py: BOSS_EYE,
    pz: pose.z - fz * BOSS_BACK,
    tx: pose.x + fx * BOSS_LOOK,
    ty: BOSS_AIM,
    tz: pose.z + fz * BOSS_LOOK,
    fov: 68,
  };
}

// Both ends sit on the route itself, so the view turns into a bend before the chick reaches it.
function caveShot(s: number, lateral: number): Shot {
  const eye = poseAt(s - CAVE_BACK, lateral * CAVE_SWAY);
  const aim = poseAt(s + CAVE_LOOK, lateral * CAVE_SWAY);
  return {
    px: eye.x,
    py: CAVE_EYE,
    pz: eye.z,
    tx: aim.x,
    ty: 0.1,
    tz: aim.z,
    fov: 62,
  };
}

function lowShot(pose: Pose): Shot {
  const fx = Math.sin(pose.yaw);
  const fz = Math.cos(pose.yaw);
  return {
    px: pose.x - fx * LOW_BACK,
    py: LOW_EYE,
    pz: pose.z - fz * LOW_BACK,
    tx: pose.x + fx * LOW_LOOK,
    ty: 0.22,
    tz: pose.z + fz * LOW_LOOK,
    fov: 62,
  };
}

// 横からの視点：道からの距離・目の高さ・子どもより先を映す距離（縦長の画面でも先の危険が見えるように）
const SIDE_BACK = 8;
const SIDE_EYE = 2.2;
const SIDE_AHEAD = 1.5;

function sideShot(pose: Pose): Shot {
  const fx = Math.sin(pose.yaw);
  const fz = Math.cos(pose.yaw);
  // poseAt puts +lateral at (fz, -fx); stand on the other side and look across.
  const rx = fz;
  const rz = -fx;
  return {
    px: pose.x - rx * SIDE_BACK + fx * SIDE_AHEAD,
    py: SIDE_EYE,
    pz: pose.z - rz * SIDE_BACK + fz * SIDE_AHEAD,
    tx: pose.x + fx * SIDE_AHEAD,
    ty: 0.45,
    tz: pose.z + fz * SIDE_AHEAD,
    fov: 56,
  };
}

function crowdShot(pose: Pose): Shot {
  const fx = Math.sin(pose.yaw);
  const fz = Math.cos(pose.yaw);
  const rx = fz;
  const rz = -fx;
  return {
    px: pose.x - fx * 2.55 + rx * 0.18,
    py: 1.22,
    pz: pose.z - fz * 2.55 + rz * 0.18,
    tx: pose.x + fx * 3.1,
    ty: 0.4,
    tz: pose.z + fz * 3.1,
    fov: 48,
  };
}

function highwayShot(pose: Pose, flip: number): Shot {
  const eye = 1.42;
  const radius = 3.15;
  const lookDist = 8.2;
  const ahead = 0.12;
  const a = Math.PI + flip * Math.PI;
  const ox = Math.cos(a) * radius;
  const oz = Math.sin(a) * radius;
  const inv = radius;
  return {
    px: pose.x + ox,
    py: eye,
    pz: pose.z + oz + ahead,
    tx: pose.x + ox - (ox / inv) * lookDist,
    ty: 0.28,
    tz: pose.z + oz + ahead - (oz / inv) * lookDist,
    fov: 48,
  };
}

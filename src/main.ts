import * as THREE from "three";
import "./style.css";
import { shotFor, snapShotBlend, stepShotBlend, titleShot, type Shot } from "./camera.ts";
import { createEnding } from "./ending.ts";
import { ASPHALT_LENGTH, createScenery } from "./scenery.ts";
import { Kit } from "./stages/view-kit.ts";
import { makeWater } from "./stages/water.ts";
import { Duck } from "./duck.ts";
import { makeVehicle } from "./vehicle.ts";
import { bindInput } from "./input.ts";
import { stopTracking, track } from "./metrics.ts";
import { sound, unlockSound } from "./sound.ts";
import { stageOf } from "./stages/index.ts";
import { kingAnxious, kingCaged, kingFight, kingRush, leapAmount, leapTarget } from "./stages/king.ts";
import { createWorld } from "./stages/world.ts";
import { pathStrip } from "./stages/view-kit.ts";
import {
  begin,
  BROOD_COUNT,
  broodAlive,
  canContinue,
  CHICK_BODY,
  broodFlight,
  broodPose,
  broodNearby,
  carsAt,
  childPose,
  controlMode,
  oncomingFlip,
  createGame,
  DROWNED,
  flightOffset,
  guideLateral,
  motherGlance,
  motherPose,
  bikesAt,
  peopleAt,
  placeHint,
  walkersAt,
  placeName,
  retry,
  update,
  warpStops,
  warpTo,
} from "./play.ts";
import {
  forestStart,
  crowdEnd,
  crowdStart,
  inLake,
  lakeCenter,
  lakeMaxX,
  lakeMaxZ,
  lakeMinX,
  lakeMinZ,
  lakeSize,
  lakeY,
  PARK_SHIFT,
  parkClimb,
  parkGlade,
  parkMarks,
  parkMaxL,
  parkMinL,
  parkProps,
  pointAt,
  poseAt,
  roadEnd,
  roadStart,
  samplePath,
  segmentAt,
  segments,
  type SegmentId,
  walkHedge,
  walkProps,
  walkSide,
  walkStart,
} from "./route.ts";

const stage = document.querySelector<HTMLDivElement>("#stage")!;
const place = document.querySelector<HTMLParagraphElement>("#place")!;
const broodLabel = document.querySelector<HTMLParagraphElement>("#brood")!;
const hint = document.querySelector<HTMLParagraphElement>("#hint")!;
const start = document.querySelector<HTMLDivElement>("#start")!;
const result = document.querySelector<HTMLDivElement>("#result")!;
const message = document.querySelector<HTMLParagraphElement>("#message")!;
const frameEl = document.querySelector<HTMLDivElement>("#frame")!;
const copyButton = document.querySelector<HTMLButtonElement>("#copy")!;
const homeCopy = document.querySelector<HTMLButtonElement>("#home-copy")!;
const homeRetry = document.querySelector<HTMLButtonElement>("#home-retry")!;
const retryButton = document.querySelector<HTMLButtonElement>("#retry")!;
const beginButtons = document.querySelectorAll<HTMLButtonElement>("[data-begin]");
const turn = document.querySelector<HTMLParagraphElement>("#turn")!;
const buttonA = document.querySelector<HTMLButtonElement>("#btn-a")!;
const buttonB = document.querySelector<HTMLButtonElement>("#btn-b")!;

const game = createGame();
// Dev only: lets a test script read the run and steer like the probe's autopilot.
const debugView: { shot: Shot | null } = { shot: null };
if (import.meta.env.DEV) Object.assign(window, { __debug: { game, guideLateral, segmentAt, stageOf, view: debugView, poseAt, kingFight } });
const cameraBlend = snapShotBlend(game.childS, game.curbUsed, game.lateral);
const input = bindInput(
  buttonA,
  buttonB,
  () => controlMode(game),
  // Only the highway turns the screen around; the other side-on stages always run left to right.
  () => (segmentAt(game.childS).id === "road" ? oncomingFlip(game.childS) : 0),
);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fd0f2);
scene.fog = new THREE.Fog(0xc5e4f8, 14, 48);

const camera = new THREE.PerspectiveCamera(42, 9 / 16, 0.1, 200);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
stage.appendChild(renderer.domElement);

const hemi = new THREE.HemisphereLight(0xe6f4ff, 0x9dbb7c, 2.05);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1d6, 1.6);
sun.position.set(-5, 14, -7);
scene.add(sun);

const grassMat = new THREE.MeshLambertMaterial({ color: 0x8ecb68 });
const lay = (x0: number, x1: number, z0: number, z1: number) => {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), grassMat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
  scene.add(mesh);
};
lay(-70, 130, -24, lakeMinZ);
lay(-70, 130, lakeMaxZ, 170);
lay(-70, lakeMinX, lakeMinZ, lakeMaxZ);
lay(lakeMaxX, 130, lakeMinZ, lakeMaxZ);

const parkWater = makeWater(0x2f9fcd, 0x62cfe3);
const water = new THREE.Mesh(new THREE.PlaneGeometry(lakeSize.x - 0.2, lakeSize.z - 0.2), parkWater);
water.rotation.x = -Math.PI / 2;
water.position.set(lakeCenter.x, lakeY, lakeCenter.z);
scene.add(water);

const bankMat = new THREE.MeshLambertMaterial({ color: 0x6d9a4e });
const drop = -lakeY;
const addBank = (w: number, d: number, x: number, z: number) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, drop, d), bankMat);
  mesh.position.set(x, lakeY / 2, z);
  scene.add(mesh);
};
addBank(lakeSize.x, 0.42, lakeCenter.x, lakeMinZ);
addBank(0.42, lakeSize.z, lakeMinX, lakeCenter.z);
addBank(0.28, lakeSize.z, lakeMaxX, lakeCenter.z);

const shore = pointAt(roadStart);
const farSide = pointAt(roadEnd);
const roadCenter = pointAt((roadStart + roadEnd) / 2);
const roadLength = farSide.z - shore.z;
const asphaltLength = ASPHALT_LENGTH;
const roadTop = 0.045;
const road = new THREE.Mesh(
  new THREE.PlaneGeometry(asphaltLength, roadLength),
  new THREE.MeshLambertMaterial({ color: 0x3c4452 }),
);
road.rotation.x = -Math.PI / 2;
road.position.set(roadCenter.x, roadTop, (shore.z + farSide.z) / 2);
scene.add(road);
const lipMat = new THREE.MeshLambertMaterial({ color: 0x9c958a });
const lip = new THREE.Mesh(new THREE.BoxGeometry(lakeSize.x + 0.8, 0.08, 0.9), lipMat);
lip.position.set(lakeCenter.x - 0.15, roadTop, lakeMaxZ + 0.1);
const lipFace = new THREE.Mesh(new THREE.BoxGeometry(lakeSize.x + 0.8, -lakeY, 0.12), lipMat);
lipFace.position.set(lakeCenter.x - 0.15, lakeY / 2, lakeMaxZ - 0.32);
scene.add(lip, lipFace);

const dashMat = new THREE.MeshLambertMaterial({ color: 0xe7edf2 });
const edgeMat = new THREE.MeshLambertMaterial({ color: 0xf4f7fb });
const laneZ = (t: number) => pointAt(roadStart + t * roadLength).z;
const markings = new Kit();
const paintLine = (z: number, solid: boolean) => {
  const material = solid ? edgeMat : dashMat;
  if (solid) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(asphaltLength, 0.015, 0.1), material);
    line.position.set(roadCenter.x, roadTop + 0.02, z);
    scene.add(line);
    return;
  }
  for (let x = roadCenter.x - asphaltLength / 2; x < roadCenter.x + asphaltLength / 2; x += 2.6) {
    markings.add("box", x + 0.6, roadTop + 0.02, z, 1.15, 0.015, 0.08, material.color.getHex());
  }
};
paintLine(laneZ(0.03), true);
for (const t of [0.143, 0.258, 0.376, 0.679, 0.784, 0.894]) paintLine(laneZ(t), false);
paintLine(laneZ(0.985), true);

const barrierMat = new THREE.MeshLambertMaterial({ color: 0xb7c0c8 });
const barrierYellow = new THREE.MeshLambertMaterial({ color: 0xe2c14a });
const medianZ = laneZ(0.5);
for (let x = roadCenter.x - asphaltLength / 2; x <= roadCenter.x + asphaltLength / 2; x += 2.35) {
  if (Math.abs(x - roadCenter.x) < 2.3) continue;
  markings.add("box", x, 0.32, medianZ, 2.15, 0.55, 0.36, barrierMat.color.getHex());
  markings.add("box", x, 0.52, medianZ, 2.15, 0.06, 0.38, barrierYellow.color.getHex());
}
scene.add(markings.build());

const pathMat = new THREE.MeshLambertMaterial({ color: 0xdcbf8a });
const concrete = new THREE.MeshLambertMaterial({ color: 0xd5d8dc });
const forestMat = new THREE.MeshLambertMaterial({ color: 0x5f9a46 });
const floorZ0 = -0.45;
const floorZ1 = lakeMinZ - 0.28;
let floorX0 = Infinity;
let floorX1 = -Infinity;
for (let s = 0; s <= walkStart; s += 0.45) {
  for (const lat of [parkMinL - 0.7, parkMaxL + 0.7]) {
    const pose = poseAt(s, lat);
    floorX0 = Math.min(floorX0, pose.x);
    floorX1 = Math.max(floorX1, pose.x);
  }
}
floorX0 -= 1.4;
floorX1 += 1.4;
const forestFloor = new THREE.Mesh(new THREE.PlaneGeometry(floorX1 - floorX0, floorZ1 - floorZ0), forestMat);
forestFloor.rotation.x = -Math.PI / 2;
forestFloor.position.set((floorX0 + floorX1) / 2, 0.03, (floorZ0 + floorZ1) / 2);
scene.add(forestFloor);
const gladeAt = poseAt(parkGlade.s, 0);
const glade = new THREE.Mesh(
  new THREE.CircleGeometry(parkGlade.radius, 22),
  new THREE.MeshLambertMaterial({ color: 0xb6de78 }),
);
glade.rotation.x = -Math.PI / 2;
glade.position.set(gladeAt.x, 0.04, gladeAt.z);
scene.add(glade);
for (const mark of parkMarks) {
  const pose = poseAt(mark.s, mark.lateral);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(mark.half * 2, 0.004, mark.along), pathMat);
  slab.position.set(pose.x, 0.058, pose.z);
  slab.rotation.y = pose.yaw;
  scene.add(slab);
}
for (const sample of samplePath(0.72)) {
  if (sample.s >= forestStart) break;
  const onRoad = sample.s >= roadStart - 0.05 && sample.s < roadEnd + 0.02;
  if (onRoad || sample.z < floorZ1 - 0.15) continue;
  const onSidewalk = (sample.s >= walkStart && sample.s < roadStart) || sample.s >= roadEnd;
  if (!onSidewalk) continue;
  const slab = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.06, 0.8), concrete);
  slab.position.set(sample.x, 0.07, sample.z);
  slab.rotation.y = sample.yaw;
  scene.add(slab);
}

// The park's dirt path, with a worn grassy margin either side.
let parkPathEnd = walkStart + 0.4;
while (parkPathEnd > 0 && pointAt(parkPathEnd).z >= floorZ1 - 0.15) parkPathEnd -= 0.1;
scene.add(pathStrip(0, parkPathEnd, 1.72, 0.05, 0xa9bb6c), pathStrip(0, parkPathEnd, 1.5, 0.056, 0xdcbf8a));

const curbMat = new THREE.MeshLambertMaterial({ color: 0xb7b1a4 });
const addRibbon = (s0: number, s1: number, wide: number) => {
  const step = 0.85;
  for (let s = s0; s < s1 - 0.01; s += step) {
    const a = pointAt(s);
    const b = pointAt(Math.min(s1, s + step));
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const length = Math.hypot(dx, dz);
    if (length < 0.05) continue;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(wide, 0.06, length + 0.24), concrete);
    mesh.position.set((a.x + b.x) / 2, 0.045, (a.z + b.z) / 2);
    mesh.rotation.y = Math.atan2(dx, dz);
    scene.add(mesh);
  }
};
addRibbon(walkStart, roadStart, 2.5);
addRibbon(roadEnd, crowdStart, 2.5);
addRibbon(crowdStart, crowdEnd, 2.5);
addRibbon(crowdEnd, forestStart, 2.7);
const addCurb = (s0: number, s1: number, lateral: number) => {
  for (let s = s0; s < s1 - 0.2; s += 2.15) {
    const pose = poseAt(Math.min(s1 - 0.4, s + 0.9), lateral);
    if (inLake(pose.x, pose.z)) continue;
    const curb = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 2.05), curbMat);
    curb.position.set(pose.x, 0.1, pose.z);
    curb.rotation.y = pose.yaw;
    scene.add(curb);
  }
};
addCurb(walkStart, roadStart, 1.28);
addCurb(walkStart, roadStart, -1.28);
addCurb(crowdStart, crowdEnd, 1.28);
addCurb(crowdStart, crowdEnd, -1.28);

const wallMat = new THREE.MeshLambertMaterial({ color: 0xe7e2d6 });
const capMat = new THREE.MeshLambertMaterial({ color: 0xc4493a });
const wallZ = pointAt(crowdStart).z + 1.42;
const gapX = pointAt(crowdEnd).x;
const addWall = (x0: number, x1: number) => {
  const mid = (x0 + x1) / 2;
  const body = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 2.35, 0.28), wallMat);
  body.position.set(mid, 1.18, wallZ);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.08, 0.36), capMat);
  cap.position.set(mid, 2.4, wallZ);
  scene.add(body, cap);
};
addWall(pointAt(crowdStart).x - 2.4, gapX - 1.4);
addWall(gapX + 1.4, gapX + 6.2);

const treeMat = new THREE.MeshLambertMaterial({ color: 0x3f8f45 });
const treeDark = new THREE.MeshLambertMaterial({ color: 0x2c6b34 });
const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5230 });
const rockMat = new THREE.MeshLambertMaterial({ color: 0x8d8680 });
const rockDark = new THREE.MeshLambertMaterial({ color: 0x6a635c });
const logMat = new THREE.MeshLambertMaterial({ color: 0x6d4a2c });
const benchMat = new THREE.MeshLambertMaterial({ color: 0x8d5a32 });
const stumpTop = new THREE.MeshLambertMaterial({ color: 0xc4a574 });

const blob = new THREE.SphereGeometry(1, 9, 7);
const shrubMat = new THREE.MeshLambertMaterial({ color: 0x4f9a43 });
const shrubLight = new THREE.MeshLambertMaterial({ color: 0x6bb251 });

// A low, lumpy clump of leaves about as tall as the chicks, so the woods read at their scale.
const addShrub = (x: number, z: number, radius: number, height: number, twist: number, dark: boolean) => {
  const lumps = 3;
  for (let i = 0; i < lumps; i++) {
    const ang = twist + (i / lumps) * Math.PI * 2;
    const r = radius * (0.62 + ((i * 37 + Math.round(twist * 10)) % 5) * 0.06);
    const lump = new THREE.Mesh(blob, i === 1 ? shrubLight : dark ? treeDark : shrubMat);
    lump.scale.set(r, height * (0.75 + i * 0.12), r);
    lump.position.set(x + Math.cos(ang) * radius * 0.42, height * 0.42, z + Math.sin(ang) * radius * 0.42);
    scene.add(lump);
  }
};

// Trunks rise well past the camera; the leaves only start above it.
const addTallTree = (x: number, z: number, scale: number, twist: number, dark: boolean) => {
  const height = 2.15 * scale;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * scale, 0.19 * scale, height, 7), trunkMat);
  trunk.position.set(x, height / 2, z);
  trunk.rotation.y = twist;
  scene.add(trunk);
  const leaves = dark ? treeDark : treeMat;
  for (let i = 0; i < 3; i++) {
    const ang = twist + i * 2.1;
    const r = (0.78 + i * 0.12) * scale;
    const crown = new THREE.Mesh(blob, leaves);
    crown.scale.set(r, r * 0.72, r);
    crown.position.set(x + Math.cos(ang) * 0.38 * scale, height + 0.25 * scale + i * 0.22 * scale, z + Math.sin(ang) * 0.38 * scale);
    scene.add(crown);
  }
};

parkProps.forEach((prop, index) => {
  const pose = poseAt(prop.s, prop.lateral);
  if (prop.kind === "tree") {
    addTallTree(pose.x, pose.z, prop.scale ?? 1, prop.tilt, prop.tilt > 1.4);
    return;
  }
  if (prop.kind === "thicket") {
    const scale = prop.scale ?? 1;
    addShrub(pose.x, pose.z, prop.radius * 1.25, 0.5 * scale + 0.12, prop.tilt, prop.tilt > 1.9);
    return;
  }
  if (prop.kind === "rock") {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(prop.radius, 0), index % 2 === 0 ? rockMat : rockDark);
    rock.position.set(pose.x, prop.radius * 0.42, pose.z);
    rock.rotation.set(prop.tilt, prop.tilt * 2.1, prop.tilt * 0.55);
    rock.scale.y = 0.78;
    scene.add(rock);
    return;
  }
  if (prop.kind === "stump") {
    const stump = new THREE.Mesh(new THREE.CylinderGeometry(prop.radius, prop.radius * 1.08, 0.36, 7), trunkMat);
    stump.position.set(pose.x, 0.17, pose.z);
    const top = new THREE.Mesh(new THREE.CircleGeometry(prop.radius * 0.9, 7), stumpTop);
    top.rotation.x = -Math.PI / 2;
    top.position.set(pose.x, 0.36, pose.z);
    scene.add(stump, top);
    return;
  }
  if (prop.kind === "bush") {
    const bush = new THREE.Mesh(new THREE.SphereGeometry(prop.radius, 10, 8), treeMat);
    bush.scale.set(1.08, 0.7, 1.05);
    bush.position.set(pose.x, prop.radius * 0.52, pose.z);
    scene.add(bush);
    return;
  }
  if (prop.kind === "log") {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(prop.radius, prop.radius * 1.04, prop.span, 7), logMat);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = pose.yaw;
    log.position.set(pose.x, prop.radius * 0.82, pose.z);
    scene.add(log);
    return;
  }
  const bench = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(prop.span, 0.08, 0.34), benchMat);
  seat.position.y = 0.32;
  const back = new THREE.Mesh(new THREE.BoxGeometry(prop.span, 0.26, 0.06), benchMat);
  back.position.set(0, 0.48, -0.14);
  bench.add(seat, back);
  for (const lx of [-prop.span * 0.32, prop.span * 0.32]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.32, 0.28), benchMat);
    leg.position.set(lx, 0.16, 0);
    bench.add(leg);
  }
  bench.position.set(pose.x, 0, pose.z);
  bench.rotation.y = pose.yaw;
  scene.add(bench);
});
const addTree = (x: number, z: number, scale: number) => {
  if (inLake(x, z) || z > lakeMinZ - 0.85 || z < -2.4) return;
  if (x > floorX0 - 0.35 && x < floorX1 + 0.35 && z < floorZ1) return;
  const dark = (Math.round(x * 3 + z) & 1) === 0;
  addTallTree(x, z, scale, x * 1.3 + z, dark);
  addShrub(x + 0.7, z - 0.5, 0.42, 0.62, z, !dark);
};
for (let row = 0; row < 13; row++) {
  for (let col = 0; col < 5; col++) {
    const x = parkMinL - 1.4 - col * 2.15 + Math.sin(row * 1.7 + col) * 0.32;
    const z = -1.1 + row * 1.8 + Math.cos(col * 1.3 + row) * 0.36;
    addTree(x, z, 0.95 + ((row * 3 + col) % 4) * 0.16);
  }
  for (let col = 0; col < 4; col++) {
    const x = parkMaxL + 1.25 + col * 2.1 + Math.cos(row * 1.1 + col) * 0.3;
    const z = -0.5 + row * 1.85 + Math.sin(col * 0.9 + row) * 0.32;
    addTree(x, z, 0.9 + ((row + col * 2) % 4) * 0.15);
  }
}

function makeDeer(): THREE.Group {
  const group = new THREE.Group();
  const fur = new THREE.MeshLambertMaterial({ color: 0x8a5a32 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x5c3b22 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.36, 0.28), fur);
  body.position.y = 0.56;
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.32, 0.14), fur);
  neck.position.set(0.28, 0.84, 0);
  neck.rotation.z = -0.45;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.14), fur);
  head.position.set(0.48, 0.98, 0);
  group.add(body, neck, head);
  for (const [x, z] of [
    [-0.22, -0.08],
    [-0.22, 0.08],
    [0.22, -0.08],
    [0.22, 0.08],
  ] as const) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.36, 0.07), dark);
    leg.position.set(x, 0.18, z);
    group.add(leg);
  }
  return group;
}

function makeRabbit(): THREE.Group {
  const group = new THREE.Group();
  const fur = new THREE.MeshLambertMaterial({ color: 0xe4ddd2 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), fur);
  body.scale.set(1.35, 0.85, 0.8);
  body.position.y = 0.18;
  const ear = new THREE.BoxGeometry(0.045, 0.22, 0.04);
  const left = new THREE.Mesh(ear, fur);
  const right = new THREE.Mesh(ear, fur);
  left.position.set(0.05, 0.4, 0.05);
  right.position.set(0.05, 0.4, -0.05);
  group.add(body, left, right);
  return group;
}

function makeFox(): THREE.Group {
  const group = new THREE.Group();
  const fur = new THREE.MeshLambertMaterial({ color: 0xd36a28 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.2, 0.16), fur);
  body.position.y = 0.28;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.12), fur);
  head.position.set(0.24, 0.36, 0);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.06), fur);
  tail.position.set(-0.3, 0.34, 0);
  group.add(body, head, tail);
  return group;
}

const animals: { object: THREE.Group; phase: number }[] = [];
const placeAnimal = (object: THREE.Group, x: number, z: number, yaw: number, phase: number) => {
  object.position.set(x + PARK_SHIFT.x, 0, z + PARK_SHIFT.z);
  object.rotation.y = yaw;
  scene.add(object);
  animals.push({ object, phase });
};
placeAnimal(makeDeer(), -6.4, 3.4, 0, 0.2);
placeAnimal(makeRabbit(), -9.2, 7.1, 0.4, 1.1);
placeAnimal(makeFox(), -4.6, 11.4, 0.6, 2.2);

const poleMat = new THREE.MeshLambertMaterial({ color: 0x5c6570 });
const lampMat = new THREE.MeshLambertMaterial({ color: 0xf3e2a4 });
const binMat = new THREE.MeshLambertMaterial({ color: 0x2f6a45 });
const binLidMat = new THREE.MeshLambertMaterial({ color: 0x244e34 });
const puddleMat = new THREE.MeshLambertMaterial({ color: 0x3f7fb6, transparent: true, opacity: 0.9 });
const puddleRimMat = new THREE.MeshLambertMaterial({ color: 0x7c8a94 });
const puddleShineMat = new THREE.MeshBasicMaterial({ color: 0xdff1ff, transparent: true, opacity: 0.75 });

for (const prop of walkProps) {
  const pose = poseAt(prop.s, prop.lateral);
  if (prop.kind === "puddle") {
    const rim = new THREE.Mesh(new THREE.CircleGeometry(prop.radius * 1.14, 20), puddleRimMat);
    rim.rotation.set(-Math.PI / 2, 0, pose.yaw);
    rim.position.set(pose.x, 0.108, pose.z);
    rim.scale.y = 1.35;
    const puddle = new THREE.Mesh(new THREE.CircleGeometry(prop.radius, 20), puddleMat);
    puddle.rotation.set(-Math.PI / 2, 0, pose.yaw);
    puddle.position.set(pose.x, 0.114, pose.z);
    puddle.scale.y = 1.35;
    const shine = new THREE.Mesh(new THREE.CircleGeometry(prop.radius * 0.3, 12), puddleShineMat);
    shine.rotation.set(-Math.PI / 2, 0, pose.yaw);
    shine.position.set(pose.x + 0.08, 0.118, pose.z + 0.1);
    shine.scale.y = 0.45;
    scene.add(rim, puddle, shine);
    continue;
  }
  const bin = new THREE.Mesh(new THREE.BoxGeometry(prop.radius * 2, 0.46, prop.radius * 2), binMat);
  bin.position.set(pose.x, 0.3, pose.z);
  bin.rotation.y = pose.yaw;
  const lid = new THREE.Mesh(new THREE.BoxGeometry(prop.radius * 2.2, 0.07, prop.radius * 2.2), binLidMat);
  lid.position.set(pose.x, 0.54, pose.z);
  lid.rotation.y = pose.yaw;
  scene.add(bin, lid);
}

for (let s = walkStart + 0.4, i = 0; s < roadStart - 0.5; s += 0.5, i++) {
  for (const side of [-1, 1]) {
    const jitter = Math.sin(i * 2.3 + side * 1.7) * 0.5 + 0.5;
    const lateral = side * (walkHedge + 0.18 + jitter * (walkSide - walkHedge - 0.05));
    const pose = poseAt(s + Math.cos(i * 1.9) * 0.12, lateral);
    if (inLake(pose.x, pose.z) || pose.z > pointAt(roadStart).z - 0.5) continue;
    addShrub(pose.x, pose.z, 0.3 + jitter * 0.08, 0.26 + jitter * 0.12, i * 0.7, (i & 1) === 0);
  }
}

for (let s = walkStart + 2.2; s < roadStart - 1.2; s += 8.2) {
  const pose = poseAt(s, walkSide + 0.55);
  if (pose.z > pointAt(roadStart).z - 1.4) continue;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 1.65, 6), poleMat);
  pole.position.set(pose.x, 0.82, pose.z);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.16), lampMat);
  head.position.set(pose.x, 1.66, pose.z);
  scene.add(pole, head);
}

for (let s = walkStart + 3.1; s < roadStart - 1.4; s += 6.6) {
  for (const lateral of [walkSide + 0.95, -walkSide - 0.95]) {
    const pose = poseAt(s, lateral);
    if (inLake(pose.x, pose.z) || (lateral < 0 && pose.z < lakeMaxZ + 0.8)) continue;
    if (pose.z > pointAt(roadStart).z - 1.15) continue;
    const scale = lateral > 0 ? 0.85 : 0.78;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08 * scale, 0.12 * scale, 0.7 * scale, 6), trunkMat);
    trunk.position.set(pose.x, 0.32 * scale, pose.z);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(0.5 * scale, 1.15 * scale, 7), treeMat);
    crown.position.set(pose.x, 1.0 * scale, pose.z);
    scene.add(trunk, crown);
  }
}

const scenery = createScenery(scene);

const mother = new Duck("mother");
const child = new Duck("child", { ribbon: true });
const broodColors = [0xf2c14e, 0xffd15a, 0xe6b03a, 0xf6c84a, 0xffe08a, 0xd9a441, 0xf0b429, 0xf8d56b, 0xe8c15a];
const shadowGeo = new THREE.CircleGeometry(0.28, 16);
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x163024, transparent: true, opacity: 0.18 });
const beaconGeo = new THREE.CircleGeometry(0.34, 16);
const beaconMat = new THREE.MeshBasicMaterial({
  color: 0xfff4b0,
  transparent: true,
  opacity: 0.45,
  depthWrite: false,
});
type BroodView = { duck: Duck; shadow: THREE.Mesh; beacon: THREE.Mesh };
const broodViews: BroodView[] = [];

function addBroodView(index: number): BroodView {
  const duck = new Duck("child", {
    bodyColor: broodColors[index % broodColors.length],
    scale: 0.9 + (index % 3) * 0.05,
    gait: index * 0.13,
  });
  scene.add(duck.object);
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.045;
  scene.add(shadow);
  const beacon = new THREE.Mesh(beaconGeo, beaconMat.clone());
  beacon.rotation.x = -Math.PI / 2;
  beacon.position.y = 0.05;
  beacon.visible = false;
  scene.add(beacon);
  const view = { duck, shadow, beacon };
  broodViews.push(view);
  return view;
}

for (let i = 0; i < BROOD_COUNT; i++) addBroodView(i);
scene.add(mother.object, child.object);
const world = createWorld(scene, stage, hemi, sun, mother.object);

const motherShadow = new THREE.Mesh(shadowGeo, shadowMat);
const childShadow = new THREE.Mesh(shadowGeo, shadowMat);
motherShadow.rotation.x = -Math.PI / 2;
childShadow.rotation.x = -Math.PI / 2;
motherShadow.position.y = 0.045;
childShadow.position.y = 0.045;
scene.add(motherShadow, childShadow);

const ending = createEnding({
  scene,
  frame: frameEl,
  sky: world.sky,
  oasis: world.oasis,
  hemi,
  sun,
  mother,
  motherShadow,
  child,
  childShadow,
  brood: broodViews,
  restore: () => world.restore(),
});

const carMeshes = carsAt(0).map((car) => {
  const mesh = makeVehicle(car.kind, car.color);
  scene.add(mesh);
  return mesh;
});

type PersonView = {
  group: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  materials: THREE.MeshLambertMaterial[];
  shadow: THREE.MeshBasicMaterial;
};

function makePerson(color: number): PersonView {
  const group = new THREE.Group();
  group.rotation.order = "YXZ";
  const cloth = new THREE.MeshLambertMaterial({ color, transparent: true });
  const skin = new THREE.MeshLambertMaterial({ color: 0xf1c7a3, transparent: true });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2c3340, transparent: true });
  const eye = new THREE.MeshLambertMaterial({ color: 0x1d2430, transparent: true });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.28, 4, 8), cloth);
  body.position.y = 0.52;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), skin);
  head.position.set(0, 0.86, 0.02);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), skin);
  nose.position.set(0, 0.84, 0.12);
  const eyeGeo = new THREE.SphereGeometry(0.016, 8, 6);
  const leftEye = new THREE.Mesh(eyeGeo, eye);
  const rightEye = new THREE.Mesh(eyeGeo, eye);
  leftEye.position.set(-0.042, 0.9, 0.09);
  rightEye.position.set(0.042, 0.9, 0.09);
  const legGeo = new THREE.BoxGeometry(0.07, 0.26, 0.08);
  const leftLeg = new THREE.Group();
  const rightLeg = new THREE.Group();
  const leftMesh = new THREE.Mesh(legGeo, pants);
  const rightMesh = new THREE.Mesh(legGeo, pants);
  leftMesh.position.y = -0.13;
  rightMesh.position.y = -0.13;
  leftLeg.position.set(-0.06, 0.32, 0);
  rightLeg.position.set(0.06, 0.32, 0);
  leftLeg.add(leftMesh);
  rightLeg.add(rightMesh);
  const shadow = new THREE.MeshBasicMaterial({ color: 0x163024, transparent: true, opacity: 0 });
  const blob = new THREE.Mesh(new THREE.CircleGeometry(0.2, 14), shadow);
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.05;
  group.add(body, head, nose, leftEye, rightEye, leftLeg, rightLeg, blob);
  return { group, leftLeg, rightLeg, materials: [cloth, skin, pants, eye], shadow };
}

const peopleMeshes = peopleAt(0, -1).map((person) => {
  const view = makePerson(person.color);
  scene.add(view.group);
  return view;
});

const walkerMeshes = walkersAt(0).map((person) => {
  const view = makePerson(person.color);
  scene.add(view.group);
  return view;
});

function makeBike(color: number): THREE.Group {
  const group = new THREE.Group();
  const frame = new THREE.MeshLambertMaterial({ color });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1d2430 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xf1c7a3 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.08, 0.1), frame);
  body.position.y = 0.3;
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.06), frame);
  bar.position.set(0.16, 0.4, 0);
  const rider = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.16, 3, 6), skin);
  rider.position.set(-0.02, 0.62, 0);
  const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.12), frame);
  shirt.position.set(-0.02, 0.5, 0);
  for (const x of [-0.24, 0.24]) {
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.03, 6, 10), dark);
    wheel.position.set(x, 0.16, 0);
    group.add(wheel);
  }
  group.add(body, bar, rider, shirt);
  // Built nose along +x; turn it so the front wheel leads along +z like the walkers, straight at the chick.
  group.rotation.y = -Math.PI / 2;
  const turned = new THREE.Group();
  turned.add(group);
  return turned;
}

const bikeMeshes = bikesAt(0).map((bike) => {
  const mesh = makeBike(bike.color);
  mesh.visible = false;
  scene.add(mesh);
  return mesh;
});

function resize(): void {
  const width = stage.clientWidth;
  const height = stage.clientHeight;
  camera.aspect = width / Math.max(1, height);
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  const phoneLandscape = window.innerWidth > window.innerHeight && window.innerHeight < 520;
  turn.hidden = !phoneLandscape;
}

function resetCamera(): void {
  Object.assign(cameraBlend, snapShotBlend(game.childS, game.curbUsed, game.lateral));
}

const heard = { alive: BROOD_COUNT, phase: game.phase, checkpoint: game.checkpoint };

// Where the walk puts mom and the chicks. The ending takes over from this once they are home.
function syncDucks(dt: number): void {
  const mom = motherPose(game);
  const kid = childPose(game);
  const flight = flightOffset(game);
  const sinking = game.outcome === DROWNED;
  const flightAmount = flight && !sinking ? Math.min(1, game.yeet / 0.72) : 0;

  const momClimb = parkClimb(game.momS, game.momLateral, 0.34);
  mother.object.position.set(mom.x, momClimb * 0.28, mom.z);
  mother.object.rotation.set(0, mom.yaw, 0);
  mother.update(game.momDelta, 0, motherGlance(game), dt);

  const kidClimb = flight ? 0 : parkClimb(game.childS, game.lateral, CHICK_BODY);
  child.object.position.set(kid.x + (flight?.x ?? 0), (flight?.y ?? 0) + kidClimb * 0.32, kid.z);
  child.object.rotation.set(flight?.spin ?? 0, kid.yaw, flight ? flight.spin * 0.45 : 0);
  // A sidestep while standing still in line is still footwork.
  child.update(Math.max(game.childDelta, Math.abs(game.lateralVel) * dt), flightAmount);

  motherShadow.position.x = mom.x;
  motherShadow.position.z = mom.z;
  motherShadow.scale.setScalar(1.34);
  childShadow.position.x = kid.x;
  childShadow.position.z = kid.z;
  childShadow.visible = flight === null;

  while (broodViews.length < game.brood.length) addBroodView(broodViews.length);
  broodViews.forEach((view, index) => {
    if (index >= game.brood.length) {
      view.duck.object.visible = false;
      view.shadow.visible = false;
      view.beacon.visible = false;
      return;
    }
    const npc = game.brood[index];
    const pose = broodPose(game, index);
    const flight = broodFlight(game, index);
    const gone = npc.phase === "gone";
    const waiting = npc.phase === "stranded";
    view.duck.object.visible = !gone;
    const chickClimb = flight || npc.phase !== "walk" ? 0 : parkClimb(npc.s, npc.lateral, CHICK_BODY);
    view.duck.object.position.set(pose.x + (flight?.x ?? 0), (flight?.y ?? 0) + chickClimb * 0.26, pose.z);
    const face = waiting ? pose.yaw + Math.PI * 0.5 * Math.sign(npc.lateral || 1) : pose.yaw;
    view.duck.object.rotation.set(flight?.spin ?? 0, face, flight ? flight.spin * 0.45 : 0);
    const chickSinking = npc.phase === "yeet" && npc.yeetDir === 0;
    const glance = waiting ? Math.sin(game.time * 7 + npc.seed) * 0.55 : 0;
    // While mom is caged the line shuffles on the spot and each chick keeps turning to look.
    const anxious = npc.phase === "walk" && kingAnxious(game.time);
    if (anxious) view.duck.object.rotation.y += Math.sin(game.time * 3.1 + npc.seed) * 0.45;
    const footwork = anxious ? Math.max(npc.moved, dt * 0.55) : npc.moved;
    view.duck.update(footwork, flight && !chickSinking ? Math.min(1, npc.yeet / 0.72) : 0, glance, dt, waiting ? 1 : 0);
    view.shadow.visible = npc.phase === "walk" || waiting;
    view.shadow.position.x = pose.x;
    view.shadow.position.z = pose.z;
    view.shadow.scale.setScalar(view.duck.object.scale.x);
    view.beacon.visible = waiting && !gone;
    if (waiting) {
      const pulse = 0.72 + Math.sin(game.time * 5.2 + npc.seed) * 0.22;
      view.beacon.position.set(pose.x, 0.05, pose.z);
      view.beacon.scale.setScalar(pulse);
      (view.beacon.material as THREE.MeshBasicMaterial).opacity = 0.28 + Math.sin(game.time * 5.2 + npc.seed) * 0.16;
    }
  });
  if (kingCaged(game.time)) {
    // Mom throws herself at the bars.
    mother.object.position.y += Math.abs(Math.sin(game.time * 9)) * 0.1;
    mother.object.rotation.z = Math.sin(game.time * 13) * 0.08;
  }
  const rush = kingRush(game.time);
  if (rush !== null) {
    const walking = game.brood.map((npc, index) => ({ npc, index })).filter(({ npc }) => npc.phase === "walk" && !npc.stray);
    const count = walking.length + 1;
    leap(mother.object, rush, 0, count);
    leap(child.object, rush, 1, count);
    walking.forEach(({ index }, k) => leap(broodViews[index].duck.object, rush, k + 2, count));
  }
}

// One of the family flying from where the walk left them onto the king, and back down afterwards.
function leap(object: THREE.Object3D, rush: number, order: number, count: number): void {
  const amount = leapAmount(rush, order, count);
  if (amount <= 0) return;
  const target = leapTarget(order);
  const at = poseAt(target.s, target.lateral);
  object.position.x += (at.x - object.position.x) * amount;
  object.position.z += (at.z - object.position.z) * amount;
  object.position.y += (target.y - object.position.y) * amount + Math.sin(Math.PI * amount) * 0.9;
  object.rotation.x = amount * Math.PI * 0.35;
}

let titleClock = 0;
let everStarted = false;

function sync(dt: number): void {
  const kid = childPose(game);
  const home = game.phase === "result" && game.success;
  if (ending.active && !home) ending.stop();
  if (!ending.active) syncDucks(dt);
  parkWater.uniforms.uTime.value += dt;

  carsAt(game.time).forEach((car, index) => {
    const mesh = carMeshes[index];
    mesh.position.set(car.x, 0, car.z);
    mesh.rotation.y = car.dir > 0 ? 0 : Math.PI;
  });

  const showPerson = (view: (typeof peopleMeshes)[number], person: ReturnType<typeof peopleAt>[number]) => {
    view.group.visible = person.visible;
    if (!person.visible) return;
    // Runners lean in, bounce and take longer strides.
    const bounce = person.run ? Math.abs(Math.sin(person.stride)) * 0.07 : 0;
    view.group.position.set(person.x, bounce, person.z);
    view.group.rotation.y = person.yaw;
    view.group.rotation.x = person.run ? 0.2 : 0;
    const swing = Math.sin(person.stride) * (person.run ? 1.05 : 0.72);
    view.leftLeg.rotation.x = swing;
    view.rightLeg.rotation.x = -swing;
    for (const material of view.materials) material.opacity = person.fade;
    view.shadow.opacity = 0.16 * person.fade;
  };
  peopleAt(game.time, game.crowdAt).forEach((person, index) => showPerson(peopleMeshes[index], person));
  walkersAt(game.time).forEach((person, index) => showPerson(walkerMeshes[index], person));
  bikesAt(game.time, game.crowdAt).forEach((bike, index) => {
    const mesh = bikeMeshes[index];
    mesh.visible = bike.visible;
    if (!mesh.visible) return;
    mesh.position.set(bike.x, 0, bike.z);
    mesh.rotation.set(0, bike.yaw, 0);
  });

  world.update(game, dt);

  animals.forEach((animal) => {
    animal.object.position.y = Math.sin(game.time * 1.6 + animal.phase) * 0.025;
  });

  scenery.update(game.childS, camera, dt);
  stepShotBlend(cameraBlend, game.childS, game.curbUsed, dt, game.lateral);
  if (home && !ending.active) ending.start(game, shotFor(kid, cameraBlend));
  if (ending.active) ending.update(dt);
  titleClock += dt;
  const title = !everStarted && game.phase === "ready";
  const shot = debugView.shot ?? (ending.active ? ending.shot() : title ? titleShot(poseAt(game.momS - 1.5, 0), titleClock) : shotFor(kid, cameraBlend));
  camera.fov = shot.fov;
  camera.updateProjectionMatrix();
  camera.position.set(shot.px, shot.py, shot.pz);
  camera.lookAt(shot.tx, shot.ty, shot.tz);
  world.follow(camera, dt);
  frameEl.classList.toggle("at-title", title);
  // Down low in the forest and the cave the lens stands among the siblings: hide the ones right at it.
  if (cameraBlend.low > 0.3 && !ending.active) {
    for (const view of broodViews) {
      if (view.duck.object.position.distanceTo(camera.position) >= 1.45) continue;
      view.duck.object.visible = false;
      view.shadow.visible = false;
    }
  }

  place.textContent = placeName(game);
  hint.textContent = game.phase === "play" ? placeHint(game) : "";
  const alive = broodAlive(game);
  const nearby = broodNearby(game);
  const popping = game.phase === "play" && game.rescuePop > 0;
  broodLabel.textContent = popping
    ? `残機 ${alive}  ${game.rescuePopText}`
    : nearby > 0
      ? `残機 ${alive}  はぐれ${nearby}`
      : `残機 ${alive}`;
  broodLabel.classList.toggle("pop", popping || nearby > 0);
  if (alive > heard.alive && game.phase === "play") sound.piyo();
  if (alive < heard.alive && game.phase === "play") sound.peep();
  if (game.phase !== heard.phase) {
    if (game.phase === "yeet" || (game.phase === "result" && heard.phase === "play")) {
      if (game.success) {
        track("clear");
      } else {
        sound.fail();
        const where = segmentAt(game.childS).id;
        track(`fail/${where}`);
        if (!canContinue(game)) track(`gameover/${where}`);
      }
    }
  }
  if (game.checkpoint !== heard.checkpoint && game.checkpoint !== "park") track(`reach/${game.checkpoint}`);
  heard.alive = alive;
  heard.phase = game.phase;
  heard.checkpoint = game.checkpoint;
  input.labels();
  const showing = game.phase === "result" && !game.success;
  result.hidden = !showing;
  if (showing) {
    message.textContent = game.message;
    retryButton.textContent = !canContinue(game) ? "はじめから" : `つづきから（残機 ${game.broodHeadcount - 1}）`;
  }
}

beginButtons.forEach((button) =>
  button.addEventListener("click", () => {
    unlockSound();
    sound.tap();
    everStarted = true;
    track("start");
    begin(game);
    // Dev only: ?stage=cave starts from that stage's checkpoint, for trying one stage at a time.
    const jump = import.meta.env.DEV ? new URLSearchParams(location.search).get("stage") : null;
    if (jump && segments.some((segment) => segment.id === jump)) warpTo(game, jump as SegmentId);
    resetCamera();
    start.hidden = true;
    result.hidden = true;
  }),
);

// Developer stage select: type G, O, D on a keyboard to open it.
const godMenu = document.createElement("div");
godMenu.id = "god";
godMenu.hidden = true;
const godTitle = document.createElement("p");
godTitle.textContent = "GOD：ステージを選ぶ";
godMenu.appendChild(godTitle);
const godList = document.createElement("div");
godList.className = "god-list";
godMenu.appendChild(godList);
warpStops().forEach((stop, index) => {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = `${index + 1}. ${stop.id === "crowd" ? "人混み" : stop.name}`;
  button.addEventListener("click", () => {
    unlockSound();
    sound.tap();
    everStarted = true;
    stopTracking();
    warpTo(game, stop.id);
    resetCamera();
    start.hidden = true;
    result.hidden = true;
    godMenu.hidden = true;
  });
  godList.appendChild(button);
});
const godClose = document.createElement("button");
godClose.type = "button";
godClose.className = "god-close";
godClose.textContent = "とじる";
godClose.addEventListener("click", () => {
  godMenu.hidden = true;
});
godMenu.appendChild(godClose);
document.querySelector("#frame")!.appendChild(godMenu);

let typed = "";
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") godMenu.hidden = true;
  if (event.key.length !== 1) return;
  typed = (typed + event.key.toLowerCase()).slice(-3);
  if (typed === "god") {
    typed = "";
    godMenu.hidden = !godMenu.hidden;
  }
});

const again = () => {
  unlockSound();
  sound.tap();
  track("retry");
  retry(game);
  resetCamera();
  result.hidden = true;
};
retryButton.addEventListener("click", again);
homeRetry.addEventListener("click", again);

const share = async (button: HTMLButtonElement) => {
  sound.tap();
  track("share");
  const where = game.success ? "" : `（${placeName(game)}）`;
  const url = location.origin + location.pathname;
  const count = game.success ? "" : ` きょうだい ${broodAlive(game)}羽`;
  const text = `帰巣本能｜${game.message}${where}${count}
#帰巣本能
${url}`;
  // On a phone this opens the share sheet; where there is none, the text goes on the clipboard to paste.
  if (navigator.share) {
    try {
      await navigator.share({ text });
    } catch {
      // Closing the sheet without sharing is fine.
    }
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
  button.textContent = "コピーした";
  window.setTimeout(() => {
    button.textContent = "SNSで自慢する";
  }, 900);
};
copyButton.addEventListener("click", () => void share(copyButton));
homeCopy.addEventListener("click", () => void share(homeCopy));

if (import.meta.env.DEV) Object.assign(window, { __debug: { ...(window as unknown as { __debug: object }).__debug, ending, scene, camera, renderer, peopleMeshes, walkerMeshes } });

resize();
window.addEventListener("resize", resize);
track("open");

let last = performance.now();
function tick(now: number): void {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  if (godMenu.hidden && (game.phase === "play" || game.phase === "yeet")) update(game, input.read(), dt);
  sync(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

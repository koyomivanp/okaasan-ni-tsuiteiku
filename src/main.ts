import * as THREE from "three";
import "./style.css";
import { shotFor, snapShotBlend, stepShotBlend } from "./camera.ts";
import { Duck } from "./duck.ts";
import { makeVehicle } from "./vehicle.ts";
import { bindInput } from "./input.ts";
import { sound, unlockSound } from "./sound.ts";
import {
  begin,
  BROOD_COUNT,
  broodAlive,
  broodFlight,
  broodPose,
  carsAt,
  childPose,
  controlMode,
  oncomingFlip,
  createGame,
  DROWNED,
  flightOffset,
  motherGlance,
  motherPose,
  peopleAt,
  placeHint,
  placeName,
  retry,
  update,
} from "./play.ts";
import {
  crowdEnd,
  crowdStart,
  goal,
  inLake,
  lakeCenter,
  lakeMaxX,
  lakeMaxZ,
  lakeMinX,
  lakeMinZ,
  lakeSize,
  lakeY,
  nestStart,
  parkClimb,
  parkMarks,
  parkMaxL,
  parkMinL,
  parkProps,
  pointAt,
  poseAt,
  roadEnd,
  roadStart,
  samplePath,
  walkStart,
} from "./route.ts";

const stage = document.querySelector<HTMLDivElement>("#stage")!;
const place = document.querySelector<HTMLParagraphElement>("#place")!;
const broodLabel = document.querySelector<HTMLParagraphElement>("#brood")!;
const hint = document.querySelector<HTMLParagraphElement>("#hint")!;
const start = document.querySelector<HTMLDivElement>("#start")!;
const result = document.querySelector<HTMLDivElement>("#result")!;
const message = document.querySelector<HTMLParagraphElement>("#message")!;
const copyButton = document.querySelector<HTMLButtonElement>("#copy")!;
const retryButton = document.querySelector<HTMLButtonElement>("#retry")!;
const beginButton = document.querySelector<HTMLButtonElement>("#begin")!;
const turn = document.querySelector<HTMLParagraphElement>("#turn")!;
const buttonA = document.querySelector<HTMLButtonElement>("#btn-a")!;
const buttonB = document.querySelector<HTMLButtonElement>("#btn-b")!;

const game = createGame();
const cameraBlend = snapShotBlend(game.childS, game.curbUsed);
const input = bindInput(
  buttonA,
  buttonB,
  () => controlMode(game),
  () => oncomingFlip(game.childS),
);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fd0f2);
scene.fog = new THREE.Fog(0xc5e4f8, 36, 130);

const camera = new THREE.PerspectiveCamera(42, 9 / 16, 0.1, 160);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
stage.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xd7efff, 0x6d9a52, 1.15));
const sun = new THREE.DirectionalLight(0xfff6df, 1.35);
sun.position.set(7, 14, 5);
scene.add(sun);

const grassMat = new THREE.MeshLambertMaterial({ color: 0x8ecb68 });
const lay = (x0: number, x1: number, z0: number, z1: number) => {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), grassMat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
  scene.add(mesh);
};
lay(-70, 80, -24, lakeMinZ);
lay(-70, 80, lakeMaxZ, 120);
lay(-70, lakeMinX, lakeMinZ, lakeMaxZ);
lay(lakeMaxX, 80, lakeMinZ, lakeMaxZ);

const water = new THREE.Mesh(
  new THREE.PlaneGeometry(lakeSize.x - 0.2, lakeSize.z - 0.2),
  new THREE.MeshLambertMaterial({ color: 0x3eadd6 }),
);
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
const asphaltLength = 64;
const roadTop = 0.045;
const road = new THREE.Mesh(
  new THREE.PlaneGeometry(asphaltLength, roadLength),
  new THREE.MeshLambertMaterial({ color: 0x3c4452 }),
);
road.rotation.x = -Math.PI / 2;
road.position.set(roadCenter.x, roadTop, (shore.z + farSide.z) / 2);
scene.add(road);
const lipMat = new THREE.MeshLambertMaterial({ color: 0x2a313c });
const lip = new THREE.Mesh(new THREE.BoxGeometry(lakeSize.x + 0.8, 0.08, 0.9), lipMat);
lip.position.set(lakeCenter.x - 0.15, roadTop, lakeMaxZ + 0.1);
const lipFace = new THREE.Mesh(new THREE.BoxGeometry(lakeSize.x + 0.8, -lakeY, 0.12), lipMat);
lipFace.position.set(lakeCenter.x - 0.15, lakeY / 2, lakeMaxZ - 0.32);
scene.add(lip, lipFace);

const dashMat = new THREE.MeshLambertMaterial({ color: 0xe7edf2 });
const edgeMat = new THREE.MeshLambertMaterial({ color: 0xf4f7fb });
const laneZ = (t: number) => pointAt(roadStart + t * roadLength).z;
const paintLine = (z: number, solid: boolean) => {
  const material = solid ? edgeMat : dashMat;
  if (solid) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(asphaltLength, 0.015, 0.1), material);
    line.position.set(roadCenter.x, roadTop + 0.02, z);
    scene.add(line);
    return;
  }
  for (let x = roadCenter.x - asphaltLength / 2; x < roadCenter.x + asphaltLength / 2; x += 2.6) {
    const dash = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.015, 0.08), material);
    dash.position.set(x + 0.6, roadTop + 0.02, z);
    scene.add(dash);
  }
};
paintLine(laneZ(0.03), true);
for (const t of [0.143, 0.258, 0.376, 0.679, 0.784, 0.894]) paintLine(laneZ(t), false);
paintLine(laneZ(0.985), true);

const barrierMat = new THREE.MeshLambertMaterial({ color: 0xb7c0c8 });
const barrierYellow = new THREE.MeshLambertMaterial({ color: 0xe2c14a });
const medianZ = laneZ(0.5);
for (let x = roadCenter.x - 30; x <= roadCenter.x + 30; x += 2.35) {
  if (Math.abs(x - roadCenter.x) < 2.3) continue;
  const block = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.55, 0.36), barrierMat);
  block.position.set(x, 0.32, medianZ);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.06, 0.38), barrierYellow);
  stripe.position.set(x, 0.52, medianZ);
  scene.add(block, stripe);
}

const pathMat = new THREE.MeshLambertMaterial({ color: 0xc6a36b });
const concrete = new THREE.MeshLambertMaterial({ color: 0xd5d8dc });
const forestMat = new THREE.MeshLambertMaterial({ color: 0x5f9a46 });
const floorZ0 = -0.45;
const floorZ1 = lakeMinZ - 0.28;
const floorX0 = parkMinL - 0.08;
const floorX1 = parkMaxL + 0.08;
const forestFloor = new THREE.Mesh(new THREE.PlaneGeometry(floorX1 - floorX0, floorZ1 - floorZ0), forestMat);
forestFloor.rotation.x = -Math.PI / 2;
forestFloor.position.set((floorX0 + floorX1) / 2, 0.03, (floorZ0 + floorZ1) / 2);
scene.add(forestFloor);
for (const mark of parkMarks) {
  const pose = poseAt(mark.s, mark.lateral);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(mark.half * 2, 0.035, mark.along), pathMat);
  slab.position.set(pose.x, 0.055, pose.z);
  slab.rotation.y = pose.yaw;
  scene.add(slab);
}
for (const sample of samplePath(0.72)) {
  const onRoad = sample.s >= roadStart - 0.05 && sample.s < roadEnd + 0.02;
  if (onRoad || sample.z < floorZ1 - 0.15) continue;
  const onSidewalk = (sample.s >= walkStart && sample.s < roadStart) || (sample.s >= roadEnd && sample.s < nestStart);
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(onSidewalk ? 2.35 : 3.1, 0.06, 0.8),
    onSidewalk ? concrete : pathMat,
  );
  slab.position.set(sample.x, onSidewalk ? 0.07 : 0.05, sample.z);
  slab.rotation.y = sample.yaw;
  scene.add(slab);
}

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

const nestAt = pointAt(goal);
const twig = new THREE.MeshLambertMaterial({ color: 0x8a5a32 });
for (let i = 0; i < 10; i++) {
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.7, 6), twig);
  const ang = (i / 10) * Math.PI * 2;
  stick.position.set(nestAt.x + Math.cos(ang) * 0.42, 0.12, nestAt.z + Math.sin(ang) * 0.42);
  stick.rotation.z = Math.PI / 2;
  stick.rotation.y = ang;
  scene.add(stick);
}

const treeMat = new THREE.MeshLambertMaterial({ color: 0x3f8f45 });
const treeDark = new THREE.MeshLambertMaterial({ color: 0x2c6b34 });
const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5230 });
const rockMat = new THREE.MeshLambertMaterial({ color: 0x8d8680 });
const rockDark = new THREE.MeshLambertMaterial({ color: 0x6a635c });
const logMat = new THREE.MeshLambertMaterial({ color: 0x6d4a2c });
const benchMat = new THREE.MeshLambertMaterial({ color: 0x8d5a32 });
const stumpTop = new THREE.MeshLambertMaterial({ color: 0xc4a574 });

parkProps.forEach((prop, index) => {
  const pose = poseAt(prop.s, prop.lateral);
  if (prop.kind === "tree") {
    const scale = prop.scale ?? 1;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * scale, 0.15 * scale, 0.7 * scale, 6), trunkMat);
    trunk.position.set(pose.x, 0.35 * scale, pose.z);
    const leaves = prop.tilt > 1.4 ? treeDark : treeMat;
    const crown = new THREE.Mesh(new THREE.ConeGeometry(0.62 * scale, 1.45 * scale, 8), leaves);
    crown.position.set(pose.x, 1.2 * scale, pose.z);
    const skirt = new THREE.Mesh(new THREE.SphereGeometry(0.58 * scale, 8, 6), leaves);
    skirt.scale.y = 0.72;
    skirt.position.set(pose.x, 0.62 * scale, pose.z);
    trunk.rotation.y = prop.tilt;
    scene.add(trunk, crown, skirt);
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
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.11 * scale, 0.16 * scale, 0.72 * scale, 6), trunkMat);
  trunk.position.set(x, 0.36 * scale, z);
  const leaves = (Math.round(x * 3 + z) & 1) === 0 ? treeMat : treeDark;
  const crown = new THREE.Mesh(new THREE.ConeGeometry(0.58 * scale, 1.35 * scale, 8), leaves);
  crown.position.set(x, 1.15 * scale, z);
  scene.add(trunk, crown);
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
  object.position.set(x, 0, z);
  object.rotation.y = yaw;
  scene.add(object);
  animals.push({ object, phase });
};
placeAnimal(makeDeer(), -6.4, 3.4, 0, 0.2);
placeAnimal(makeRabbit(), -9.2, 7.1, 0.4, 1.1);
placeAnimal(makeFox(), -4.6, 11.4, 0.6, 2.2);

const mother = new Duck("mother");
const child = new Duck("child", { ribbon: true });
const broodColors = [0xf2c14e, 0xffd15a, 0xe6b03a, 0xf6c84a, 0xffe08a, 0xd9a441, 0xf0b429, 0xf8d56b, 0xe8c15a];
const brood = Array.from({ length: BROOD_COUNT }, (_, index) => {
  const duck = new Duck("child", {
    bodyColor: broodColors[index],
    scale: 0.9 + (index % 3) * 0.05,
    gait: index * 0.13,
  });
  scene.add(duck.object);
  return duck;
});
scene.add(mother.object, child.object);

const shadowGeo = new THREE.CircleGeometry(0.28, 16);
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x163024, transparent: true, opacity: 0.18 });
const motherShadow = new THREE.Mesh(shadowGeo, shadowMat);
const childShadow = new THREE.Mesh(shadowGeo, shadowMat);
motherShadow.rotation.x = -Math.PI / 2;
childShadow.rotation.x = -Math.PI / 2;
motherShadow.position.y = 0.045;
childShadow.position.y = 0.045;
const broodShadows = brood.map(() => {
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.045;
  scene.add(shadow);
  return shadow;
});
scene.add(motherShadow, childShadow);

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
  const next = snapShotBlend(game.childS, game.curbUsed);
  cameraBlend.s = next.s;
  cameraBlend.road = next.road;
}

const heard = { alive: BROOD_COUNT, phase: game.phase };

function sync(dt: number): void {
  const mom = motherPose(game);
  const kid = childPose(game);
  const flight = flightOffset(game);
  const sinking = game.outcome === DROWNED;
  const flightAmount = flight && !sinking ? Math.min(1, game.yeet / 0.72) : 0;

  const momClimb = parkClimb(game.momS, game.momLateral, 0.34);
  mother.object.position.set(mom.x, momClimb * 0.28, mom.z);
  mother.object.rotation.set(0, mom.yaw, 0);
  mother.update(game.momDelta, 0, motherGlance(game), dt);

  const kidClimb = flight ? 0 : parkClimb(game.childS, game.lateral, 0.24);
  child.object.position.set(kid.x + (flight?.x ?? 0), (flight?.y ?? 0) + kidClimb * 0.32, kid.z);
  child.object.rotation.set(flight?.spin ?? 0, kid.yaw, flight ? flight.spin * 0.45 : 0);
  child.update(game.childDelta, flightAmount);

  motherShadow.position.x = mom.x;
  motherShadow.position.z = mom.z;
  motherShadow.scale.setScalar(1.34);
  childShadow.position.x = kid.x;
  childShadow.position.z = kid.z;
  childShadow.visible = flight === null;

  brood.forEach((duck, index) => {
    const npc = game.brood[index];
    const pose = broodPose(game, index);
    const flight = broodFlight(game, index);
    const gone = npc.phase === "gone";
    duck.object.visible = !gone;
    const chickClimb = flight || npc.phase !== "walk" ? 0 : parkClimb(npc.s, npc.lateral, 0.2);
    duck.object.position.set(pose.x + (flight?.x ?? 0), (flight?.y ?? 0) + chickClimb * 0.26, pose.z);
    duck.object.rotation.set(flight?.spin ?? 0, pose.yaw, flight ? flight.spin * 0.45 : 0);
    const chickSinking = npc.phase === "yeet" && npc.yeetDir === 0;
    duck.update(npc.moved, flight && !chickSinking ? Math.min(1, npc.yeet / 0.72) : 0);
    const shadow = broodShadows[index];
    shadow.visible = npc.phase === "walk";
    shadow.position.x = pose.x;
    shadow.position.z = pose.z;
    shadow.scale.setScalar(duck.object.scale.x);
  });

  carsAt(game.time).forEach((car, index) => {
    const mesh = carMeshes[index];
    mesh.position.set(car.x, 0, car.z);
    mesh.rotation.y = car.dir > 0 ? 0 : Math.PI;
  });

  peopleAt(game.time, game.crowdAt).forEach((person, index) => {
    const view = peopleMeshes[index];
    view.group.visible = person.visible;
    if (!person.visible) return;
    view.group.position.set(person.x, 0, person.z);
    view.group.rotation.y = person.yaw;
    const swing = Math.sin(person.stride) * 0.72;
    view.leftLeg.rotation.x = swing;
    view.rightLeg.rotation.x = -swing;
    for (const material of view.materials) material.opacity = person.fade;
    view.shadow.opacity = 0.16 * person.fade;
  });

  animals.forEach((animal) => {
    animal.object.position.y = Math.sin(game.time * 1.6 + animal.phase) * 0.025;
  });

  stepShotBlend(cameraBlend, game.childS, game.curbUsed, dt);
  const shot = shotFor(game.childS, kid, cameraBlend.road, cameraBlend.s);
  camera.fov = shot.fov;
  camera.updateProjectionMatrix();
  camera.position.set(shot.px, shot.py, shot.pz);
  camera.lookAt(shot.tx, shot.ty, shot.tz);

  place.textContent = placeName(game);
  hint.textContent = game.phase === "play" ? placeHint(game) : "";
  const alive = broodAlive(game);
  broodLabel.textContent = `きょうだい ${alive}`;
  if (alive < heard.alive && game.phase === "play") sound.peep();
  if (game.phase !== heard.phase) {
    if (game.phase === "yeet" || (game.phase === "result" && heard.phase === "play")) {
      if (game.success) sound.clear();
      else sound.fail();
    }
  }
  heard.alive = alive;
  heard.phase = game.phase;
  input.labels();
  const showing = game.phase === "result";
  result.hidden = !showing;
  if (showing) {
    message.textContent = game.message;
    retryButton.textContent = game.success ? "はじめから" : "もう一度";
  }
}

beginButton.addEventListener("click", () => {
  unlockSound();
  sound.tap();
  begin(game);
  resetCamera();
  start.hidden = true;
  result.hidden = true;
});

retryButton.addEventListener("click", () => {
  unlockSound();
  sound.tap();
  retry(game);
  resetCamera();
  result.hidden = true;
});

copyButton.addEventListener("click", async () => {
  sound.tap();
  const where = game.success ? "" : `（${placeName(game)}）`;
  const url = location.origin + location.pathname;
  const text = `お母さんについていく｜${game.message}${where} きょうだい ${broodAlive(game)}/${BROOD_COUNT}
#お母さんについていく
${url}`;
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
  copyButton.textContent = "コピーした";
  window.setTimeout(() => {
    copyButton.textContent = "コピーする";
  }, 900);
});

resize();
window.addEventListener("resize", resize);

let last = performance.now();
function tick(now: number): void {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  if (game.phase === "play" || game.phase === "yeet") update(game, input.read(), dt);
  sync(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

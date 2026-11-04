import * as THREE from "three";
import { goal, nestStart, pointAt, tangentAt } from "../route.ts";
import { Kit, mulberry32, pathStrip, type Env, type StageView } from "./view-kit.ts";
import { makeWater } from "./water.ts";

// ---- 見た目の数値 ----
// 湖の中心（巣から進行方向へ）と半径。岸辺が巣のすぐ先に来る
export const LAKE_ALONG = 7.7;
export const LAKE_RADIUS = 6.6;
// ヤシの木の本数
const PALMS = 16;
// 家族が入るたびに咲く花と蓮の数
const FLOWERS = 170;
const LOTUS = 26;

const home = pointAt(goal);
const forward = tangentAt(goal);

// A spot measured from the nest: along the last stretch of path, and to the side (+ = the same side as lateral).
export function fromHome(along: number, side: number): { x: number; z: number } {
  return {
    x: home.x + forward.x * along + forward.z * side,
    z: home.z + forward.z * along - forward.x * side,
  };
}

function shoreRadius(angle: number): number {
  return LAKE_RADIUS * (1 + 0.05 * Math.sin(angle * 3 + 1) + 0.03 * Math.sin(angle * 7 + 2) - 0.02 * Math.cos(angle * 2));
}

function lakeShape(extra: number): THREE.Shape {
  const shape = new THREE.Shape();
  for (let i = 0; i <= 96; i++) {
    const angle = (i / 96) * Math.PI * 2;
    const r = shoreRadius(angle) + extra;
    if (i === 0) shape.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
    else shape.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
  }
  return shape;
}

export type OasisStage = StageView & {
  water: THREE.ShaderMaterial;
  // 0..1: how much of the shore has burst into flower.
  bloom(amount: number): void;
};

// The way home ends at a real oasis: a broad lake right past the nest, ringed with palms and green.
export function oasisView(base: Env): OasisStage {
  const group = new THREE.Group();
  const center = fromHome(LAKE_ALONG, 0);
  const rand = mulberry32(0x0a515);

  const flat = (shape: THREE.Shape, color: number, y: number) => {
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape, 48), new THREE.MeshLambertMaterial({ color }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(center.x, y, center.z);
    group.add(mesh);
    return mesh;
  };
  const sand = new THREE.Mesh(new THREE.CircleGeometry(95, 40), new THREE.MeshLambertMaterial({ color: 0xe9cf92 }));
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(center.x, 0.014, center.z);
  group.add(sand);
  flat(lakeShape(4.2), 0x96c96f, 0.022);
  flat(lakeShape(2.4), 0x84bf62, 0.026);
  flat(lakeShape(0.55), 0xf0dfae, 0.03);

  group.add(pathStrip(nestStart - 1, goal, 1.2, 0.033, 0xd8bb80));
  // The path opens out into a worn clearing by the nest, down to the water's edge.
  const clearing = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshLambertMaterial({ color: 0xd8bb80 }));
  clearing.rotation.x = -Math.PI / 2;
  clearing.scale.set(2.2, 1.9, 1);
  const clearingAt = fromHome(0.1, 0.3);
  clearing.position.set(clearingAt.x, 0.033, clearingAt.z);
  group.add(clearing);

  const water = makeWater(0x2a93c9, 0x57c9dc);
  const lake = new THREE.Mesh(new THREE.ShapeGeometry(lakeShape(0), 48), water);
  lake.rotation.x = -Math.PI / 2;
  lake.position.set(center.x, 0.05, center.z);
  group.add(lake);
  const foamShape = lakeShape(0.1);
  foamShape.holes.push(new THREE.Path(lakeShape(-0.1).getPoints(96).reverse()));
  const foam = new THREE.Mesh(
    new THREE.ShapeGeometry(foamShape, 48),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false }),
  );
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(center.x, 0.056, center.z);
  group.add(foam);

  const kit = new Kit();
  const onLand = (radius: number, angle: number) => ({
    x: center.x + Math.cos(angle) * radius,
    z: center.z - Math.sin(angle) * radius,
  });
  // Nothing tall stands on the walk in, or between the chick and the water.
  const nearTrail = (x: number, z: number, pad: number) => {
    for (let s = nestStart - 3; s <= goal; s += 0.6) {
      const p = pointAt(s);
      if (Math.hypot(p.x - x, p.z - z) < pad) return true;
    }
    const entry = fromHome(1.2, 0);
    return Math.hypot(entry.x - x, entry.z - z) < pad;
  };

  const palm = (x: number, z: number, height: number, twist: number, lean: number) => {
    const links = 6;
    let px = x;
    let pz = z;
    const lx = Math.cos(twist) * lean;
    const lz = Math.sin(twist) * lean;
    for (let i = 0; i < links; i++) {
      const u = i / links;
      const w = 0.17 - u * 0.08;
      const bend = u * u * 2.2;
      px = x + lx * bend;
      pz = z + lz * bend;
      kit.add("cyl", px, height * (u + 0.5 / links), pz, w, height / links + 0.05, w, i % 2 ? 0x96744a : 0x8a6a42, 0, lz * u * 0.8, -lx * u * 0.8);
    }
    for (let k = 0; k < 9; k++) {
      const turn = (k / 9) * Math.PI * 2 + twist;
      const green = k % 3 === 0 ? 0x5aa648 : k % 3 === 1 ? 0x3f8f45 : 0x4c9c49;
      for (let j = 0; j < 3; j++) {
        const reach = 0.42 + j * 0.62;
        const drop = 0.05 + j * j * 0.17;
        kit.add("box", px + Math.cos(turn) * reach, height + 0.06 - drop, pz - Math.sin(turn) * reach, 0.72, 0.035, 0.34 - j * 0.07, green, turn, 0, -0.25 - j * 0.28);
      }
    }
    for (let k = 0; k < 3; k++) kit.add("ball", px + Math.cos(k * 2.1) * 0.13, height - 0.14, pz + Math.sin(k * 2.1) * 0.13, 0.09, 0.09, 0.09, 0x6a4a2a);
  };
  for (let i = 0; i < PALMS; i++) {
    const angle = (i / PALMS) * Math.PI * 2 + rand() * 0.2;
    const radius = shoreRadius(angle) + 1.3 + rand() * 2.8;
    const at = onLand(radius, angle);
    if (nearTrail(at.x, at.z, 2.3)) continue;
    palm(at.x, at.z, 2.7 + rand() * 1.9, Math.atan2(center.z - at.z, center.x - at.x), 0.28 + rand() * 0.34);
  }

  // Reeds, bushes and stones around the rim, dunes further off.
  for (let i = 0; i < 90; i++) {
    const angle = rand() * Math.PI * 2;
    const at = onLand(shoreRadius(angle) + 0.15 + rand() * 0.3, angle);
    if (nearTrail(at.x, at.z, 1.5)) continue;
    const tall = 0.5 + rand() * 0.5;
    kit.add("cyl", at.x, tall / 2, at.z, 0.018, tall, 0.018, 0x6f9a45, 0, (rand() - 0.5) * 0.25, (rand() - 0.5) * 0.25);
    if (i % 3 === 0) kit.add("cyl", at.x, tall, at.z, 0.03, 0.13, 0.03, 0x7a5230);
  }
  // Short grass all round the lake, so the bank isn't a flat sheet up close.
  for (let i = 0; i < 1400; i++) {
    const angle = rand() * Math.PI * 2;
    const at = onLand(shoreRadius(angle) + 0.75 + rand() * 3.6, angle);
    if (nearTrail(at.x, at.z, 1.35) || Math.hypot(at.x - fromHome(0.1, 0.3).x, at.z - fromHome(0.1, 0.3).z) < 2.2) continue;
    const tall = 0.05 + rand() * 0.06;
    kit.add("cone", at.x, 0.03 + tall / 2, at.z, 0.02, tall, 0.02, [0x6fae4a, 0x7dbb55, 0x5f9f42, 0x8fc768][i % 4], 0, (rand() - 0.5) * 0.5, (rand() - 0.5) * 0.5);
  }
  for (let i = 0; i < 44; i++) {
    const angle = rand() * Math.PI * 2;
    const at = onLand(shoreRadius(angle) + 1 + rand() * 4.4, angle);
    if (nearTrail(at.x, at.z, 1.8)) continue;
    const r = 0.22 + rand() * 0.32;
    kit.add("ball", at.x, r * 0.5, at.z, r * 1.2, r * 0.8, r, i % 2 ? 0x4f9a43 : 0x6bb251);
  }
  for (let i = 0; i < 16; i++) {
    const angle = rand() * Math.PI * 2;
    const at = onLand(shoreRadius(angle) + 0.2 + rand() * 0.6, angle);
    if (nearTrail(at.x, at.z, 1.5)) continue;
    const r = 0.14 + rand() * 0.24;
    kit.add("ball", at.x, r * 0.35, at.z, r * 1.3, r * 0.7, r, i % 2 ? 0xb3a58c : 0x978a76, rand() * 3);
  }
  for (let i = 0; i < 18; i++) {
    const angle = rand() * Math.PI * 2;
    const at = onLand(22 + rand() * 40, angle);
    const wide = 7 + rand() * 11;
    kit.add("ball", at.x, -0.6, at.z, wide, 1.4 + rand() * 2.2, wide * 0.7, 0xe3c787, rand() * 3);
  }
  // Lily pads are there from the start; their flowers wait for the family.
  const pads: { x: number; z: number }[] = [];
  for (let i = 0; i < LOTUS; i++) {
    const angle = rand() * Math.PI * 2;
    const at = onLand(shoreRadius(angle) - 0.45 - rand() * 1.3, angle);
    if (nearTrail(at.x, at.z, 2.1)) continue;
    pads.push(at);
    const r = 0.17 + rand() * 0.1;
    kit.add("cyl", at.x, 0.058, at.z, r, 0.006, r, 0x4f9a43);
  }

  // The nest, tucked beside the end of the path.
  const nest = fromHome(-0.4, 1.75);
  for (let i = 0; i < 26; i++) {
    const ang = (i / 26) * Math.PI * 2;
    const r = 0.46 + (i % 3) * 0.05;
    kit.add("cyl", nest.x + Math.cos(ang) * r, 0.1 + (i % 4) * 0.045, nest.z + Math.sin(ang) * r, 0.03, 0.62, 0.03, i % 2 ? 0x8a5a32 : 0xa8784a, -ang, 0, Math.PI / 2);
  }
  kit.add("cyl", nest.x, 0.05, nest.z, 0.46, 0.06, 0.46, 0xd9c49a);
  kit.add("ball", nest.x, 0.11, nest.z, 0.34, 0.08, 0.34, 0xf7f0de);
  group.add(kit.build());

  // Flowers grow in when the family gets home, each from nothing at its own moment.
  const flowers: { x: number; y: number; z: number; size: number; at: number; lotus: boolean }[] = [];
  for (let i = 0; i < FLOWERS; i++) {
    const angle = rand() * Math.PI * 2;
    const at = onLand(shoreRadius(angle) + 0.7 + rand() * 3.7, angle);
    if (nearTrail(at.x, at.z, 1.25)) continue;
    flowers.push({ x: at.x, y: 0.1 + rand() * 0.07, z: at.z, size: 0.055 + rand() * 0.05, at: rand() * 0.82, lotus: false });
  }
  for (const pad of pads) flowers.push({ x: pad.x, y: 0.1, z: pad.z, size: 0.1, at: rand() * 0.82, lotus: true });
  const petal = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshLambertMaterial(), flowers.length);
  const middle = new THREE.InstancedMesh(new THREE.SphereGeometry(0.42, 6, 5), new THREE.MeshLambertMaterial({ color: 0xffd34d }), flowers.length);
  const hues = [0xff7fa8, 0xffffff, 0xffb347, 0xc48bff, 0xff5f6d, 0xffe066];
  const color = new THREE.Color();
  flowers.forEach((flower, i) => {
    petal.setColorAt(i, color.setHex(flower.lotus ? (i % 2 ? 0xffc0d8 : 0xffffff) : hues[i % hues.length]));
  });
  petal.frustumCulled = false;
  middle.frustumCulled = false;
  group.add(petal, middle);
  const matrix = new THREE.Matrix4();
  const place = new THREE.Vector3();
  const size = new THREE.Vector3();
  const turn = new THREE.Quaternion();
  const bloom = (amount: number) => {
    flowers.forEach((flower, i) => {
      const t = Math.min(1, Math.max(0, (amount - flower.at) / 0.16));
      const pop = t <= 0 ? 0.0001 : t * (1 + Math.sin(t * Math.PI) * 0.5);
      place.set(flower.x, flower.y, flower.z);
      size.set(pop * flower.size, pop * flower.size * 0.62, pop * flower.size);
      matrix.compose(place, turn, size);
      petal.setMatrixAt(i, matrix);
      place.y += flower.size * 0.55 * pop;
      size.setScalar(pop * flower.size);
      matrix.compose(place, turn, size);
      middle.setMatrixAt(i, matrix);
    });
    petal.instanceMatrix.needsUpdate = true;
    middle.instanceMatrix.needsUpdate = true;
  };
  bloom(0);

  return {
    env: {
      ...base,
      sky: 0x6fbdf0,
      fog: 0xf0e6c6,
      near: 20,
      far: 80,
      hemiGround: 0xc8b07a,
      sunColor: 0xfff0d0,
      clouds: true,
      backdrop: "dunes",
    },
    group,
    veil: { color: "#ffffff", before: 1.2, after: 1.6 },
    water,
    bloom,
    update(game) {
      water.uniforms.uTime.value = game.time;
    },
  };
}

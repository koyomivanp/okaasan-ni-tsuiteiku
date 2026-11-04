import * as THREE from "three";
import { Duck } from "../duck.ts";
import { motherPose, type Game } from "../play.ts";
import { desertStart, kingStart, poseAt } from "../route.ts";
import { CACTI, mirageAt, QUICKSANDS, REAL_MOM_SHOW, TRAIL_LOST } from "./desert.ts";
import { put, strip, type StageView } from "./view-kit.ts";

// ---- 見た目の数値 ----
// 遠くに見えるピラミッドの大きさ（底辺の半分・高さ）
const PYRAMID_HALF = 9;
const PYRAMID_HEIGHT = 11;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Sand to the horizon, cacti, sinking sand, and a mirage of mom off to one side.
// mother: the real mom's model, faded while the mirage is showing.
export function desertView(mother: THREE.Object3D): StageView {
  const group = new THREE.Group();
  const rand = mulberry32(0xde5);
  const s0 = desertStart;
  const s1 = kingStart;

  const sand = new THREE.MeshLambertMaterial({ color: 0xe8c98a });
  const trail = new THREE.MeshLambertMaterial({ color: 0xd8b472 });
  strip(group, s0 - 6, s1 + 4, -40, 40, sand, 0.012, 0.01, 3);
  // The real trail is only a slightly darker band; beyond its edges the mirage leads you astray.
  strip(group, s0 - 1, s1 + 1, -TRAIL_LOST + 0.25, TRAIL_LOST - 0.25, trail, 0.02, 0.01, 1);

  const dune = new THREE.SphereGeometry(1, 14, 8);
  for (let i = 0; i < 16; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const mound = put(new THREE.Mesh(dune, sand), s0 - 4 + i * 2.2, side * (6 + rand() * 14), -0.6);
    mound.scale.set(3 + rand() * 4, 1.2 + rand() * 1.4, 3 + rand() * 3);
    group.add(mound);
  }

  const cactusMat = new THREE.MeshLambertMaterial({ color: 0x4f8a3a });
  const trunk = new THREE.CylinderGeometry(1, 1, 1, 8);
  // On the trail they stay below the camera so a passed one never blots out the screen.
  const cactus = (s: number, lateral: number, radius: number, tall = false) => {
    const height = tall ? 0.8 + rand() * 0.6 : 0.42 + rand() * 0.16;
    const body = put(new THREE.Mesh(trunk, cactusMat), s, lateral, height / 2);
    body.scale.set(radius * 0.55, height, radius * 0.55);
    group.add(body);
    for (const side of [-1, 1]) {
      if (rand() < 0.25) continue;
      const armY = height * (0.4 + rand() * 0.25);
      const out = put(new THREE.Mesh(trunk, cactusMat), s, lateral + side * radius * 0.75, armY);
      out.scale.set(radius * 0.32, radius * 0.4, radius * 0.32);
      out.rotation.z = Math.PI / 2;
      const up = put(new THREE.Mesh(trunk, cactusMat), s, lateral + side * radius * 1.05, armY + height * 0.15);
      up.scale.set(radius * 0.32, height * 0.3, radius * 0.32);
      group.add(out, up);
    }
  };
  for (const c of CACTI) cactus(desertStart + c.at, c.lateral, c.radius);
  for (let i = 0; i < 26; i++) cactus(s0 + rand() * (s1 - s0 + 6), (rand() < 0.5 ? -1 : 1) * (2.4 + rand() * 9), 0.2 + rand() * 0.1, true);

  // Sinking sand: a darker swirl that slowly turns.
  const swirlMat = new THREE.MeshLambertMaterial({ color: 0xb8925a });
  const ringMat = new THREE.MeshLambertMaterial({ color: 0xa47e4a });
  const swirls = QUICKSANDS.map((q) => {
    const pit = put(new THREE.Mesh(new THREE.CircleGeometry(q.radius, 24), swirlMat), desertStart + q.at, q.lateral, 0.026);
    pit.rotation.set(-Math.PI / 2, 0, pit.rotation.y);
    const ring = put(new THREE.Mesh(new THREE.RingGeometry(q.radius * 0.35, q.radius * 0.5, 5, 1), ringMat), desertStart + q.at, q.lateral, 0.03);
    ring.rotation.set(-Math.PI / 2, 0, 0);
    group.add(pit, ring);
    return ring;
  });

  // The pyramid on the horizon, its dark doorway at the end of the trail.
  const stone = new THREE.MeshLambertMaterial({ color: 0xd9b46a });
  const pyramid = put(new THREE.Mesh(new THREE.ConeGeometry(PYRAMID_HALF * Math.SQRT2, PYRAMID_HEIGHT, 4), stone), s1 + PYRAMID_HALF, 0, PYRAMID_HEIGHT / 2, Math.PI / 4);
  const door = put(new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.2), new THREE.MeshBasicMaterial({ color: 0x120c06 })), s1 + 0.02, 0, 1.1, Math.PI);
  const lintel = put(new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.35, 0.3), new THREE.MeshLambertMaterial({ color: 0xc4a058 })), s1 - 0.1, 0, 2.35);
  group.add(pyramid, door, lintel);
  // Heat shimmer over the sand ahead.
  const shimmerMat = new THREE.MeshBasicMaterial({ color: 0xfff4d8, transparent: true, opacity: 0.12, depthWrite: false });
  const shimmer = put(new THREE.Mesh(new THREE.PlaneGeometry(30, 0.5), shimmerMat), s0 + 10, 0, 0.3, Math.PI);
  group.add(shimmer);

  // The mirage: a second mom, too bright and wavering, walking off to the side.
  const fake = new Duck("mother");
  const fakeMats: THREE.MeshLambertMaterial[] = [];
  fake.object.traverse((part) => {
    if (part instanceof THREE.Mesh) {
      part.material = (part.material as THREE.MeshLambertMaterial).clone();
      part.material.transparent = true;
      part.material.emissive = new THREE.Color(0x6a5a30);
      fakeMats.push(part.material);
    }
  });
  fake.object.visible = false;
  group.add(fake.object);
  const realMats: THREE.MeshLambertMaterial[] = [];
  mother.traverse((part) => {
    if (part instanceof THREE.Mesh) realMats.push(part.material as THREE.MeshLambertMaterial);
  });
  const fadeReal = (show: number) => {
    for (const mat of realMats) {
      mat.transparent = show < 0.999;
      mat.opacity = show;
    }
  };

  return {
    env: {
      sky: 0xf0dca8,
      fog: 0xf6e6c0,
      near: 14,
      far: 70,
      hemiSky: 0xfff2d8,
      hemiGround: 0xd8b070,
      hemi: 1.2,
      sunColor: 0xfff0c8,
      sun: 1.5,
      lantern: 0,
    },
    group,
    lead: 0,
    veil: { color: "#f4e2b8", before: 1.4, after: 1.6 },
    update(game: Game, dt: number) {
      for (const ring of swirls) ring.rotation.z += dt * 0.8;
      shimmerMat.opacity = 0.08 + Math.sin(game.time * 5) * 0.04;
      const mirage = mirageAt(game.momS);
      fake.object.visible = mirage.strength > 0.02;
      fadeReal(1 - mirage.strength * (1 - REAL_MOM_SHOW));
      if (!fake.object.visible) return;
      const mom = motherPose(game);
      const at = poseAt(game.momS, game.momLateral + mirage.side);
      fake.object.position.set(at.x, Math.sin(game.time * 6) * 0.03, at.z);
      fake.object.rotation.set(0, mom.yaw, 0);
      fake.update(game.momDelta, 0, 0, dt);
      for (const mat of fakeMats) mat.opacity = mirage.strength * (0.8 + Math.sin(game.time * 9) * 0.15);
    },
    leave() {
      fadeReal(1);
    },
  };
}

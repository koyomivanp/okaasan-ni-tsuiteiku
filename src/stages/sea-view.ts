import * as THREE from "three";
import type { Game } from "../play.ts";
import { desertStart, seaStart } from "../route.ts";
import { CURRENTS, JELLIES, jellyLateral, jellyRest, PART_LENGTH, SEA_HALF, seaSchools } from "./sea.ts";
import { put, strip, type StageView } from "./view-kit.ts";

// ---- 見た目の数値 ----
// 海の中の見通し：この距離から青く霞み、この距離で見えなくなる
const FOG_NEAR = 2;
const FOG_FAR = 13;
// 海流の筋の数（1つの海流あたり）
const STREAKS = 26;
// 割れた海の壁の高さ
const PART_WALL = 4;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Under the sea: sand, swaying weed, coral, fish and jellyfish; at the end the water parts.
export function seaView(): StageView {
  const group = new THREE.Group();
  const rand = mulberry32(0x5ea);
  const s0 = seaStart;
  const s1 = desertStart;
  const partAt = s1 - PART_LENGTH;

  const sand = new THREE.MeshLambertMaterial({ color: 0xc9b98a });
  strip(group, s0 - 6, s1 + 6, -30, 30, sand, 0.012, 0.01, 3);

  // Weed swaying along the edges and coral heads in the open.
  const weedMats = [0x2f7a4a, 0x3f9a5a, 0x5a8a2f].map((color) => new THREE.MeshLambertMaterial({ color }));
  const weeds: { mesh: THREE.Mesh; phase: number }[] = [];
  const blade = new THREE.BoxGeometry(0.05, 1, 0.02);
  blade.translate(0, 0.5, 0);
  for (let s = s0 - 2; s < partAt; s += 0.35) {
    for (const side of [-1, 1]) {
      if (rand() < 0.3) continue;
      const height = 0.5 + rand() * 1.1;
      const weed = put(new THREE.Mesh(blade, weedMats[Math.floor(rand() * 3)]), s, side * (SEA_HALF + 0.3 + rand() * 3), 0);
      weed.scale.y = height;
      group.add(weed);
      weeds.push({ mesh: weed, phase: rand() * 6 });
    }
  }
  const coralMats = [0xe8796a, 0xf2a94a, 0xc46ab8, 0xf0d0a0].map((color) => new THREE.MeshLambertMaterial({ color }));
  for (let i = 0; i < 40; i++) {
    const s = s0 + rand() * (partAt - s0);
    const lateral = (rand() < 0.5 ? -1 : 1) * (SEA_HALF + 0.5 + rand() * 6);
    const coral = put(new THREE.Mesh(new THREE.SphereGeometry(0.2 + rand() * 0.3, 8, 6), coralMats[i % 4]), s, lateral, 0.1);
    coral.scale.y = 0.7 + rand() * 0.8;
    group.add(coral);
  }

  // Rising bubbles and slanting light from the surface.
  const bubbleMat = new THREE.MeshBasicMaterial({ color: 0xe8f8ff, transparent: true, opacity: 0.55 });
  const bubbleGeo = new THREE.SphereGeometry(0.035, 6, 4);
  const bubbles: { mesh: THREE.Mesh; base: number; speed: number }[] = [];
  for (let i = 0; i < 40; i++) {
    const mesh = put(new THREE.Mesh(bubbleGeo, bubbleMat), s0 + rand() * (s1 - s0), (rand() * 2 - 1) * 2.4, 0);
    bubbles.push({ mesh, base: rand() * 3, speed: 0.3 + rand() * 0.4 });
    group.add(mesh);
  }
  const rayMat = new THREE.MeshBasicMaterial({
    color: 0xcff0ff,
    transparent: true,
    opacity: 0.08,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  for (let s = s0 + 1; s < partAt; s += 2.6) {
    const ray = put(new THREE.Mesh(new THREE.PlaneGeometry(0.8, 7), rayMat), s, (rand() - 0.5) * 3, 3, rand());
    ray.rotation.z = 0.25;
    group.add(ray);
  }

  // Currents: pale streaks streaming sideways across the path.
  const streakMat = new THREE.MeshBasicMaterial({ color: 0xe0f6ff, transparent: true, opacity: 0.4, depthWrite: false });
  const streakGeo = new THREE.BoxGeometry(0.4, 0.012, 0.012);
  const streaks = CURRENTS.flatMap((current) =>
    Array.from({ length: STREAKS }, () => {
      const mesh = new THREE.Mesh(streakGeo, streakMat);
      group.add(mesh);
      return { mesh, current, along: rand() * current.length, offset: rand() * 4, y: 0.06 + rand() * 0.5 };
    }),
  );

  // The parted sea: two walls of water with a dry sandy road between them.
  const wallMat = new THREE.MeshLambertMaterial({ color: 0x3a9fd0, transparent: true, opacity: 0.85 });
  const crestMat = new THREE.MeshLambertMaterial({ color: 0xdff4ff });
  for (const side of [-1, 1]) {
    strip(group, partAt, s1 + 6, side * 1.7, side * 6, wallMat, 0, PART_WALL, 1);
    strip(group, partAt, s1 + 6, side * 1.7, side * 2, crestMat, PART_WALL, 0.12, 1);
  }
  strip(group, partAt - 0.5, s1 + 6, -1.7, 1.7, new THREE.MeshLambertMaterial({ color: 0xe2c99a }), 0.018, 0.01, 1);

  // Schools of little fish heading straight at the chick.
  const fishMats = [0xf2c14e, 0x6ac0e8, 0xf08a5a].map((color) => new THREE.MeshLambertMaterial({ color }));
  const fishGeo = new THREE.BoxGeometry(0.06, 0.06, 0.16);
  const tailGeo = new THREE.BoxGeometry(0.01, 0.07, 0.06);
  const schools = seaSchools(0).map((_, index) => {
    const school = new THREE.Group();
    for (let k = 0; k < 9; k++) {
      const fish = new THREE.Group();
      const body = new THREE.Mesh(fishGeo, fishMats[index % 3]);
      const tail = new THREE.Mesh(tailGeo, fishMats[index % 3]);
      tail.position.z = -0.1;
      fish.add(body, tail);
      fish.position.set((rand() - 0.5) * 0.55, 0.12 + rand() * 0.4, (rand() - 0.5) * 0.5);
      school.add(fish);
    }
    school.visible = false;
    group.add(school);
    return school;
  });

  // Jellyfish: a soft pink bell trailing threads, bobbing in place.
  const bellMat = new THREE.MeshLambertMaterial({ color: 0xf5a8d8, transparent: true, opacity: 0.75, emissive: 0x6a2a5a });
  const threadMat = new THREE.MeshLambertMaterial({ color: 0xf8c8e8, transparent: true, opacity: 0.6 });
  const jellies = JELLIES.map(() => {
    const jelly = new THREE.Group();
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), bellMat);
    jelly.add(bell);
    for (let k = 0; k < 6; k++) {
      const thread = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.35, 4), threadMat);
      const ang = (k / 6) * Math.PI * 2;
      thread.position.set(Math.cos(ang) * 0.12, -0.17, Math.sin(ang) * 0.12);
      jelly.add(thread);
    }
    group.add(jelly);
    return jelly;
  });

  return {
    env: {
      sky: 0x1f6fa0,
      fog: 0x1f6fa0,
      near: FOG_NEAR,
      far: FOG_FAR,
      hemiSky: 0x9fd8ff,
      hemiGround: 0x1a4a6a,
      hemi: 1.05,
      sunColor: 0xbfe8ff,
      sun: 0.7,
      lantern: 0,
    },
    group,
    veil: { color: "#2f8fc4", before: 1.2, after: 1 },
    update(game: Game) {
      const t = game.time;
      for (const weed of weeds) weed.mesh.rotation.z = Math.sin(t * 1.3 + weed.phase) * 0.22;
      for (const bubble of bubbles) bubble.mesh.position.y = ((t * bubble.speed + bubble.base) % 3) + 0.05;
      for (const streak of streaks) {
        const travel = (((t * Math.abs(streak.current.push) * 1.6 + streak.offset) % 5) - 2.5) * Math.sign(streak.current.push);
        put(streak.mesh, s0 + streak.current.at + streak.along, travel, streak.y);
      }
      seaSchools(t).forEach((school, index) => {
        const view = schools[index];
        view.visible = school.visible;
        if (!school.visible) return;
        view.position.set(school.x, Math.sin(school.swim * 2) * 0.04, school.z);
        view.rotation.set(0, school.yaw, 0);
      });
      JELLIES.forEach((jelly, index) => {
        const rest = jellyRest(index, t);
        const view = put(jellies[index], s0 + jelly.at, jellyLateral(jelly, t), 0.42 + Math.sin(t * 2 + index) * 0.06 + rest * 0.5);
        view.scale.setScalar(1 - rest * 0.35);
        view.scale.y = (1 - rest * 0.35) * (1 + Math.sin(t * 4 + index) * 0.12);
      });
    },
  };
}

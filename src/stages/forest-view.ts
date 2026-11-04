import * as THREE from "three";
import type { Game } from "../play.ts";
import { caveStart, forestStart } from "../route.ts";
import { put, strip, type StageView } from "./view-kit.ts";

// ---- 見た目の数値 ----
// 霧の濃さ：この距離から霞みはじめ、この距離で真っ白になる
const FOG_NEAR = 0.5;
const FOG_FAR = 6.5;
// 道に沿った幹の密度（1 距離あたりの本数・片側）
const TREES_PER_UNIT = 3.2;
// 幹が立ちはじめる横位置（道の中心から）
const TREE_EDGE = 1.35;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A sea of trees: crowded trunks vanishing up into the fog, mossy roots, ferns at chick height.
export function forestView(): StageView {
  const group = new THREE.Group();
  const rand = mulberry32(0x7a1c3);
  const s0 = forestStart;
  const s1 = caveStart;

  const moss = new THREE.MeshLambertMaterial({ color: 0x46613a });
  const trail = new THREE.MeshLambertMaterial({ color: 0x5e5240 });
  strip(group, s0 - 2, s1 + 8, -30, 30, moss, 0.014, 0.01, 2);
  strip(group, s0 - 1, s1 + 1, -0.62, 0.62, trail, 0.026, 0.012, 1);

  const barks = [0x3d3226, 0x4a3d2e, 0x2f2a22].map((color) => new THREE.MeshLambertMaterial({ color }));
  const mossy = new THREE.MeshLambertMaterial({ color: 0x5d7a3e });
  const fern = new THREE.MeshLambertMaterial({ color: 0x3f6a32 });
  const fernLight = new THREE.MeshLambertMaterial({ color: 0x5a8a3c });
  const trunkGeo = new THREE.CylinderGeometry(0.75, 1, 1, 7);
  const rootGeo = new THREE.BoxGeometry(1, 1, 1);
  const fernGeo = new THREE.ConeGeometry(1, 1, 5);

  const tree = (s: number, lateral: number, girth: number) => {
    const height = 5 + rand() * 4;
    const trunk = put(new THREE.Mesh(trunkGeo, barks[Math.floor(rand() * barks.length)]), s, lateral, height / 2);
    trunk.scale.set(girth, height, girth);
    trunk.rotation.z = (rand() - 0.5) * 0.08;
    group.add(trunk);
    // Roots spread like fingers over the moss; far off in the fog nobody sees them.
    const roots = Math.abs(lateral) > 2.6 ? 0 : 2 + Math.floor(rand() * 3);
    for (let i = 0; i < roots; i++) {
      const ang = rand() * Math.PI * 2;
      const root = put(new THREE.Mesh(rootGeo, rand() < 0.5 ? mossy : barks[0]), s, lateral, 0.06);
      root.scale.set(girth * 0.5, 0.12, girth * 2.6);
      root.rotation.y = ang;
      root.position.x += Math.sin(ang) * girth * 1.1;
      root.position.z += Math.cos(ang) * girth * 1.1;
      group.add(root);
    }
  };

  for (let s = s0 - 1.5; s < s1 + 7; s += 1 / TREES_PER_UNIT) {
    for (const side of [-1, 1]) {
      const near = rand() < 0.45;
      const lateral = side * (near ? TREE_EDGE + rand() * 0.9 : TREE_EDGE + 0.9 + rand() * 9);
      tree(s + (rand() - 0.5) * 0.3, lateral, near ? 0.14 + rand() * 0.12 : 0.16 + rand() * 0.3);
    }
  }

  // Ferns along the trail edge, about as tall as the chicks.
  for (let s = s0; s < s1 + 2; s += 0.42) {
    for (const side of [-1, 1]) {
      if (rand() < 0.3) continue;
      const lateral = side * (0.75 + rand() * 0.55);
      const size = 0.18 + rand() * 0.16;
      const leaf = put(new THREE.Mesh(fernGeo, rand() < 0.5 ? fern : fernLight), s + rand() * 0.3, lateral, size * 0.5);
      leaf.scale.set(size, size * 1.4, size);
      group.add(leaf);
    }
  }

  // Pale shafts of daylight slanting through the fog.
  const shaftMat = new THREE.MeshBasicMaterial({
    color: 0xf4f6ef,
    transparent: true,
    opacity: 0.1,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const shafts: THREE.Mesh[] = [];
  for (let s = s0 + 2; s < s1; s += 3.6) {
    const shaft = put(new THREE.Mesh(new THREE.PlaneGeometry(0.7, 9), shaftMat), s, (rand() - 0.5) * 2.4, 4, rand() * 0.6);
    shaft.rotation.z = 0.32;
    group.add(shaft);
    shafts.push(shaft);
  }

  return {
    env: {
      sky: 0xbcc6c0,
      fog: 0xbcc6c0,
      near: FOG_NEAR,
      far: FOG_FAR,
      hemiSky: 0xcfd9d3,
      hemiGround: 0x34442c,
      hemi: 0.95,
      sunColor: 0xf2f0e2,
      sun: 0.3,
      lantern: 0,
    },
    group,
    lead: 3,
    veil: { color: "#bcc6c0", before: 2.5, after: 2 },
    update(game: Game) {
      shaftMat.opacity = 0.08 + Math.sin(game.time * 0.7) * 0.03;
    },
  };
}

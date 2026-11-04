import * as THREE from "three";
import type { Game } from "../play.ts";
import { poseAt } from "../route.ts";

// Sky, fog and light for one world. Applied whole when the lead chick crosses into that world.
export type Env = {
  sky: number;
  fog: number;
  near: number;
  far: number;
  hemiSky: number;
  hemiGround: number;
  hemi: number;
  sunColor: number;
  sun: number;
  // A warm glow carried along with the lead chick (0 = off).
  lantern: number;
  // Open-air worlds: drifting clouds, and what stands on the far horizon.
  clouds?: boolean;
  backdrop?: "town" | "dunes";
};

export type StageView = {
  env: Env;
  group: THREE.Group;
  // Show the scenery this far before the stage starts (a cave mouth seen from outside).
  lead?: number;
  // A wash of colour over the seam into this stage: how far it builds before the line and fades after.
  veil?: { color: string; before: number; after: number };
  update?(game: Game, dt: number): void;
  // Undo anything done to shared objects (mom's look) once the stage is left behind.
  leave?(): void;
};

// Flat boxes laid end to end along the path, so a floor follows any bend.
export function strip(
  group: THREE.Group,
  s0: number,
  s1: number,
  lateral0: number,
  lateral1: number,
  material: THREE.Material,
  y = 0.02,
  height = 0.02,
  step = 2,
): void {
  const mid = (lateral0 + lateral1) / 2;
  const wide = Math.abs(lateral1 - lateral0);
  for (let s = s0; s < s1 - 1e-3; s += step) {
    const e = Math.min(s1, s + step);
    const a = poseAt(s, mid);
    const b = poseAt(e, mid);
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(wide, height, length + 0.06), material);
    mesh.position.set((a.x + b.x) / 2, y + height / 2, (a.z + b.z) / 2);
    mesh.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
    group.add(mesh);
  }
}

// Place an object at a path spot, facing along the path.
export function put<T extends THREE.Object3D>(object: T, s: number, lateral: number, y = 0, turn = 0): T {
  const pose = poseAt(s, lateral);
  object.position.set(pose.x, y, pose.z);
  object.rotation.y = pose.yaw + turn;
  return object;
}

type KitShape = "box" | "ball" | "cone" | "cyl" | "roof";
const KIT_SHAPES: Record<KitShape, THREE.BufferGeometry> = {
  box: new THREE.BoxGeometry(1, 1, 1),
  ball: new THREE.SphereGeometry(1, 10, 7),
  cone: new THREE.ConeGeometry(1, 1, 8),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 8),
  roof: new THREE.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4),
};

// Lots of small still things drawn as a handful of instanced meshes, so scenery stays cheap on a phone.
export class Kit {
  private readonly items = new Map<KitShape, { matrix: THREE.Matrix4; color: THREE.Color }[]>();
  private readonly map?: THREE.Texture;

  constructor(map?: THREE.Texture) {
    this.map = map;
  }

  add(
    shape: KitShape,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    color: number,
    ry = 0,
    rx = 0,
    rz = 0,
  ): void {
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, "YXZ")),
      new THREE.Vector3(sx, sy, sz),
    );
    if (!this.items.has(shape)) this.items.set(shape, []);
    this.items.get(shape)!.push({ matrix, color: new THREE.Color(color) });
  }

  build(): THREE.Group {
    const group = new THREE.Group();
    const material = new THREE.MeshLambertMaterial({ map: this.map ?? null });
    for (const [shape, list] of this.items) {
      const mesh = new THREE.InstancedMesh(KIT_SHAPES[shape], material, list.length);
      list.forEach((item, i) => {
        mesh.setMatrixAt(i, item.matrix);
        mesh.setColorAt(i, item.color);
      });
      mesh.frustumCulled = false;
      group.add(mesh);
    }
    return group;
  }
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A dirt path as one smooth strip that follows the route, its edges wandering a little.
export function pathStrip(s0: number, s1: number, half: number, y: number, color: number): THREE.Mesh {
  const points: number[] = [];
  const index: number[] = [];
  let rows = 0;
  for (let s = s0; s <= s1; s += 0.3) {
    const wobble = Math.sin(s * 1.7) * 0.07 + Math.sin(s * 0.63 + 1) * 0.1;
    const a = poseAt(s, -half + wobble);
    const b = poseAt(s, half + wobble);
    points.push(a.x, y, a.z, b.x, y, b.z);
    if (rows > 0) {
      const k = rows * 2;
      index.push(k - 2, k, k - 1, k - 1, k, k + 1);
    }
    rows++;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }));
}

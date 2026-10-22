import * as THREE from "three";
import type { VehicleKind } from "./play.ts";

export function makeVehicle(kind: VehicleKind, color: number): THREE.Group {
  const paint = new THREE.MeshLambertMaterial({ color });
  const glass = new THREE.MeshLambertMaterial({ color: 0xc5dbe6 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x23262c });
  const lamp = new THREE.MeshLambertMaterial({
    color: 0xfff6d8,
    emissive: 0xfff1c4,
    emissiveIntensity: 0.9,
  });
  const group = new THREE.Group();
  const add = (w: number, h: number, d: number, material: THREE.Material, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    group.add(mesh);
  };

  if (kind === "suv") {
    add(1.9, 0.48, 0.92, paint, 0, 0.4, 0);
    add(0.95, 0.38, 0.84, glass, 0.08, 0.74, 0);
    add(0.08, 0.1, 0.7, lamp, 0.94, 0.42, 0);
  } else if (kind === "van") {
    add(2.35, 0.72, 0.96, paint, 0, 0.52, 0);
    add(0.7, 0.32, 0.86, glass, 0.72, 0.78, 0);
    add(0.08, 0.1, 0.72, lamp, 1.16, 0.46, 0);
  } else if (kind === "bus") {
    add(4.5, 1.05, 1.16, paint, 0, 0.72, 0);
    add(3.3, 0.32, 1.02, glass, 0.15, 1.05, 0);
    add(0.1, 0.14, 0.9, lamp, 2.22, 0.55, 0);
  } else if (kind === "truck") {
    add(1.15, 0.85, 1.05, paint, 1.05, 0.62, 0);
    add(0.55, 0.38, 0.92, glass, 1.15, 0.95, 0);
    add(2.5, 1.15, 1.12, dark, -0.85, 0.78, 0);
    add(0.08, 0.12, 0.8, lamp, 1.6, 0.48, 0);
  } else {
    add(1.8, 0.36, 0.8, paint, 0, 0.3, 0);
    add(0.72, 0.26, 0.7, glass, 0.12, 0.54, 0);
    add(0.08, 0.08, 0.58, lamp, 0.88, 0.32, 0);
  }

  return group;
}

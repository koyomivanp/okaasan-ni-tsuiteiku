import * as THREE from "three";

export type DuckKind = "child" | "mother";

export type DuckOptions = {
  bodyColor?: number;
  ribbon?: boolean;
  scale?: number;
  gait?: number;
};

export class Duck {
  readonly object = new THREE.Group();
  private readonly rig = new THREE.Group();
  private readonly head = new THREE.Group();
  private readonly leftFoot = new THREE.Group();
  private readonly rightFoot = new THREE.Group();
  private readonly feathers: THREE.Mesh[] = [];
  private walked = 0;
  private readonly stepLength: number;
  private readonly rollAmp: number;
  private readonly lift: number;
  private readonly bob: number;
  private readonly nod: number;
  private readonly stride: number;
  private glance = 0;

  constructor(kind: DuckKind, options: DuckOptions = {}) {
    const mother = kind === "mother";
    this.stepLength = mother ? 0.34 : 0.48;
    this.rollAmp = mother ? 0.2 : 0.045;
    this.lift = mother ? 0.065 : 0.022;
    this.bob = mother ? 0.02 : 0.005;
    this.nod = mother ? 0.04 : 0.01;
    this.stride = this.stepLength * (mother ? 0.5 : 0.2);
    this.walked = options.gait ?? 0;
    const bodyColor = options.bodyColor ?? (mother ? 0xfffdf8 : 0xf2c14e);
    const scale = (mother ? 1.34 : 1) * (options.scale ?? 1);

    const bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor });
    const beakMat = new THREE.MeshLambertMaterial({ color: 0xe36a12 });
    const footMat = new THREE.MeshLambertMaterial({ color: 0xe07a22 });
    const eyeMat = new THREE.MeshLambertMaterial({ color: 0x1d2430 });

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 18, 14), bodyMat);
    body.scale.set(0.96, 0.78, 1.32);
    body.position.y = 0.24;
    this.rig.add(body);

    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 8), bodyMat);
    tail.rotation.x = Math.PI / 2.4;
    tail.position.set(0, 0.32, -0.26);
    this.rig.add(tail);

    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), bodyMat);
    this.head.add(skull);

    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.16, 8), beakMat);
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 0, 0.2);
    this.head.add(beak);

    const eyeGeo = new THREE.SphereGeometry(0.016, 10, 8);
    const socket = (x: number) => {
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      const dir = new THREE.Vector3(x, 0.2, 1).normalize();
      eye.position.copy(dir).multiplyScalar(0.14 - 0.006);
      eye.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
      eye.scale.set(1, 0.86, 0.58);
      return eye;
    };
    skull.add(socket(-0.32), socket(0.32));

    this.head.position.set(0, 0.385, 0.19);
    this.rig.add(this.head);

    const footGeo = new THREE.BoxGeometry(0.1, 0.025, 0.16);
    const left = new THREE.Mesh(footGeo, footMat);
    const right = new THREE.Mesh(footGeo, footMat);
    left.position.z = 0.02;
    right.position.z = 0.02;
    this.leftFoot.add(left);
    this.rightFoot.add(right);
    this.leftFoot.position.set(-0.09, 0.03, 0.02);
    this.rightFoot.position.set(0.09, 0.03, 0.02);

    const featherGeo = new THREE.BoxGeometry(0.05, 0.02, 0.09);
    for (let i = 0; i < 5; i++) {
      const feather = new THREE.Mesh(featherGeo, bodyMat);
      feather.visible = false;
      this.feathers.push(feather);
      this.object.add(feather);
    }

    if (options.ribbon) {
      const ribbonMat = new THREE.MeshLambertMaterial({ color: 0xd24b4b });
      const bow = new THREE.Group();
      const lobeGeo = new THREE.SphereGeometry(0.042, 8, 6);
      const leftLobe = new THREE.Mesh(lobeGeo, ribbonMat);
      const rightLobe = new THREE.Mesh(lobeGeo, ribbonMat);
      leftLobe.scale.set(0.85, 0.7, 1.2);
      rightLobe.scale.set(0.85, 0.7, 1.2);
      leftLobe.position.set(-0.034, 0.02, -0.01);
      rightLobe.position.set(0.034, 0.02, -0.01);
      const tailGeo = new THREE.BoxGeometry(0.018, 0.07, 0.014);
      const leftTail = new THREE.Mesh(tailGeo, ribbonMat);
      const rightTail = new THREE.Mesh(tailGeo, ribbonMat);
      leftTail.position.set(-0.018, -0.045, 0.01);
      rightTail.position.set(0.018, -0.045, 0.01);
      leftTail.rotation.z = 0.45;
      rightTail.rotation.z = -0.45;
      const knot = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), ribbonMat);
      knot.position.set(0, 0.01, 0.01);
      bow.add(leftLobe, rightLobe, leftTail, rightTail, knot);
      bow.position.set(0, 0.1, -0.1);
      this.head.add(bow);
    }

    this.object.add(this.rig, this.leftFoot, this.rightFoot);
    this.object.scale.setScalar(scale);
  }

  update(distanceDelta: number, flight: number, glance = 0, dt = 1 / 60): void {
    const scale = this.object.scale.x || 1;
    const moving = Math.abs(distanceDelta) > 0.0004 && flight <= 0;
    if (moving) this.walked += distanceDelta / scale;

    const phase = ((this.walked / this.stepLength) % 1 + 1) % 1;
    const stride = this.stride;
    this.rig.rotation.z = moving ? Math.sin(phase * Math.PI * 2) * this.rollAmp : 0;
    this.rig.position.y = moving ? Math.abs(Math.sin(phase * Math.PI * 2)) * this.bob : 0;

    this.head.rotation.z = -this.rig.rotation.z;
    this.head.rotation.x = moving ? Math.sin(phase * Math.PI * 2) * this.nod : 0;
    const turn = 1 - Math.exp(-Math.max(0, dt) / 0.14);
    this.glance += (glance - this.glance) * turn;
    this.head.rotation.y = this.glance * 2.35;

    if (!moving) {
      this.leftFoot.position.set(-0.09, 0.03, 0.02);
      this.rightFoot.position.set(0.09, 0.03, 0.02);
      this.leftFoot.children[0].position.y = 0;
      this.rightFoot.children[0].position.y = 0;
    } else if (phase < 0.5) {
      const u = phase / 0.5;
      this.placeFoot(this.leftFoot, -0.09, stride * 0.5 - u * stride, 0);
      this.placeFoot(this.rightFoot, 0.09, -stride * 0.5 + u * stride, Math.sin(u * Math.PI) * this.lift);
    } else {
      const u = (phase - 0.5) / 0.5;
      this.placeFoot(this.rightFoot, 0.09, stride * 0.5 - u * stride, 0);
      this.placeFoot(this.leftFoot, -0.09, -stride * 0.5 + u * stride, Math.sin(u * Math.PI) * this.lift);
    }

    const flung = flight > 0;
    this.feathers.forEach((feather, i) => {
      feather.visible = flung;
      if (!flung) return;
      const ang = i * 1.25 + flight * 6;
      const radius = 0.15 + flight * 0.85;
      feather.position.set(Math.cos(ang) * radius, 0.35 + Math.sin(flight * Math.PI) * 0.4, Math.sin(ang) * radius);
      feather.rotation.z = ang;
    });
  }

  private placeFoot(foot: THREE.Group, x: number, z: number, y: number): void {
    foot.position.set(x, 0.03, 0.02 + z);
    foot.children[0].position.y = y;
  }
}

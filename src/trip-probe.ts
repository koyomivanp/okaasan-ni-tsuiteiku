import { begin, broodAlive, carsAt, childPose, createGame, hitsCar, motherPose, peopleAt, update } from "./play.ts";
import { clearLateral, goal, parkGuideMax, parkGuideMin, poseAt, segmentAt } from "./route.ts";

function inLane(s: number): boolean {
  const pose = poseAt(s, 0);
  for (const car of carsAt(0)) {
    if (Math.abs(car.z - pose.z) <= car.width * 0.5 + 0.2) return true;
  }
  return false;
}

function carBlocked(s: number, time: number): boolean {
  for (const aheadS of [0, 0.45, 0.9]) {
    const pose = poseAt(s + aheadS, 0);
    for (const car of carsAt(time)) {
      if (Math.abs(car.z - pose.z) > car.width * 0.5 + 0.32) continue;
      const ahead = (pose.x - car.x) * car.dir;
      const reach = car.length * 0.5 + 0.45;
      if (ahead < -reach) continue;
      const eta = ahead <= reach ? 0 : ahead / car.speed;
      if (eta < 1.15) return true;
    }
  }
  return false;
}

function dodgePeople(
  lateral: number,
  x: number,
  z: number,
  time: number,
  crowdAt: number,
): { left: boolean; right: boolean } {
  let steer = 0;
  for (const person of peopleAt(time, crowdAt)) {
    if (!person.visible) continue;
    const ahead = person.x - x;
    if (ahead < -0.25 || ahead > 2.6) continue;
    if (Math.abs(person.z - z) > 0.55) continue;
    steer = person.z >= z ? 1 : -1;
    break;
  }
  if (steer === 0) {
    if (Math.abs(lateral) < 0.2) return { left: true, right: false };
    return { left: lateral < -0.05, right: lateral > 0.05 };
  }
  return { left: steer > 0, right: steer < 0 };
}

const game = createGame();
begin(game);
let momHit = false;
const stops: number[] = [];
let waiting = false;
let prev = game.momS;
for (let i = 0; i < 28000 && game.phase === "play"; i++) {
  const seg = segmentAt(game.childS).id;
  const gap = game.momS - game.childS;
  const crossing = seg === "road";
  const kid = childPose(game);
  const parkAim = clearLateral(game.childS + 0.85, game.lateral, 0.24, parkGuideMin, parkGuideMax);
  const dodge =
    seg === "crowd"
      ? dodgePeople(game.lateral, kid.x, kid.z, game.time, game.crowdAt)
      : seg === "park"
        ? { left: parkAim > game.lateral + 0.06, right: parkAim < game.lateral - 0.06 }
        : { left: game.lateral < -0.08, right: game.lateral > 0.08 };
  const blocked = crossing && carBlocked(game.childS, game.time);
  const commit = crossing && game.roadSpeed > 0.35 && inLane(game.childS);
  const go = crossing && (commit || (!blocked && gap > 0.45));
  const tap = crossing && waiting && !go && i % 30 === 0;
  update(
    game,
    {
      left: crossing ? false : dodge.left,
      right: crossing ? false : dodge.right,
      forward: go || tap,
      back: crossing && !go && !tap,
    },
    1 / 60,
  );
  const moved = game.momS - prev;
  if (moved < 0.00002 && game.phase === "play") {
    if (!waiting) stops.push(Number(game.momS.toFixed(2)));
    waiting = true;
  } else waiting = false;
  prev = game.momS;
  const mom = motherPose(game);
  for (const car of carsAt(game.time)) {
    if (hitsCar(mom, car)) momHit = true;
  }
}

console.log(
  JSON.stringify(
    {
      phase: game.phase,
      outcome: game.outcome,
      message: game.message,
      momS: Number(game.momS.toFixed(2)),
      childS: Number(game.childS.toFixed(2)),
      lateral: Number(game.lateral.toFixed(2)),
      time: Number(game.time.toFixed(1)),
      alive: broodAlive(game),
      momHit,
      stops: stops.slice(0, 12),
      goal: Number(goal.toFixed(2)),
    },
    null,
    2,
  ),
);

import {
  begin,
  bikesAt,
  broodAlive,
  carsAt,
  createGame,
  guideLateral,
  hitsCar,
  MOM_SPEED,
  motherPose,
  peopleAt,
  update,
} from "./play.ts";
import { clearLateral, goal, parkGuideMax, parkGuideMin, poseAt, segmentAt } from "./route.ts";
import { stageOf } from "./stages/index.ts";

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

// Between two lanes is clear of both, so those spots count too.
const CROWD_POCKETS = [-1.05, -0.78, -0.39, 0, 0.39, 0.78, 1.05];
const CROWD_WALK = 1.9;
const CROWD_STEER = 5.2;

// Mom's crowd pick ignores what is in the lanes on the way; the bot also refuses a move that would
// cross a lane just as someone arrives in it.
function crowdAim(s: number, lateral: number, time: number, crowdAt: number): number {
  const bodies = [
    ...peopleAt(time, crowdAt)
      .filter((p) => p.visible && p.fade > 0.3)
      .map((p) => ({ s: p.s, lateral: p.lateral, speed: CROWD_WALK })),
    ...bikesAt(time, crowdAt).filter((b) => b.visible),
  ];
  let best = lateral;
  let bestScore = -Infinity;
  for (const pocket of CROWD_POCKETS) {
    const lo = Math.min(pocket, lateral) - 0.3;
    const hi = Math.max(pocket, lateral) + 0.3;
    const travel = Math.abs(pocket - lateral) / CROWD_STEER + 0.32;
    let score = -Math.abs(pocket - lateral) * 0.8;
    for (const body of bodies) {
      const ahead = body.s - s;
      if (ahead < -0.45) continue;
      const arrive = Math.max(0, ahead) / (body.speed + MOM_SPEED);
      if (body.lateral > lo && body.lateral < hi && arrive < travel) score -= 120;
      if (Math.abs(body.lateral - pocket) < 0.3 && arrive < 2) score -= 60 * (1 - arrive / 2);
    }
    if (score > bestScore) {
      bestScore = score;
      best = pocket;
    }
  }
  return best;
}

const game = createGame();
begin(game);
let momHit = false;
const stops: number[] = [];
let waiting = false;
let prev = game.momS;
for (let i = 0; i < 60000 && game.phase === "play"; i++) {
  const seg = segmentAt(game.childS).id;
  const gap = game.momS - game.childS;
  const crossing = seg === "road";
  const parkAim = clearLateral(game.childS + 0.85, game.lateral, 0.24, parkGuideMin, parkGuideMax);
  const aim =
    seg === "crowd"
      ? crowdAim(game.childS, game.lateral, game.time, game.crowdAt)
      : guideLateral(game.childS, game.lateral, game.time, game.crowdAt);
  // Aim just past where the brake will stop the chick (half the brake time at the current speed).
  const ahead = game.lateral + game.lateralVel * 0.085;
  const dodge =
    seg === "park"
      ? { left: parkAim > ahead + 0.06, right: parkAim < ahead - 0.06 }
      : seg === "walk"
        ? { left: aim > ahead + 0.04, right: aim < ahead - 0.04 }
        : seg === "crowd" || stageOf(seg)
        ? { left: aim > ahead + 0.04, right: aim < ahead - 0.04 }
        : { left: ahead < -0.08, right: ahead > 0.08 };
  const blocked = crossing && carBlocked(game.childS, game.time);
  const commit = crossing && game.roadSpeed > 0.35 && inLane(game.childS);
  const go = crossing && (commit || (!blocked && gap > 0.45));
  const tap = crossing && waiting && !go && i % 30 === 0;
  // Go/stop stages: dash whenever mom's rule says it is safe, otherwise wait.
  const holdHere = stageOf(seg)?.hold;
  const wait = holdHere ? holdHere(game.childS, game.time) : false;
  update(
    game,
    {
      left: crossing ? false : dodge.left,
      right: crossing ? false : dodge.right,
      forward: holdHere ? !wait : go || tap,
      back: holdHere ? wait : crossing && !go && !tap,
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

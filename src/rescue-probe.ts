import { begin, broodAlive, broodNearby, broodWaiting, createGame, update } from "./play.ts";
import { inLake, lostChicks, parkBlocked, poseAt, segmentAt } from "./route.ts";

const idle = { left: false, right: false, forward: false, back: false };

// Stray spots are scattered per run, so read the first one from each game.
function firstStray(game: ReturnType<typeof createGame>): { s: number; lateral: number } {
  const strays = game.brood.filter((kid) => kid.stray).sort((a, b) => a.s - b.s);
  return { s: strays[0].s, lateral: strays[0].lateral };
}

function tick(game: ReturnType<typeof createGame>, n = 1, input = idle): void {
  for (let i = 0; i < n; i++) update(game, input, 1 / 60);
}

for (const spot of createGame().brood.filter((kid) => kid.stray)) {
  const pose = poseAt(spot.s, spot.lateral);
  if (inLake(pose.x, pose.z)) throw new Error(`lost chick in lake at ${spot.s}`);
  if (segmentAt(spot.s).id === "park" && parkBlocked(spot.s, spot.lateral, 0.24)) {
    throw new Error(`lost chick inside a rock at ${spot.s}`);
  }
}

const pick = createGame();
begin(pick);
let first = firstStray(pick);
if (broodWaiting(pick) !== lostChicks.length) {
  throw new Error(`expected ${lostChicks.length} waiting, got ${broodWaiting(pick)}`);
}
pick.childS = first.s;
pick.lateral = first.lateral;
pick.momS = first.s + 1.4;
for (const kid of pick.brood) {
  if (kid.phase !== "walk") continue;
  kid.s = first.s - 0.35;
  kid.lateral = 0;
}
tick(pick, 4);
if (broodAlive(pick) !== 10) {
  throw new Error(`expected rescue to 10, got ${broodAlive(pick)} nearby=${broodNearby(pick)}`);
}
const saved = pick.brood.find((kid) => kid.stray && kid.phase === "walk");
if (!saved) {
  throw new Error("rescued stray did not join the walk");
}
if (saved.s > pick.childS - 0.05) {
  throw new Error(`rescued stray should trail the player, s=${saved.s.toFixed(2)} child=${pick.childS.toFixed(2)}`);
}

const miss = createGame();
begin(miss);
first = firstStray(miss);
miss.childS = first.s + 2.2;
miss.lateral = 0;
miss.momS = first.s + 3.4;
for (const kid of miss.brood) {
  if (kid.phase !== "walk") continue;
  kid.s = first.s + 1.6;
  kid.lateral = 0;
}
tick(miss, 3);
const leftover = miss.brood.find((kid) => kid.stray && Math.abs(kid.s - first.s) < 0.2);
if (!leftover || leftover.phase !== "gone") {
  throw new Error(`expected passed stray gone, got ${leftover?.phase ?? "missing"}`);
}
if (broodAlive(miss) !== 9) {
  throw new Error(`missing a stray should keep 9, got ${broodAlive(miss)}`);
}

const steer = createGame();
begin(steer);
first = firstStray(steer);
steer.childS = first.s - 2.4;
steer.lateral = 0;
steer.momS = first.s + 0.7;
for (const kid of steer.brood) {
  if (kid.phase !== "walk") continue;
  kid.s = first.s - 0.5;
  kid.lateral = 0;
}
const goLeft = first.lateral > 0;
for (let i = 0; i < 120 && broodAlive(steer) < 10 && steer.phase === "play"; i++) {
  const aim = first.lateral - steer.lateral;
  tick(steer, 1, { left: goLeft && aim > 0.05, right: !goLeft && aim < -0.05, forward: false, back: false });
}
if (broodAlive(steer) !== 10 || steer.phase !== "play") {
  throw new Error(`steer-in rescue failed s=${first.s.toFixed(2)} wantLat=${first.lateral.toFixed(2)} childS=${steer.childS.toFixed(2)} alive=${broodAlive(steer)} phase=${steer.phase} lat=${steer.lateral.toFixed(2)}`);
}

const line = createGame();
begin(line);
tick(line, 200);
const walking = line.brood.filter((kid) => kid.phase === "walk").sort((a, b) => b.s - a.s);
if (walking.length < 8) throw new Error(`expected a following line, got ${walking.length}`);
const behindPlayer = line.childS - walking[0].s;
if (behindPlayer < 0.38) {
  throw new Error(`lead follower overlapping player, gap=${behindPlayer.toFixed(3)}`);
}
for (let i = 1; i < walking.length; i++) {
  const gap = walking[i - 1].s - walking[i].s;
  if (gap < 0.38) {
    throw new Error(`followers overlapping at ${i}: gap=${gap.toFixed(3)}`);
  }
}

console.log(
  JSON.stringify({
    rescued: broodAlive(pick),
    missed: broodAlive(miss),
    steered: broodAlive(steer),
    waitingAtStart: lostChicks.length,
    lineLeadGap: Number(behindPlayer.toFixed(2)),
    lineMinGap: Number(
      Math.min(...walking.slice(1).map((kid, i) => walking[i].s - kid.s)).toFixed(2),
    ),
    ok: true,
  }),
);

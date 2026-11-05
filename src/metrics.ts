// Anonymous play counts for GoatCounter: no cookies, and nothing about the player beyond the event name.
const COUNT_URL = "https://koyomivanp.goatcounter.com/count";

let enabled = !import.meta.env.DEV;

// The developer stage select skips the course, so those runs must not count as play.
export function stopTracking(): void {
  enabled = false;
}

export function track(event: string): void {
  if (!enabled) return;
  const query = new URLSearchParams({ p: event, e: "true", r: document.referrer, rnd: String(Math.random()) });
  navigator.sendBeacon(`${COUNT_URL}?${query}`);
}

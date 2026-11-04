import type { FrameInput } from "./play.ts";

export type ControlMode = "lateral" | "longitudinal";

export function bindInput(
  buttonA: HTMLButtonElement,
  buttonB: HTMLButtonElement,
  mode: () => ControlMode,
  roadFlip: () => number = () => 0,
) {
  const held = { a: false, b: false };
  const keys = new Set<string>();

  const bindButton = (button: HTMLButtonElement, which: "a" | "b") => {
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      held[which] = true;
    });
    const release = () => {
      held[which] = false;
    };
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("contextmenu", (event) => event.preventDefault());
  };

  bindButton(buttonA, "a");
  bindButton(buttonB, "b");

  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) event.preventDefault();
    keys.add(key);
  });
  window.addEventListener("keyup", (event) => {
    keys.delete(event.key.toLowerCase());
  });

  const down = (name: string) => keys.has(name);

  return {
    labels(): void {
      buttonA.dataset.dir = "left";
      buttonB.dataset.dir = "right";
      buttonA.setAttribute("aria-label", "左");
      buttonB.setAttribute("aria-label", "右");
    },
    read(): FrameInput {
      const left = held.a || down("arrowleft");
      const right = held.b || down("arrowright");
      if (mode() !== "longitudinal") {
        return { left, right, forward: false, back: false };
      }
      const screenRightIsForward = roadFlip() < 0.5;
      return {
        left: false,
        right: false,
        forward: screenRightIsForward ? right : left,
        back: screenRightIsForward ? left : right,
      };
    },
  };
}

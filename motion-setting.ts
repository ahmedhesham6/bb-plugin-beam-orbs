export const SETTING_KEY = "animateWithReducedMotion";
export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

type Listener = (animate: boolean) => void;

let animate = false;
const listeners = new Set<Listener>();

export const motionSetting = {
  get(): boolean {
    return animate;
  },
  set(next: boolean): void {
    if (next === animate) return;
    animate = next;
    for (const listener of [...listeners]) listener(animate);
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function withMotionAllowed<T>(run: () => T): T {
  const real = window.matchMedia;
  window.matchMedia = (query: string) =>
    real.call(window, query === REDUCED_MOTION_QUERY ? "not all" : query);
  try {
    return run();
  } finally {
    window.matchMedia = real;
  }
}

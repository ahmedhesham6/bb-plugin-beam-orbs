// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  loadPluginApp,
  mountPluginContentScripts,
  renderSlot,
  type MountedPluginContentScripts,
} from "@get-bb/plugin-sdk/testing/app";
import { motionSetting, REDUCED_MOTION_QUERY } from "./motion-setting";

const noop = () => {};
const context = new Proxy({}, { get: () => noop });
HTMLCanvasElement.prototype.getContext = (() =>
  context) as unknown as HTMLCanvasElement["getContext"];

for (const name of ["scale", "dx", "dy"]) {
  if (!(name in SVGElement.prototype)) {
    Object.defineProperty(SVGElement.prototype, name, {
      configurable: true,
      get: () => ({ baseVal: 0 }),
    });
  }
}

let reduced = true;
const asked: string[] = [];
function fakeMatchMedia(query: string): MediaQueryList {
  asked.push(query);
  return {
    matches: query === REDUCED_MOTION_QUERY && reduced,
    media: query,
    onchange: null,
    addEventListener: noop,
    removeEventListener: noop,
    addListener: noop,
    removeListener: noop,
    dispatchEvent: () => false,
  };
}
window.matchMedia = fakeMatchMedia;

const watched = new Set<Element>();
class FakeIntersectionObserver {
  private readonly targets = new Set<Element>();
  constructor(private readonly callback: IntersectionObserverCallback) {}
  observe(target: Element) {
    watched.add(target);
    this.targets.add(target);
    this.callback(
      [{ isIntersecting: true, target } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
  unobserve(target: Element) {
    watched.delete(target);
    this.targets.delete(target);
  }
  disconnect() {
    for (const target of this.targets) watched.delete(target);
    this.targets.clear();
  }
  takeRecords() {
    return [];
  }
}
globalThis.IntersectionObserver =
  FakeIntersectionObserver as unknown as typeof IntersectionObserver;

const app = await loadPluginApp(() => import("./app"));
const { createOrb, createVoiceGlow } = await import("./app");

const FIXTURE = `
<div data-thread-window>
  <div data-timeline-items>
    <div data-timeline-row-id="thr_1:command:i3"><button><span title="Running ls">Running ls</span></button></div>
  </div>
  <div class="flex"><span class="animate-shine">Working...</span></div>
</div>`;

let scripts: MountedPluginContentScripts | null = null;
const frame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
const orbCanvas = () =>
  document.querySelector<HTMLCanvasElement>("[data-beam-orbs-orb] canvas");
const animating = (canvas: HTMLCanvasElement | null) =>
  canvas !== null && watched.has(canvas);
const html = () => document.documentElement;
const settle = async () => {
  for (let index = 0; index < 3; index += 1) await frame();
  await new Promise((resolve) => setTimeout(resolve, 20));
};

beforeEach(() => {
  reduced = true;
  asked.length = 0;
  watched.clear();
  motionSetting.set(false);
  document.body.innerHTML = FIXTURE;
});

afterEach(async () => {
  await scripts?.lifecycle.dispose();
  scripts = null;
  motionSetting.set(false);
  document.body.innerHTML = "";
});

async function mount() {
  scripts = await mountPluginContentScripts(app, { pluginId: "beam-orbs" });
  await frame();
  await vi.waitFor(() => expect(orbCanvas()).not.toBeNull());
}

it("reads the setting through the app overlay", async () => {
  expect(app.appOverlays).toHaveLength(1);
  const on = renderSlot(app.appOverlays[0]!, {}, {
    settings: { animateWithReducedMotion: true },
  });
  await vi.waitFor(() => expect(motionSetting.get()).toBe(true));
  on.lifecycle.unmount();
  const off = renderSlot(app.appOverlays[0]!, {}, {
    settings: { animateWithReducedMotion: false },
  });
  await vi.waitFor(() => expect(motionSetting.get()).toBe(false));
  off.lifecycle.unmount();
});

it("keeps the still orb and the reduced-motion beam while the setting is off", async () => {
  await mount();
  await vi.waitFor(() => expect(animating(orbCanvas())).toBe(false));
  expect(html().hasAttribute("data-beam-orbs-animate")).toBe(false);
});

it("animates the orb and the beam under reduced motion while the setting is on", async () => {
  motionSetting.set(true);
  await mount();
  await settle();
  expect(animating(orbCanvas())).toBe(true);
  expect(html().hasAttribute("data-beam-orbs-animate")).toBe(true);
  expect(window.matchMedia).toBe(fakeMatchMedia);
});

it("follows a live flip without remounting the content script", async () => {
  await mount();
  const host = document.querySelector("[data-beam-orbs-orb]");
  const observers = [...scripts!.inspection.mountedIds];

  motionSetting.set(true);
  await settle();
  expect(animating(orbCanvas())).toBe(true);
  expect(html().hasAttribute("data-beam-orbs-animate")).toBe(true);
  expect(document.querySelector("[data-beam-orbs-orb]")).toBe(host);

  motionSetting.set(false);
  await vi.waitFor(() => expect(animating(orbCanvas())).toBe(false));
  expect(html().hasAttribute("data-beam-orbs-animate")).toBe(false);
  expect(document.querySelector("[data-beam-orbs-orb]")).toBe(host);
  expect([...scripts!.inspection.mountedIds]).toEqual(observers);
  expect(scripts!.inspection.disposed).toBe(false);
});

it("removes the motion attribute when the plugin unloads", async () => {
  motionSetting.set(true);
  await mount();
  await scripts!.lifecycle.dispose();
  scripts = null;
  expect(html().hasAttribute("data-beam-orbs-animate")).toBe(false);
});

it("lets the voice glow ignore reduced motion only while the setting is on", async () => {
  const host = document.createElement("span");
  document.body.append(host);

  const still = createVoiceGlow(host);
  still.update("recording", false);
  await vi.waitFor(() => expect(asked).toContain(REDUCED_MOTION_QUERY));
  still.dispose();

  asked.length = 0;
  motionSetting.set(true);
  const moving = createVoiceGlow(host);
  moving.update("recording", false);
  expect(asked).not.toContain(REDUCED_MOTION_QUERY);
  expect(host.childElementCount).toBeGreaterThan(0);
  moving.dispose();
});

it("draws a moving orb view under reduced motion only while the setting is on", async () => {
  const host = document.createElement("span");
  document.body.append(host);
  const view = createOrb(host);
  view.update("solving", false);
  await settle();
  expect(host.querySelector("canvas")).not.toBeNull();
  expect(animating(host.querySelector("canvas"))).toBe(false);
  motionSetting.set(true);
  await settle();
  expect(animating(host.querySelector("canvas"))).toBe(true);
  view.dispose();
});

it("gates every reduced-motion rule on the setting being off", () => {
  const css = readFileSync("app.css", "utf8");
  const start = css.indexOf("@media (prefers-reduced-motion: reduce)");
  expect(start).toBeGreaterThan(-1);
  const block = css.slice(start);
  const selectors = [...block.matchAll(/^\s*([^@{}\n][^{}]*)\{/gm)].map((m) =>
    m[1]!.trim(),
  );
  expect(selectors.length).toBeGreaterThan(0);
  for (const group of selectors) {
    for (const selector of group.split(",")) {
      expect(selector.trim()).toMatch(/^:root:not\(\[data-beam-orbs-animate\]\) /);
    }
  }
});

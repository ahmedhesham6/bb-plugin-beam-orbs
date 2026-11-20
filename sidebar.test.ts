// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, expect, it } from "vitest";
import { startBeamAndOrbs, type Effects } from "./beam-orbs";

const TREELANES_CARD = (id: string, active: boolean, status: string) => `
<div class="group/card relative rounded-lg${active ? " bg-state-active bb-sidebar-selected-row" : ""}">
  <a data-sidebar-thread-id="${id}" href="#"${active ? ' aria-current="page"' : ""}></a>
  <div data-card-body>
    <span data-card-status>
      <span data-status-value>${status}</span>
    </span>
  </div>
</div>`;

const WORKING = (text: string) =>
  `<span aria-hidden="true" data-status="running" class="inline-flex"><span data-icon="treelanes/status-working" data-icon-root></span>${text}</span>`;
const DONE = `<span aria-hidden="true" data-status="unread" class="inline-flex"><svg data-icon="CircleCheck"></svg>Done</span>`;

const BB_ROW = (id: string, selected: boolean) => `
<div data-sidebar-rename-row class="relative${selected ? " bb-sidebar-selected-row" : ""}">
  <div><a data-sidebar-thread-id="${id}" href="/projects/p/threads/${id}"></a></div>
  <span data-sidebar-thread-trailing><span data-sidebar-thread-trailing-indicator></span></span>
</div>`;

let created: string[];
let disposed: string[];
let controller: AbortController;

const effects: Effects = {
  orb: (host) => {
    created.push(host.dataset.beamOrbsPlace ?? "");
    return { update() {}, dispose: () => disposed.push("orb") };
  },
  voiceGlow: () => ({ update() {}, dispose() {} }),
  metal: null,
};

const frame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
const $ = <T extends Element = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector);
const $$ = (selector: string) => [...document.querySelectorAll<HTMLElement>(selector)];
const cardOf = (id: string) =>
  $(`[data-sidebar-thread-id="${id}"]`)!.closest<HTMLElement>("div")!;
const beams = () => $$("[data-beam-orbs-card-beam]");

async function start() {
  controller = new AbortController();
  startBeamAndOrbs(controller.signal, effects, 10);
  await frame();
}

beforeEach(() => {
  created = [];
  disposed = [];
  history.replaceState(null, "", "/");
  document.documentElement.className = "";
});

afterEach(() => {
  controller?.abort();
  document.body.innerHTML = "";
});

it("puts one beam around the open Treelanes card and moves it on navigation", async () => {
  document.body.innerHTML = `<div data-sidebar="content">${TREELANES_CARD("thr_1", true, "2m")}${TREELANES_CARD("thr_2", false, "5m")}</div>`;
  await start();
  expect(beams()).toHaveLength(1);
  const beam = beams()[0]!;
  expect(beam.parentElement).toBe(cardOf("thr_1"));
  expect(beam.getAttribute("aria-hidden")).toBe("true");
  expect(beam.dataset.beamOrbsCardBeam).toBe("on");
  expect(beam.querySelectorAll("[data-beam-orbs-card-bloom]")).toHaveLength(1);

  const first = cardOf("thr_1");
  first.classList.remove("bb-sidebar-selected-row");
  first.querySelector("a")!.removeAttribute("aria-current");
  const second = cardOf("thr_2");
  second.classList.add("bb-sidebar-selected-row");
  second.querySelector("a")!.setAttribute("aria-current", "page");
  await frame();

  expect(beams()).toHaveLength(1);
  expect(beams()[0]!.parentElement).toBe(second);
  expect(first.querySelector("[data-beam-orbs-card-beam]")).toBeNull();
});

it("finds the open row in bb's own list from the thread in the URL", async () => {
  document.body.innerHTML = `<div data-sidebar="content">${BB_ROW("thr_a", false)}${BB_ROW("thr_b", true)}${BB_ROW("thr_c", true)}</div>`;
  history.replaceState(null, "", "/projects/p/threads/thr_b");
  await start();
  expect(beams()).toHaveLength(1);
  expect(beams()[0]!.parentElement).toBe(
    $('[data-sidebar-thread-id="thr_b"]')!.closest("[data-sidebar-rename-row]"),
  );
});

it("shows no card beam when no thread is open", async () => {
  document.body.innerHTML = `<div data-sidebar="content">${BB_ROW("thr_a", false)}${TREELANES_CARD("thr_1", false, "2m")}</div>`;
  await start();
  expect(beams()).toHaveLength(0);
});

it("replaces a working card's status icon and text with an orb and restores it", async () => {
  document.body.innerHTML = `<div data-sidebar="content">${TREELANES_CARD("thr_1", false, WORKING("2 working"))}</div>`;
  await start();
  const status = $("[data-status]")!;
  const orb = $<HTMLElement>("[data-beam-orbs-orb]")!;
  expect(orb.dataset.beamOrbsOrb).toBe("solving");
  expect(orb.dataset.beamOrbsPlace).toBe("status");
  expect(orb.nextElementSibling).toBe(status);
  expect(status.hasAttribute("data-beam-orbs-sr-only")).toBe(true);
  expect(status.textContent).toBe("2 working");

  $("[data-status-value]")!.innerHTML = DONE;
  await frame();
  expect($("[data-beam-orbs-orb]")).toBeNull();
  expect($("[data-beam-orbs-sr-only]")).toBeNull();
  expect(disposed).toEqual(["orb"]);
});

it("restores a status span that bb reuses for the next status", async () => {
  document.body.innerHTML = `<div data-sidebar="content">${TREELANES_CARD("thr_1", false, WORKING("Working"))}</div>`;
  await start();
  const status = $("[data-status]")!;
  status.querySelector("[data-icon]")!.setAttribute("data-icon", "CircleCheck");
  status.dataset.status = "unread";
  status.lastChild!.textContent = "Done";
  await frame();
  expect(status.hasAttribute("data-beam-orbs-sr-only")).toBe(false);
  expect($("[data-beam-orbs-orb]")).toBeNull();
});

it("removes the card beam and status orbs when the signal aborts", async () => {
  document.body.innerHTML = `<div data-sidebar="content">${TREELANES_CARD("thr_1", true, WORKING("Working"))}</div>`;
  await start();
  expect(beams()).toHaveLength(1);
  controller.abort();
  expect(beams()).toHaveLength(0);
  expect($("[data-beam-orbs-orb]")).toBeNull();
  expect($("[data-beam-orbs-sr-only]")).toBeNull();
});

it("styles the beams with the colorful md and sm looks and hides text without display none", () => {
  const css = readFileSync("app.css", "utf8");
  expect(css).not.toMatch(/--beam-orbs-x\b/);
  expect(css).toMatch(/\[data-beam-orbs-beam="on"\]::after[\s\S]*?conic-gradient/);
  expect(css).toMatch(/\[data-beam-orbs-card-beam="on"\]::after[\s\S]*?conic-gradient/);
  expect(css).toMatch(/rgb\(255, 50, 100\)/);
  const srOnly = css.match(/\[data-beam-orbs-sr-only\][^{]*\{([^}]*)\}/)?.[1] ?? "";
  expect(srOnly).toMatch(/clip-path: inset\(50%\)/);
  expect(srOnly).not.toMatch(/display:\s*none/);
});

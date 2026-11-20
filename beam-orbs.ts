import type { OrbState } from "thinking-orbs";
import { orbStateFor, type LatestActivity } from "./orb-state";

export interface OrbView {
  update(state: OrbState, dark: boolean): void;
  dispose(): void;
}

export type OrbFactory = (host: HTMLElement) => OrbView;

export type VoiceMode = "recording" | "transcribing";

export interface VoiceGlowView {
  update(mode: VoiceMode, dark: boolean): void;
  dispose(): void;
}

export interface MetalView {
  update(dark: boolean): void;
  dispose(): void;
}

export interface Effects {
  orb: OrbFactory;
  voiceGlow: (host: HTMLElement) => VoiceGlowView;
  metal: ((host: HTMLElement) => MetalView) | null;
}

const THREAD_WINDOW = "[data-thread-window]";
const SIDEBAR = '[data-sidebar="content"]';
const COMPOSER = "[data-composer-box] form[data-promptbox]";
const RUNNING_ICON = '[data-icon="Loading"]';
const SEND_BUTTON = 'button[data-promptbox-submit-action][type="submit"]';
const ORB = "data-beam-orbs-orb";
const REPLACED = "data-beam-orbs-replaced";
const BEAM = "data-beam-orbs-beam";
const BLOOM = "data-beam-orbs-bloom";
const VOICE = "data-beam-orbs-voice";
const METAL = "data-beam-orbs-metal";
const METAL_TARGET = "data-beam-orbs-metal-target";
const RADIUS = "--beam-orbs-radius";
const COLLAPSED = '[class*="animation-play-state:paused"]';
const FADE_OUT = "beam-orbs-fade-out";

type Place = "timeline" | "sidebar";

interface Orb {
  host: HTMLElement;
  view: OrbView;
  place: Place;
  state: OrbState | null;
  dark: boolean | null;
}

interface VoiceGlow {
  host: HTMLElement;
  view: VoiceGlowView;
  mode: VoiceMode | null;
  dark: boolean | null;
}

interface Metal {
  target: HTMLElement;
  host: HTMLElement;
  view: MetalView;
  dark: boolean | null;
}

interface Composer {
  voice: VoiceGlow | null;
  metal: Metal | null;
}

export function findWorkingIndicator(threadWindow: Element): HTMLElement | null {
  const shining = threadWindow.querySelectorAll<HTMLElement>(".animate-shine");
  for (let index = shining.length - 1; index >= 0; index -= 1) {
    const label = shining[index]!;
    if (
      label.closest(
        `[data-timeline-row-id], [data-app-composer], [role='status'], ${COLLAPSED}`,
      ) === null
    ) {
      return label;
    }
  }
  return null;
}

export function readLatestActivity(threadWindow: Element): LatestActivity {
  const rows = threadWindow.querySelectorAll<HTMLElement>(
    "[data-timeline-row-id]",
  );
  const row = rows[rows.length - 1];
  if (row === undefined) return null;
  if (row.querySelector("[data-message-column]") !== null) {
    return /:assistant\b/.test(row.dataset.timelineRowId ?? "")
      ? { kind: "reply" }
      : { kind: "user-message" };
  }
  const titled = row.querySelector("[title]");
  return {
    kind: "row",
    label: titled?.getAttribute("title") ?? row.textContent ?? "",
  };
}

export function isComposerEmpty(form: Element): boolean {
  if (form.hasAttribute("data-promptbox-voice-active")) return false;
  if (form.querySelector("[data-promptbox-attachments]") !== null) return false;
  const attachments = form.querySelector(
    "[data-promptbox-main] > [data-promptbox-expanded-only]",
  );
  if (attachments !== null && attachments.childElementCount > 0) return false;
  const editor = form.querySelector('[contenteditable="true"]');
  if (editor === null) return false;
  if ((editor.textContent ?? "").trim() !== "") return false;
  return editor.querySelector("[data-prompt-mention], img") === null;
}

export function readVoiceMode(form: Element): VoiceMode | null {
  if (!form.hasAttribute("data-promptbox-voice-active")) return null;
  const status = form.querySelector("[data-promptbox-voice-controls] [aria-live]");
  return /^\s*transcribing/i.test(status?.textContent ?? "")
    ? "transcribing"
    : "recording";
}

export function findSendTarget(form: Element): HTMLElement | null {
  const button = form.querySelector<HTMLElement>(SEND_BUTTON);
  if (button === null) return null;
  const menu = button.closest<HTMLElement>("[data-promptbox-send-menu]");
  return menu !== null && form.contains(menu) ? menu : button;
}

function overlay(attribute: string): HTMLElement {
  const host = document.createElement("span");
  host.setAttribute(attribute, "");
  host.setAttribute("aria-hidden", "true");
  return host;
}

export function startBeamAndOrbs(
  signal: AbortSignal,
  effects: Effects,
  discoveryMs = 500,
): () => void {
  const orbs = new Map<Element, Orb>();
  const watches = new Map<Element, MutationObserver>();
  const composers = new Map<HTMLElement, Composer>();
  let frame = 0;
  let stopped = false;

  const schedule = () => {
    if (stopped || frame !== 0) return;
    frame = requestAnimationFrame(flush);
  };

  const themeObserver = new MutationObserver(schedule);
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });

  const watch = (root: Element, options: MutationObserverInit) => {
    if (watches.has(root)) return false;
    const observer = new MutationObserver(schedule);
    observer.observe(root, options);
    watches.set(root, observer);
    return true;
  };

  const discover = () => {
    if (stopped || document.hidden) return;
    let changed = false;
    for (const [root, observer] of watches) {
      if (!root.isConnected) {
        observer.disconnect();
        watches.delete(root);
        changed = true;
      }
    }
    for (const root of document.querySelectorAll(THREAD_WINDOW)) {
      changed =
        watch(root, {
          childList: true,
          subtree: true,
          characterData: true,
          attributes: true,
          attributeFilter: ["title", "class"],
        }) || changed;
    }
    for (const root of document.querySelectorAll(SIDEBAR)) {
      changed =
        watch(root, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["data-icon"],
        }) || changed;
    }
    for (const root of document.querySelectorAll(COMPOSER)) {
      changed =
        watch(root, {
          childList: true,
          subtree: true,
          characterData: true,
          attributes: true,
          attributeFilter: ["data-promptbox-voice-active", "type"],
        }) || changed;
    }
    if (changed) schedule();
  };

  const dropOrb = (anchor: Element, orb: Orb) => {
    orb.view.dispose();
    orb.host.remove();
    if (orb.place === "sidebar") anchor.removeAttribute(REPLACED);
    orbs.delete(anchor);
  };

  const placeOrb = (anchor: Element, place: Place): Orb => {
    const existing = orbs.get(anchor);
    if (existing !== undefined && existing.host.isConnected) return existing;
    if (existing !== undefined) dropOrb(anchor, existing);
    const host = document.createElement("span");
    host.setAttribute(ORB, "");
    host.dataset.beamOrbsPlace = place;
    host.setAttribute("aria-hidden", "true");
    if (place === "timeline") {
      anchor.before(host);
    } else {
      anchor.setAttribute(REPLACED, "");
      anchor.after(host);
    }
    const orb: Orb = {
      host,
      view: effects.orb(host),
      place,
      state: null,
      dark: null,
    };
    orbs.set(anchor, orb);
    return orb;
  };

  const showOrb = (orb: Orb, state: OrbState, dark: boolean) => {
    if (orb.state === state && orb.dark === dark) return;
    orb.state = state;
    orb.dark = dark;
    orb.host.setAttribute(ORB, state);
    orb.host.dataset.beamOrbsTheme = dark ? "dark" : "light";
    orb.view.update(state, dark);
  };

  const onAnimationEnd = (event: AnimationEvent) => {
    const form = event.currentTarget;
    if (
      form instanceof HTMLElement &&
      event.target === form &&
      event.animationName === FADE_OUT &&
      form.getAttribute(BEAM) === "off"
    ) {
      form.removeAttribute(BEAM);
    }
  };

  const updateBeam = (form: HTMLElement) => {
    const current = form.getAttribute(BEAM);
    if (isComposerEmpty(form)) {
      if (form.querySelector(`:scope > [${BLOOM}]`) === null) {
        const bloom = document.createElement("div");
        bloom.setAttribute(BLOOM, "");
        bloom.setAttribute("aria-hidden", "true");
        form.append(bloom);
      }
      if (current !== "on") {
        const radius = getComputedStyle(form).borderTopLeftRadius;
        if (radius !== "") form.style.setProperty(RADIUS, radius);
        form.setAttribute(BEAM, "on");
      }
    } else if (current === "on") {
      form.setAttribute(BEAM, "off");
    }
  };

  const dropVoice = (composer: Composer) => {
    if (composer.voice === null) return;
    composer.voice.view.dispose();
    composer.voice.host.remove();
    composer.voice = null;
  };

  const updateVoice = (form: HTMLElement, composer: Composer, dark: boolean) => {
    const mode = readVoiceMode(form);
    if (mode === null) {
      dropVoice(composer);
      return;
    }
    if (composer.voice === null) {
      const host = overlay(VOICE);
      form.append(host);
      composer.voice = { host, view: effects.voiceGlow(host), mode: null, dark: null };
    } else if (composer.voice.host.parentElement !== form) {
      form.append(composer.voice.host);
    }
    const voice = composer.voice;
    if (voice.mode === mode && voice.dark === dark) return;
    voice.mode = mode;
    voice.dark = dark;
    voice.view.update(mode, dark);
  };

  const dropMetal = (composer: Composer) => {
    if (composer.metal === null) return;
    composer.metal.view.dispose();
    composer.metal.host.remove();
    composer.metal.target.removeAttribute(METAL_TARGET);
    composer.metal = null;
  };

  const updateMetal = (form: HTMLElement, composer: Composer, dark: boolean) => {
    if (effects.metal === null) return;
    const target = findSendTarget(form);
    if (
      composer.metal !== null &&
      (composer.metal.target !== target ||
        composer.metal.host.parentElement !== target)
    ) {
      dropMetal(composer);
    }
    if (target === null) return;
    if (composer.metal === null) {
      const host = overlay(METAL);
      target.setAttribute(METAL_TARGET, "");
      target.append(host);
      composer.metal = { target, host, view: effects.metal(host), dark: null };
    }
    if (composer.metal.dark === dark) return;
    composer.metal.dark = dark;
    composer.metal.view.update(dark);
  };

  const cleanComposer = (form: HTMLElement) => {
    const composer = composers.get(form);
    if (composer !== undefined) {
      dropVoice(composer);
      dropMetal(composer);
    }
    form.removeEventListener("animationend", onAnimationEnd);
    form.removeAttribute(BEAM);
    form.style.removeProperty(RADIUS);
    form.querySelector(`:scope > [${BLOOM}]`)?.remove();
    composers.delete(form);
  };

  function flush() {
    frame = 0;
    if (stopped) return;
    const dark = document.documentElement.classList.contains("dark");
    const wanted = new Map<Element, [Place, OrbState]>();

    for (const root of watches.keys()) {
      if (!root.isConnected) continue;
      if (root.matches(THREAD_WINDOW)) {
        const indicator = findWorkingIndicator(root);
        if (indicator !== null) {
          wanted.set(indicator, [
            "timeline",
            orbStateFor(indicator.textContent ?? "", readLatestActivity(root)),
          ]);
        }
      } else if (root.matches(SIDEBAR)) {
        for (const icon of root.querySelectorAll(RUNNING_ICON)) {
          wanted.set(icon, ["sidebar", "solving"]);
        }
      }
    }

    for (const [anchor, orb] of orbs) {
      if (!wanted.has(anchor) || !anchor.isConnected) dropOrb(anchor, orb);
    }
    for (const [anchor, [place, state]] of wanted) {
      showOrb(placeOrb(anchor, place), state, dark);
    }

    for (const form of composers.keys()) {
      if (!form.isConnected) cleanComposer(form);
    }
    for (const root of watches.keys()) {
      if (!(root instanceof HTMLElement) || !root.isConnected) continue;
      if (!root.matches(COMPOSER)) continue;
      let composer = composers.get(root);
      if (composer === undefined) {
        composer = { voice: null, metal: null };
        composers.set(root, composer);
        root.addEventListener("animationend", onAnimationEnd);
      }
      updateBeam(root);
      updateVoice(root, composer, dark);
      updateMetal(root, composer, dark);
    }
  }

  const timer = setInterval(discover, discoveryMs);
  discover();

  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (frame !== 0) cancelAnimationFrame(frame);
    clearInterval(timer);
    themeObserver.disconnect();
    for (const observer of watches.values()) observer.disconnect();
    watches.clear();
    for (const [anchor, orb] of orbs) dropOrb(anchor, orb);
    for (const form of [...composers.keys()]) cleanComposer(form);
  };
  signal.addEventListener("abort", stop, { once: true });
  return stop;
}

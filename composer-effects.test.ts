// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, expect, it } from "vitest";
import {
  startBeamAndOrbs,
  type Effects,
  type VoiceMode,
} from "./beam-orbs";

const COMPOSER = `
<div data-app-composer>
  <div data-composer-box>
    <form data-promptbox class="relative rounded-xl">
      <div data-promptbox-main>
        <div data-promptbox-input-region>
          <div contenteditable="true" role="textbox"><p><br></p></div>
        </div>
      </div>
      <div data-promptbox-action-row>
        <div id="voice-slot"></div>
        <div data-promptbox-submit-group>
          <div data-promptbox-send-menu class="inline-flex rounded-md">
            <button data-promptbox-submit-action type="submit" aria-label="Submit (Enter)">Send</button>
            <button type="button" aria-label="Send options"></button>
          </div>
        </div>
      </div>
    </form>
  </div>
</div>`;

const RECORDING_BAR = (label: "Recording" | "Transcribing") => `
<div data-promptbox-voice-controls data-voice-transition="active">
  <div><div class="h-7 w-full"><canvas></canvas></div><span class="sr-only" aria-live="polite">${label}</span></div>
</div>`;

interface Log {
  voice: Array<[string, VoiceMode, boolean]>;
  metal: Array<[string, boolean]>;
  disposed: string[];
}

let log: Log;
let controller: AbortController;
let stop: () => void;
const live = new Set<MutationObserver>();
const NativeObserver = globalThis.MutationObserver;
class TrackedObserver extends NativeObserver {
  override observe(target: Node, options?: MutationObserverInit) {
    live.add(this);
    super.observe(target, options);
  }
  override disconnect() {
    live.delete(this);
    super.disconnect();
  }
}

function fakeEffects(withMetal = true): Effects {
  return {
    orb: () => ({ update() {}, dispose() {} }),
    voiceGlow: (host) => {
      host.dataset.fake = "voice";
      return {
        update: (mode, dark) => log.voice.push(["voice", mode, dark]),
        dispose: () => log.disposed.push("voice"),
      };
    },
    metal: withMetal
      ? (host) => {
          host.dataset.fake = "metal";
          return {
            update: (dark) => log.metal.push(["metal", dark]),
            dispose: () => log.disposed.push("metal"),
          };
        }
      : null,
  };
}

const frame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
const $ = <T extends Element = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector);
const form = () => $<HTMLFormElement>("form[data-promptbox]")!;
const sendMenu = () => $("[data-promptbox-send-menu]")!;
const sendButton = () =>
  $<HTMLButtonElement>('[data-promptbox-submit-action][type="submit"]');

async function start(withMetal = true) {
  controller = new AbortController();
  stop = startBeamAndOrbs(controller.signal, fakeEffects(withMetal), 10);
  await frame();
}

function startRecording(label: "Recording" | "Transcribing" = "Recording") {
  form().setAttribute("data-promptbox-voice-active", "");
  $("#voice-slot")!.innerHTML = RECORDING_BAR(label);
}

beforeEach(() => {
  log = { voice: [], metal: [], disposed: [] };
  live.clear();
  globalThis.MutationObserver = TrackedObserver;
  document.documentElement.className = "";
  document.body.innerHTML = COMPOSER;
});

afterEach(() => {
  stop?.();
  globalThis.MutationObserver = NativeObserver;
  document.body.innerHTML = "";
});

it("shows no voice glow while bb does not record", async () => {
  await start();
  expect($("[data-beam-orbs-voice]")).toBeNull();
  expect(log.voice).toEqual([]);
});

it("raises the voice glow while bb records and sweeps it while bb transcribes", async () => {
  await start();
  startRecording();
  await frame();
  const host = $("[data-beam-orbs-voice]")!;
  expect(host.parentElement).toBe(form());
  expect(host.getAttribute("aria-hidden")).toBe("true");
  expect(log.voice.at(-1)).toEqual(["voice", "recording", false]);

  $("[aria-live]")!.textContent = "Transcribing";
  await frame();
  expect($("[data-beam-orbs-voice]")).toBe(host);
  expect(log.voice.at(-1)).toEqual(["voice", "transcribing", false]);

  document.documentElement.classList.add("dark");
  await frame();
  expect(log.voice.at(-1)).toEqual(["voice", "transcribing", true]);

  form().removeAttribute("data-promptbox-voice-active");
  $("#voice-slot")!.innerHTML = "";
  await frame();
  expect($("[data-beam-orbs-voice]")).toBeNull();
  expect(log.disposed).toEqual(["voice"]);
});

it("does not put the beam on a composer that records", async () => {
  await start();
  expect(form().dataset.beamOrbsBeam).toBe("on");
  startRecording();
  await frame();
  expect(form().dataset.beamOrbsBeam).toBe("off");
});

it("puts the metal under a send button that keeps its clicks and disabled state", async () => {
  await start();
  const overlay = $("[data-beam-orbs-metal]")!;
  expect(overlay.parentElement).toBe(sendMenu());
  expect(overlay.getAttribute("aria-hidden")).toBe("true");
  expect(overlay.querySelector("button, a, input, [tabindex]")).toBeNull();
  expect(sendMenu().hasAttribute("data-beam-orbs-metal-target")).toBe(true);
  expect(log.metal).toEqual([["metal", false]]);

  let clicks = 0;
  sendButton()!.addEventListener("click", (event) => {
    event.preventDefault();
    clicks += 1;
  });
  sendButton()!.click();
  expect(clicks).toBe(1);

  sendButton()!.disabled = true;
  await frame();
  expect(sendButton()!.disabled).toBe(true);
  sendButton()!.click();
  expect(clicks).toBe(1);
  expect($("[data-beam-orbs-metal]")).toBe(overlay);

  sendButton()!.disabled = false;
  sendButton()!.focus();
  expect(document.activeElement).toBe(sendButton());
});

it("takes the metal off while the send button is the stop button", async () => {
  await start();
  sendMenu().parentElement!.innerHTML =
    `<button data-promptbox-submit-action type="button" aria-label="Stop run">Stop</button>`;
  await frame();
  expect($("[data-beam-orbs-metal]")).toBeNull();
  expect($("[data-beam-orbs-metal-target]")).toBeNull();
  expect(log.disposed).toEqual(["metal"]);
  const stopButton = $<HTMLButtonElement>('[aria-label="Stop run"]')!;
  expect(stopButton.childElementCount).toBe(0);

  stopButton.parentElement!.innerHTML =
    `<button data-promptbox-submit-action type="submit" aria-label="Submit (Enter)">Send</button>`;
  await frame();
  expect($("[data-beam-orbs-metal]")!.parentElement).toBe(sendButton());
});

it("leaves the send button as it is when WebGL2 is not there", async () => {
  await start(false);
  expect($("[data-beam-orbs-metal]")).toBeNull();
  expect($("[data-beam-orbs-metal-target]")).toBeNull();
});

it("removes the voice glow and the metal when the composer goes away", async () => {
  await start();
  startRecording();
  await frame();
  $("[data-app-composer]")!.remove();
  await new Promise((resolve) => setTimeout(resolve, 40));
  await frame();
  expect(log.disposed.sort()).toEqual(["metal", "voice"]);
});

it("removes both effects and their observers when the signal aborts", async () => {
  await start();
  startRecording("Transcribing");
  await frame();
  expect(live.size).toBeGreaterThan(0);
  controller.abort();
  expect($("[data-beam-orbs-voice]")).toBeNull();
  expect($("[data-beam-orbs-metal]")).toBeNull();
  expect($("[data-beam-orbs-metal-target]")).toBeNull();
  expect(log.disposed.sort()).toEqual(["metal", "voice"]);
  expect(live.size).toBe(0);
});

it("never lets the overlays take pointer events", () => {
  const css = readFileSync("app.css", "utf8");
  for (const selector of ["[data-beam-orbs-voice]", "[data-beam-orbs-metal]"]) {
    const rule = css.match(
      new RegExp(`${selector.replace(/[[\]]/g, "\\$&")}[^{]*\\{([^}]*)\\}`),
    );
    expect(rule?.[1], selector).toMatch(/pointer-events:\s*none/);
  }
});

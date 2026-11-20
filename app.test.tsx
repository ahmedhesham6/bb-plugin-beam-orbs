// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import {
  loadPluginApp,
  mountPluginContentScripts,
  type MountedPluginContentScripts,
} from "@get-bb/plugin-sdk/testing/app";

const app = await loadPluginApp(() => import("./app"));

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

const FIXTURE = `
<div data-sidebar="content">
  <div data-sidebar-rename-row>
    <span data-sidebar-thread-trailing-indicator>
      <svg data-icon="Loading" data-icon-root aria-label="Thread working"></svg>
    </span>
  </div>
  <div class="treelanes-row">
    <a data-sidebar-thread-id="thr_2" href="#"></a>
    <span><svg data-icon="Loading" data-icon-root aria-label="Running"></svg></span>
  </div>
</div>
<div data-thread-window>
  <div data-timeline-items>
    <div data-timeline-row-id="thr_1:user-seed:1"><div data-message-column><p>Do it</p></div></div>
    <div data-timeline-row-id="thr_1:command:i3">
      <button><span title="Running sleep 8 &amp;&amp; ls -la"><span class="animate-shine">Running</span> sleep 8</span></button>
    </div>
  </div>
  <div id="indicator" class="px-2 mt-4 flex"><span class="animate-shine">Working...</span></div>
  <div data-app-composer>
    <div data-composer-box>
      <form data-promptbox class="relative rounded-xl">
        <div data-promptbox-main>
          <div data-promptbox-input-region>
            <div data-promptbox-editor-content>
              <div contenteditable="true" role="textbox" class="ProseMirror"><p class="is-editor-empty"><br></p></div>
            </div>
          </div>
          <div data-promptbox-expanded-only></div>
        </div>
        <div data-promptbox-action-row>
          <button data-promptbox-submit-action type="submit" disabled>Send</button>
        </div>
      </form>
    </div>
  </div>
</div>`;

let scripts: MountedPluginContentScripts | null = null;

const frame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
const $ = <T extends Element = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector);
const $$ = (selector: string) => [...document.querySelectorAll(selector)];
const orbs = () => $$("[data-beam-orbs-orb]") as HTMLElement[];
const timelineOrb = () => $("[data-thread-window] [data-beam-orbs-orb]");
const form = () => $<HTMLFormElement>("form[data-promptbox]")!;
const editor = () => $("[contenteditable]")!;

async function mount() {
  scripts = await mountPluginContentScripts(app, { pluginId: "beam-orbs" });
  await frame();
}

function addRow(id: string, html: string) {
  const row = document.createElement("div");
  row.dataset.timelineRowId = id;
  row.innerHTML = html;
  $("[data-timeline-items]")!.append(row);
}

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = (() =>
    null) as unknown as HTMLCanvasElement["getContext"];
});

beforeEach(() => {
  live.clear();
  globalThis.MutationObserver = TrackedObserver;
  document.documentElement.className = "";
  document.body.innerHTML = FIXTURE;
});

afterEach(async () => {
  await scripts?.lifecycle.dispose();
  scripts = null;
  globalThis.MutationObserver = NativeObserver;
  document.body.innerHTML = "";
});

it("adds one orb next to the Working indicator, in the state of the latest row", async () => {
  await mount();
  await frame();
  const orb = timelineOrb()!;
  expect($$("[data-thread-window] [data-beam-orbs-orb]")).toHaveLength(1);
  expect(orb.dataset.beamOrbsOrb).toBe("working");
  expect(orb.nextElementSibling?.textContent).toBe("Working...");
  await vi.waitFor(() => expect(orb.querySelector("canvas")).not.toBeNull());
  expect(orb.querySelector("canvas")!.style.width).toBe("20px");
});

it("follows the latest activity row as new rows appear", async () => {
  await mount();
  const orb = timelineOrb()!;
  addRow("thr_1:file:i4", `<button><span title="Edited README.md">Edited README.md</span></button>`);
  await frame();
  expect(orb.dataset.beamOrbsOrb).toBe("shaping");
  addRow("thr_1:explore:i5", `<button><span title="Explored 3 files">Explored 3 files</span></button>`);
  await frame();
  expect(orb.dataset.beamOrbsOrb).toBe("searching");
  addRow(
    "thr_1:assistant:kind:assistant|item:i6",
    `<div data-message-column><div data-markdown-preview>Done</div></div>`,
  );
  await frame();
  expect(timelineOrb()).toBe(orb);
  expect(orb.dataset.beamOrbsOrb).toBe("composing");
});

it("shows solving while bb shows Thinking", async () => {
  $("#indicator")!.innerHTML = `<button><span><span class="animate-shine">Thinking…</span></span></button>`;
  await mount();
  expect(timelineOrb()!.dataset.beamOrbsOrb).toBe("solving");
});

it("removes the orb and its canvas when the indicator goes away", async () => {
  await mount();
  await vi.waitFor(() => expect(timelineOrb()?.querySelector("canvas")).toBeTruthy());
  const orb = timelineOrb()!;
  $("#indicator")!.remove();
  await frame();
  expect(orb.isConnected).toBe(false);
  expect(orb.querySelector("canvas")).toBeNull();
  expect($("[data-thread-window] [data-beam-orbs-orb]")).toBeNull();
});

it("removes the orb when bb collapses the indicator after the turn", async () => {
  const indicator = $("#indicator")!;
  const wrapper = document.createElement("div");
  indicator.replaceWith(wrapper);
  wrapper.append(indicator);
  await mount();
  const orb = timelineOrb()!;
  expect(orb).not.toBeNull();

  wrapper.className = "[&_*]:![animation-play-state:paused]";
  wrapper.style.height = "0px";
  await frame();
  expect(orb.isConnected).toBe(false);
  expect(timelineOrb()).toBeNull();

  wrapper.className = "";
  await frame();
  expect(timelineOrb()).not.toBeNull();
});

it("replaces the sidebar running icons and restores the row when it stops", async () => {
  await mount();
  const icons = $$('[data-sidebar="content"] [data-icon="Loading"]');
  expect(icons).toHaveLength(2);
  for (const icon of icons) {
    expect(icon.hasAttribute("data-beam-orbs-replaced")).toBe(true);
    const orb = icon.parentElement!.querySelector<HTMLElement>("[data-beam-orbs-orb]")!;
    expect(orb.dataset.beamOrbsOrb).toBe("working");
  }

  const indicator = $("[data-sidebar-thread-trailing-indicator]")!;
  indicator.querySelector("svg")!.remove();
  indicator.insertAdjacentHTML("beforeend", `<span aria-label="Unread thread succeeded"></span>`);
  await frame();
  expect(indicator.querySelector("[data-beam-orbs-orb]")).toBeNull();
  expect(indicator.children).toHaveLength(1);
  expect($$('[data-sidebar="content"] [data-beam-orbs-orb]')).toHaveLength(1);
});

it("draws the orb for the current light or dark mode", async () => {
  await mount();
  const orb = timelineOrb()!;
  expect(orb.dataset.beamOrbsTheme).toBe("light");
  document.documentElement.classList.add("dark");
  await frame();
  expect(orb.dataset.beamOrbsTheme).toBe("dark");
});

it("puts the beam on an empty composer and clears it for text or attachments", async () => {
  await mount();
  expect(form().dataset.beamOrbsBeam).toBe("on");
  expect(form().querySelectorAll("[data-beam-orbs-bloom]")).toHaveLength(1);

  editor().innerHTML = "<p>hello</p>";
  await frame();
  expect(form().dataset.beamOrbsBeam).toBe("off");

  editor().innerHTML = `<p class="is-editor-empty"><br></p>`;
  await frame();
  expect(form().dataset.beamOrbsBeam).toBe("on");

  $("[data-promptbox-main] > [data-promptbox-expanded-only]")!.innerHTML =
    `<div class="mx-3"><span>notes.txt</span></div>`;
  await frame();
  expect(form().dataset.beamOrbsBeam).toBe("off");

  $("[data-promptbox-main] > [data-promptbox-expanded-only]")!.innerHTML = "";
  form().insertAdjacentHTML("afterbegin", `<span data-promptbox-attachments>1</span>`);
  await frame();
  expect(form().dataset.beamOrbsBeam).toBe("off");
});

it("treats a mention pill as text", async () => {
  await mount();
  editor().innerHTML = `<p><span data-prompt-mention="true" contenteditable="false"></span></p>`;
  await frame();
  expect(form().dataset.beamOrbsBeam).toBe("off");
});

it("removes every orb, the beam and its observers when the signal aborts", async () => {
  await mount();
  await vi.waitFor(() => expect(timelineOrb()?.querySelector("canvas")).toBeTruthy());
  expect(live.size).toBeGreaterThan(0);

  await scripts!.lifecycle.dispose();
  scripts = null;

  expect(orbs()).toHaveLength(0);
  expect($$("canvas")).toHaveLength(0);
  expect($$("[data-beam-orbs-replaced]")).toHaveLength(0);
  expect($$("[data-beam-orbs-bloom]")).toHaveLength(0);
  expect(form().hasAttribute("data-beam-orbs-beam")).toBe(false);
  expect(form().style.getPropertyValue("--beam-orbs-radius")).toBe("");
  expect(live.size).toBe(0);

  addRow("thr_1:file:i9", `<button><span title="Edited a.ts">Edited a.ts</span></button>`);
  $("#indicator")!.insertAdjacentHTML("beforeend", `<span class="animate-shine">Working...</span>`);
  await frame();
  expect(orbs()).toHaveLength(0);
});

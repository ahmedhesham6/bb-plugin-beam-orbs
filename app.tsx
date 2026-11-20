import { definePluginApp } from "@get-bb/plugin-sdk/app";
import type { CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import { isMetalFxSupported, MetalFx } from "metal-fx";
import { ThinkingOrb } from "thinking-orbs";
import { VoiceBeam, type VoiceBeamMotion } from "voice-glow";
import {
  startBeamAndOrbs,
  type MetalView,
  type OrbView,
  type VoiceGlowView,
  type VoiceMode,
} from "./beam-orbs";
import "./app.css";

const FILL: CSSProperties = { display: "block", width: "100%", height: "100%" };
const COVER: CSSProperties = { position: "absolute", inset: 0 };
const RECORDING_LEVEL = 0.35;
const SWEEP_SECONDS = 0.9;
const GATHER_SECONDS = 0.35;
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const GRAY_BAND = {
  dark: { core: "#ffffff", above: "#d4d4d4", mid: "#b4b4b4", below: "#949494" },
  light: { core: "#5a5a5a", above: "#8c8c8c", mid: "#787878", below: "#646464" },
} as const;

function radiusOf(element: HTMLElement): number {
  return Number.parseFloat(getComputedStyle(element).borderTopLeftRadius) || 0;
}

function createOrb(host: HTMLElement): OrbView {
  const root = createRoot(host);
  return {
    update(state, dark) {
      root.render(
        <ThinkingOrb
          state={state}
          size={20}
          theme={dark ? "dark" : "light"}
          aria-hidden="true"
        />,
      );
    },
    dispose() {
      root.unmount();
    },
  };
}

function createVoiceGlow(host: HTMLElement): VoiceGlowView {
  const root = createRoot(host);
  let mode: VoiceMode = "recording";
  let since = performance.now();
  const motion = (): VoiceBeamMotion => {
    if (mode === "recording") return { gather: 0 };
    const seconds = (performance.now() - since) / 1000;
    return {
      gather: Math.min(1, seconds / GATHER_SECONDS),
      offset: Math.sin((seconds * Math.PI) / SWEEP_SECONDS) * 0.85,
      stretch: 0.25,
      heldLevel: 0.5,
    };
  };
  return {
    update(next, dark) {
      if (next !== mode) {
        mode = next;
        since = performance.now();
      }
      const radius = radiusOf(host);
      root.render(
        <VoiceBeam
          type="default"
          colorVariant="mono"
          bandColors={dark ? GRAY_BAND.dark : GRAY_BAND.light}
          theme={dark ? "dark" : "light"}
          level={next === "recording" ? RECORDING_LEVEL : 0}
          motion={motion}
          borderRadius={radius}
          style={COVER}
        >
          <div style={{ ...FILL, borderRadius: radius }} />
        </VoiceBeam>,
      );
    },
    dispose() {
      root.unmount();
    },
  };
}

function createMetal(host: HTMLElement): MetalView {
  const root = createRoot(host);
  const reduced = window.matchMedia(REDUCED_MOTION);
  let dark = false;
  const render = () => {
    const radius = radiusOf(host);
    root.render(
      <MetalFx
        variant="circle"
        preset="silver"
        theme={dark ? "dark" : "light"}
        paused={reduced.matches}
        borderRadius={radius}
        style={FILL}
      >
        <span style={{ ...FILL, borderRadius: radius }} />
      </MetalFx>,
    );
  };
  reduced.addEventListener("change", render);
  return {
    update(next) {
      dark = next;
      render();
    },
    dispose() {
      reduced.removeEventListener("change", render);
      root.unmount();
    },
  };
}

export default definePluginApp((app) => {
  app.contentScripts.register({
    id: "beam-and-orbs",
    mount({ signal }) {
      return startBeamAndOrbs(signal, {
        orb: createOrb,
        voiceGlow: createVoiceGlow,
        metal: isMetalFxSupported() ? createMetal : null,
      });
    },
  });
});

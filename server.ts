import type { BbPluginApi } from "@get-bb/plugin-sdk";
import { SETTING_KEY } from "./motion-setting";

export default function beamOrbsPlugin(bb: BbPluginApi): void {
  bb.settings.define({
    [SETTING_KEY]: {
      type: "boolean",
      default: false,
      label: "Animate with reduced motion",
      description:
        "Keep the orbs, beams, voice glow and metal moving when your system asks for reduced motion.",
    },
  });
}

import { definePluginApp } from "@get-bb/plugin-sdk/app";
import { createRoot } from "react-dom/client";
import { ThinkingOrb } from "thinking-orbs";
import { startBeamAndOrbs, type OrbView } from "./beam-orbs";
import "./app.css";

function createReactOrb(host: HTMLElement): OrbView {
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

export default definePluginApp((app) => {
  app.contentScripts.register({
    id: "beam-and-orbs",
    mount({ signal }) {
      return startBeamAndOrbs(signal, createReactOrb);
    },
  });
});

import type { OrbState } from "thinking-orbs";

export type LatestActivity =
  | { kind: "user-message" }
  | { kind: "reply" }
  | { kind: "row"; label: string }
  | null;

const RULES: ReadonlyArray<readonly [RegExp, OrbState]> = [
  [
    /^(waiting for (approval|permissions?|answers?|your reply)|approval needed|asking\b)/,
    "breathing",
  ],
  [/^(listening|recording|transcribing|dictating)\b/, "listening"],
  [
    /^(starting|provisioning|provisioned|setting up|running setup|connecting|waiting for (workspace|turn to start)|waiting for .+ to be ready)\b/,
    "connecting",
  ],
  [
    /^(running|ran) (\d+ )?(subagents?|workflows?|background agents?)\b/,
    "weaving",
  ],
  [/^(running|ran|waiting for|waited for) agents?\b/, "weaving"],
  [/^(spawning|spawned|delegating|delegated)\b/, "weaving"],
  [
    /^(thinking|thought|reasoning|reasoned|planning|updating plan|updated plan)\b/,
    "solving",
  ],
  [
    /^(exploring|explored|reading|read|searching|searched|listing|listed|fetching|fetched|researching|researched|viewing|viewed|running web search|ran web search)\b/,
    "searching",
  ],
  [
    /^(editing|edited|creating|created|deleting|deleted|renaming|renamed|writing|wrote|applying|applied)\b/,
    "shaping",
  ],
  [/^(running|ran)\b/, "composing"],
];

function stateForPhrase(phrase: string): OrbState | null {
  for (const [pattern, state] of RULES) {
    if (pattern.test(phrase)) return state;
  }
  return null;
}

export function stateForLabel(label: string): OrbState | null {
  const line = (label.split("\n")[0] ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  const phrases = line.split(", ");
  const active = phrases.find((phrase) => /^\S+ing\b/.test(phrase));
  return (
    (active === undefined ? null : stateForPhrase(active)) ??
    stateForPhrase(line)
  );
}

export function orbStateFor(
  indicatorLabel: string,
  latest: LatestActivity,
): OrbState {
  const fromIndicator = stateForLabel(indicatorLabel);
  if (fromIndicator !== null) return fromIndicator;
  if (latest === null || latest.kind === "user-message") return "connecting";
  if (latest.kind === "reply") return "composing";
  return stateForLabel(latest.label) ?? "composing";
}

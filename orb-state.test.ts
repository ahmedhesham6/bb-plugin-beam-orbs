import { describe, expect, it } from "vitest";
import { orbStateFor, type LatestActivity } from "./orb-state";

const row = (label: string): LatestActivity => ({ kind: "row", label });

describe("orbStateFor", () => {
  it.each([
    ["no row yet", "Working...", null, "connecting"],
    ["the user's prompt is the latest row", "Working...", { kind: "user-message" }, "connecting"],
    ["thread setup", "Working...", row("Provisioned thread"), "connecting"],
    ["setup still running", "Working...", row("Running setup"), "connecting"],
    ["waiting for the workspace", "Working...", row("Waiting for workspace"), "connecting"],
    ["the Thinking indicator", "Thinking…", row("Running sleep 8"), "solving"],
    ["a reasoning row", "Working...", row("Thought for 12s"), "solving"],
    ["a plan update", "Working...", row("Updating plan"), "solving"],
    ["exploring files", "Working...", row("Exploring 2 files, 1 search"), "searching"],
    ["explored files", "Working...", row("Explored 3 files"), "searching"],
    ["reading a file", "Working...", row("Read README.md"), "searching"],
    ["searching", "Working...", row("Searched for init"), "searching"],
    ["a web search", "Working...", row("Running web search: orb"), "searching"],
    ["listing files", "Working...", row("Listed src"), "searching"],
    ["running a command", "Working...", row("Running sleep 8 && ls -la"), "solving"],
    ["a command that ran", "Working...", row("Ran npm test"), "solving"],
    ["a group of commands", "Working...", row("Running 3 commands"), "solving"],
    ["a tool", "Working...", row("Running tool: lint"), "solving"],
    ["editing a file", "Working...", row("Editing README.md"), "shaping"],
    ["edited files", "Working...", row("Edited 2 files"), "shaping"],
    ["a created file", "Working...", row("Created notes.md"), "shaping"],
    ["a subagent", "Working...", row("Running subagent: reviewer"), "weaving"],
    ["subagents", "Working...", row("Running 2 subagents"), "weaving"],
    ["a finished subagent", "Working...", row("Ran 1 subagent"), "weaving"],
    ["a Codex subagent", "Working...", row("Running agent /root/read_readme"), "weaving"],
    ["waiting for subagents", "Working...", row("Waiting for agents"), "weaving"],
    ["waited for subagents", "Working...", row("Waited for agents (4s)"), "weaving"],
    ["a workflow", "Working...", row("Running workflow: release"), "weaving"],
    ["a background agent", "Working...", row("Running background agent: docs"), "weaving"],
    ["the reply", "Working...", { kind: "reply" }, "solving"],
    ["an approval request", "Working...", row("Waiting for approval"), "breathing"],
    ["an approval indicator", "Waiting for approval", row("Edited a.ts"), "breathing"],
    ["a question for the user", "Working...", row("Waiting for answers to 2 questions"), "breathing"],
    ["waiting for the user's reply", "Working...", row("Waiting for your reply"), "breathing"],
    ["voice input", "Working...", row("Transcribing voice input"), "listening"],
    ["an unknown row", "Working...", row("Configuration warning"), "solving"],
    ["an empty label", "Working...", row(""), "solving"],
    ["the turn summary", "Working...", row("Worked for (51s)"), "solving"],
  ] as const)("%s → %s", (_case, indicator, latest, expected) => {
    expect(orbStateFor(indicator, latest as LatestActivity)).toBe(expected);
  });

  it("prefers the part of a summary that is still in progress", () => {
    expect(orbStateFor("Working...", row("Explored 2 files, Running 1 command"))).toBe(
      "solving",
    );
  });

  it("reads only the first line of a label and ignores extra space", () => {
    expect(orbStateFor("Working...", row("  Edited   a.ts\nProvisioned"))).toBe(
      "shaping",
    );
  });
});

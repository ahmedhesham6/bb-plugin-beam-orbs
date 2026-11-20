# Beam and Orbs for bb

A plugin for [bb](https://github.com/get-bb/bb) that adds two small effects to
bb. It works with any theme.

- **Thinking orbs.** A 20 px dotted orb shows what the agent does. In a thread,
  the orb goes in front of bb's "Working..." text at the end of the
  transcript. In the sidebar, an orb takes the place of the spinner on each
  thread that runs. This includes bb's own thread list and the Treelanes
  sidebar.
- **Border beam.** While the composer is empty (no text and no attachments), a
  soft beam of light moves along its bottom edge. The beam stops when you type
  or attach a file.

The orbs come from [thinking-orbs](https://www.npmjs.com/package/thinking-orbs)
and the beam from [border-beam](https://www.npmjs.com/package/border-beam),
both by Jakub Antalik.

## Install

```sh
bb plugin install git:https://github.com/ahmedhesham6/bb-plugin-beam-orbs.git
```

To turn it off:

```sh
bb plugin disable beam-orbs
```

## What the orb shows

The plugin reads the latest activity row in the transcript and picks the orb
state from it:

| bb is doing | Example row | Orb state |
| --- | --- | --- |
| Starting the agent | your prompt, "Provisioned thread" | `connecting` |
| Thinking | "Thinking…", "Thought for 12s" | `solving` |
| Reading or searching files | "Read README.md", "Explored 3 files", "Searched for init" | `searching` |
| Running a command | "Running sleep 8", "Ran npm test" | `working` |
| Editing files | "Editing README.md", "Edited 2 files" | `shaping` |
| Running subagents or a workflow | "Running 2 subagents", "Running agent …", "Running workflow: …" | `weaving` |
| Writing the reply | the agent's message | `composing` |
| Waiting for your answer or approval | "Waiting for approval", "Waiting for your reply" | `breathing` |
| Voice input | "Transcribing …" | `listening` |
| Anything else | "Configuration warning" | `working` |

Sidebar orbs always use `working`.

## Light, dark and motion

- The orbs and the beam follow bb's light and dark mode.
- When your system asks for reduced motion, each orb shows a still frame and
  the beam stays still in the middle of the edge.
- When the "Working..." text or a running row goes away, the plugin removes
  its orb and stops its animation. Orbs also pause when they are off screen or
  the tab is hidden.

## Limits

- The plugin reads bb's markup and the wording of its activity rows. A bb
  release that changes them can break the mapping. The orb then shows
  `working`, and a missing hook means no orb or no beam. Tested with bb 0.50.
- The orb follows the last row that bb has drawn. If you scroll far up in a
  long thread, bb may not draw the newest rows, and the orb can show an older
  state.
- bb 0.50 shows no spinner next to "Working...", so the orb goes in front of
  the text.

## Develop

```sh
npm install
npm test
npm run typecheck
npm run build        # needs the bb CLI
bb plugin install path:$PWD
```

## Credits

[thinking-orbs](https://www.npmjs.com/package/thinking-orbs) and
[border-beam](https://www.npmjs.com/package/border-beam) are Copyright (c) 2026
Jakub Antalik, under the MIT license. [app.css](app.css) reproduces the CSS of
border-beam's `line` and `mono` look. [LICENSE](LICENSE) has each notice.

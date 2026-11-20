# Beam and Orbs for bb

A plugin for [bb](https://github.com/get-bb/bb) that adds four small effects to
bb. It works with any theme.

- **Thinking orbs.** A 20 px dotted orb shows what the agent does. In a thread,
  the orb goes in front of bb's "Working..." text at the end of the
  transcript. In the sidebar, an orb takes the place of the spinner on each
  thread that runs. This includes bb's own thread list and the Treelanes
  sidebar.
- **Border beam.** While the composer is empty (no text and no attachments), a
  soft beam of light moves along its bottom edge. The beam stops when you type
  or attach a file.
- **Voice glow.** While bb records your voice, a gray glow rises from the
  bottom of the composer. While bb turns the recording into text, the glow
  gathers into one beam that sweeps from side to side.
- **Liquid metal.** The send button in the composer gets an animated metal
  ring. The button works as before: clicks, keyboard focus, and its disabled
  look. While a turn runs and bb shows the stop button, the metal is off.

The orbs come from [thinking-orbs](https://www.npmjs.com/package/thinking-orbs),
the beam from [border-beam](https://www.npmjs.com/package/border-beam), the
voice glow from [voice-glow](https://www.npmjs.com/package/voice-glow) and the
metal from [metal-fx](https://www.npmjs.com/package/metal-fx), all by Jakub
Antalik.

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

## Voice glow and liquid metal

- The voice glow does not use the microphone. bb's voice input owns it, and
  bb does not show its sound level in the page, so the glow uses a fixed,
  gentle level while bb records.
- The glow uses voice-glow's `default` type and `mono` colors. voice-glow
  draws its band in color even with `mono`, so the plugin also sets gray band
  colors.
- The metal uses metal-fx's `silver` preset and `circle` variant. It sits
  under the button's icon, so the icon stays on top. While the metal is on,
  the button takes its face from the metal, and the icon uses bb's text color.
- The metal needs WebGL2. Without it, the plugin leaves the send button as it
  is.

## Light, dark and motion

- All four effects follow bb's light and dark mode.
- When your system asks for reduced motion, each orb shows a still frame, the
  beam stays still in the middle of the edge, the voice glow holds still and
  the metal stops.
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
- The voice glow tells recording from transcribing by the words "Recording"
  and "Transcribing" in bb's voice bar.
- With bb's default theme, `circle` makes the square send button round. The
  T3 Code theme already makes it round.

## Develop

```sh
npm install
npm test
npm run typecheck
npm run build        # needs the bb CLI
bb plugin install path:$PWD
```

## Credits

[thinking-orbs](https://www.npmjs.com/package/thinking-orbs),
[border-beam](https://www.npmjs.com/package/border-beam),
[voice-glow](https://www.npmjs.com/package/voice-glow) and
[metal-fx](https://www.npmjs.com/package/metal-fx) are Copyright (c) 2026 Jakub
Antalik, under the MIT license. [app.css](app.css) reproduces the CSS of
border-beam's `line` and `mono` look. metal-fx includes shader code from
[Paper Shaders](https://github.com/paper-design/shaders), Copyright (c) Paper
Design, Inc., under the Apache License 2.0. [LICENSE](LICENSE) has each notice.

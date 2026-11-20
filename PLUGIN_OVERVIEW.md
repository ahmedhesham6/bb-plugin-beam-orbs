Adds thinking orbs that show what the agent does, a border beam on the empty composer, a voice glow while you dictate, and liquid metal on the send button. It works with any theme.

## Thinking orbs

A 20 px dotted orb takes the place of bb's "Working..." text at the end of a thread. Screen readers still read the text. Its animation follows the latest activity row:

- `connecting` while the agent starts
- `solving` while it thinks
- `searching` while it reads or searches files
- `composing` while it runs a command or writes the reply, and for any row the plugin does not know
- `shaping` while it edits files
- `weaving` while subagents or a workflow run
- `breathing` while it waits for your answer or approval
- `listening` for voice input

## Border beam

While the composer is empty, a colored beam of light moves around its whole border. It fades out when you type or attach a file. The plugin does not change the sidebar.

## Voice glow

While bb records your voice, a gray glow rises from the bottom of the composer. While bb turns the recording into text, the glow gathers into one beam that sweeps from side to side. The glow does not use the microphone; it uses a fixed, gentle level.

## Liquid metal

The send button gets an animated silver ring. The button works as before. While a turn runs and bb shows the stop button, the metal is off. Without WebGL2, the send button stays as it is.

## Light, dark and motion

All four effects follow light and dark mode. When your system asks for reduced motion, they stay still.

## Limits

The plugin reads bb's markup and the wording of its activity rows. A bb release can change them. The orb then shows `composing`.

## Credits

The orbs come from thinking-orbs, the beam from border-beam, the voice glow from voice-glow and the metal from metal-fx, all Copyright (c) 2026 Jakub Antalik, under the MIT license. metal-fx includes shader code from Paper Shaders, Copyright (c) Paper Design, Inc., under the Apache License 2.0. The `LICENSE` file has each notice.

Adds thinking orbs that show what the agent does, and a border beam on the empty composer. It works with any theme.

## Thinking orbs

A 20 px dotted orb goes in front of bb's "Working..." text at the end of a thread. Its animation follows the latest activity row:

- `connecting` while the agent starts
- `solving` while it thinks
- `searching` while it reads or searches files
- `working` while it runs a command, and for any row the plugin does not know
- `shaping` while it edits files
- `weaving` while subagents or a workflow run
- `composing` while it writes the reply
- `breathing` while it waits for your answer or approval
- `listening` for voice input

In the sidebar, an orb takes the place of the spinner on each thread that runs, in bb's thread list and in the Treelanes sidebar.

## Border beam

While the composer is empty, a soft beam of light moves along its bottom edge. It fades out when you type or attach a file.

## Light, dark and motion

The orbs and the beam follow light and dark mode. When your system asks for reduced motion, the orbs and the beam stay still.

## Limits

The plugin reads bb's markup and the wording of its activity rows. A bb release can change them. The orb then shows `working`.

## Credits

The orbs come from thinking-orbs and the beam from border-beam, both Copyright (c) 2026 Jakub Antalik, under the MIT license. The `LICENSE` file has each notice.

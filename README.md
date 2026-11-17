# Sounds — an Agents Hub plugin

The hub page makes a sound when the fleet has something to tell you:

- **new message** — a session finished its turn and wrote to you: a short muted "tock";
- **waiting for you** — a question as a form, a tool card, the "waiting for you" mark, a crashed session: two soft
  rising tones, more noticeable.

Your own messages and everything old when the page opens make no sound. If one update has both a message and a
question, only "waiting for you" sounds. With several hub tabs open, one of them sounds.

The browser synthesizes the sounds (WebAudio), there are no files. The browser lets a page play sound only after the
first click or key press on it — until then the plugin stays silent.

The settings text is in English by default and in Russian for a hub whose language is Russian (`hub.lang`).

## Turn off

- "Settings" → "Sounds": all at once, "message" and "waiting for you" separately, the volume, "listen" buttons.
  Kept in this browser.
- Or "Settings" → "Plugins" → sounds → turn off.

## Install

"Settings" → "Plugins" → find "sounds" or paste the link to this repo → "Check and install".

## Development

What counts as new is `events.js`, a pure function of two core snapshots; tests: `node --test test/events.test.mjs`.
The sounds are `SOUNDS` in `main.js`.

// Sounds — an Agents Hub page plugin (EXTENDING.md, API 1.x). A new message to the owner — a short muted "tock"; a
// session waits for the owner's answer (a question, a tool card, "waiting for you") — two soft tones, more noticeable.
// What counts as new is events.js (pure logic, tests). WebAudio synthesizes the sound, there are no files. The browser
// lets a page play sound only after a gesture on it: the AudioContext comes alive on the first click or key press;
// before that, sounds are silently skipped. Turn off — "Settings" → "Sounds" (kept in this browser) or turn the plugin
// off in "Settings" → "Plugins".
import { diff } from "./events.js";

// UI text: English by default, Russian for a hub whose language is Russian (hub.lang, API 1.25)
const TEXT = {
  en: {
    title: "Sounds",
    settingsHint: "A sound for new messages to you and for questions that need your answer",
    on: "Sounds on",
    message: "New message — a short muted sound",
    ask: "A session waits for your answer (a question, a card) — two tones",
    volume: "Volume",
    playMessage: "▶ Message",
    playAsk: "▶ Waiting for you",
    hint: "Kept in this browser. The browser lets the page play sound only after the first click on it. Your own messages and old ones when the page opens make no sound.",
  },
  ru: {
    title: "Звуки",
    settingsHint: "Звук на новые сообщения вам и на вопросы, где нужен ваш ответ",
    on: "Звуки включены",
    message: "Новое сообщение — короткий глухой звук",
    ask: "Сессия ждёт вашего ответа (вопрос, карточка) — два тона",
    volume: "Громкость",
    playMessage: "▶ Сообщение",
    playAsk: "▶ Ждёт вас",
    hint: "Хранится в этом браузере. Браузер пускает звук только после первого клика по странице. Свои сообщения и старое при открытии страницы не звучат.",
  },
};
let T = TEXT.en;

const KEY = "hub-sounds";
const DEFAULTS = { on: true, message: true, ask: true, volume: 0.6 };
const prefs = () => { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return { ...DEFAULTS }; } };
const save = (p) => localStorage.setItem(KEY, JSON.stringify(p));

let ctx = null;
function audio() {
  if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}
// the first gesture on the page brings sound alive; until it does, catch every gesture
const unlock = () => { if (audio()?.state === "running") ["pointerdown", "keydown"].forEach((e) => removeEventListener(e, unlock, true)); };
["pointerdown", "keydown"].forEach((e) => addEventListener(e, unlock, true));

// one tone: a frequency (or a glide from→to), the envelope — a fast attack and a soft decay, through a low-pass filter
function tone(ac, out, { type, from, to = from, at, glide = 0.1, peak, decay, cutoff }) {
  const o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
  o.type = type;
  o.frequency.setValueAtTime(from, at);
  if (to !== from) o.frequency.exponentialRampToValueAtTime(to, at + glide);
  f.type = "lowpass"; f.frequency.value = cutoff;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, at + decay);
  o.connect(f).connect(g).connect(out);
  o.start(at); o.stop(at + decay + 0.05);
}

export const SOUNDS = {
  // a short muted "tock": a low sine with a falling pitch, like a knock on wood
  message: (ac, out, t) => tone(ac, out, { type: "sine", from: 320, to: 170, at: t, glide: 0.09, peak: 0.5, decay: 0.2, cutoff: 900 }),
  // two soft rising tones (D — A), with a quiet octave below for warmth
  ask: (ac, out, t) => {
    for (const [hz, dt] of [[587.33, 0], [880, 0.14]]) {
      tone(ac, out, { type: "triangle", from: hz, at: t + dt, peak: 0.32, decay: 0.55, cutoff: 2400 });
      tone(ac, out, { type: "sine", from: hz / 2, at: t + dt, peak: 0.14, decay: 0.45, cutoff: 1200 });
    }
  },
};

function play(kind, { test = false } = {}) {
  const p = prefs();
  if (!test && (!p.on || !p[kind])) return;
  const ac = audio();
  if (!ac || ac.state !== "running") return;   // no gesture yet — the browser will not allow it; old sounds are not replayed later
  if (!test) {
    // several hub tabs — one sounds: whoever wrote first plays
    const now = Date.now(), last = JSON.parse(localStorage.getItem(KEY + ":last") || "{}");
    if (last.kind === kind && now - last.t < 2000) return;
    localStorage.setItem(KEY + ":last", JSON.stringify({ kind, t: now }));
  }
  const out = ac.createGain();
  out.gain.value = Math.max(0, Math.min(1, p.volume));
  out.connect(ac.destination);
  SOUNDS[kind](ac, out, ac.currentTime + 0.01);
}

function settings(root, hub) {
  if (root.dataset.built) return;   // render is called on every snapshot — build once, otherwise the focus is lost
  root.dataset.built = "1";
  const p = prefs();
  const row = (label, input) => { const l = hub.el("label", "sounds-row"); l.append(input, hub.el("span", null, label)); return l; };
  const check = (key, label) => {
    const i = hub.el("input"); i.type = "checkbox"; i.checked = p[key];
    i.addEventListener("change", () => { save({ ...prefs(), [key]: i.checked }); sync(); });
    return row(label, i);
  };
  const vol = hub.el("input"); vol.type = "range"; vol.min = "0"; vol.max = "1"; vol.step = "0.05"; vol.value = String(p.volume);
  vol.addEventListener("change", () => { save({ ...prefs(), volume: Number(vol.value) }); play("message", { test: true }); });
  const btn = (label, kind) => {
    const b = hub.el("button", "btn", label); b.type = "button";
    b.addEventListener("click", () => { audio(); setTimeout(() => play(kind, { test: true }), 30); });
    return b;
  };
  const all = check("on", T.on);
  const parts = hub.el("div", "sounds-parts");
  const v = hub.el("label", "sounds-row"); v.append(hub.el("span", null, T.volume), vol);
  const tests = hub.el("div", "sounds-tests");
  tests.append(btn(T.playMessage, "message"), btn(T.playAsk, "ask"));
  parts.append(check("message", T.message),
    check("ask", T.ask), v, tests);
  const sync = () => { parts.style.opacity = prefs().on ? "" : "0.5"; };
  sync();
  root.append(all, parts, hub.el("p", "hint", T.hint));
}

export default function register(hub) {
  if (hub.lang === "ru") T = TEXT.ru;
  hub.addStyle("sounds.css");
  let prev = null, seq = null;
  // an invisible element in the sidebar footer — only to be called on every snapshot
  hub.addSlot("sidebar.footer", {
    id: "sounds",
    order: 1000,
    render(root, snap) {
      root.hidden = true;
      if (!snap || snap.seq === seq) return;   // the same snapshot is drawn more than once
      seq = snap.seq;
      const r = diff(prev, snap);
      prev = r.next;
      if (r.kind) play(r.kind);
    },
  });
  hub.addSettings({ id: "sounds", title: T.title, hint: T.settingsHint,
    render: (root) => settings(root, hub) });
}

// What is new between two core snapshots — pure logic without sound or DOM (tests: test/events.test.mjs).
//
// "Message" — a session's last_out grew: a turn's result went to the owner (the core sets it only for a non-empty
// result; the owner's own messages do not touch it). "Waiting for you" — something new appeared that needs the owner's
// answer: a question as a form or a tool request (pending), a request in needs-owner, the watchdog's mark (attention),
// a crashed session.

// keys of what waits for the owner: a new key is a new reason to sound; the same question in later snapshots — silence
export function waitKeys(sessions) {
  const keys = new Set();
  for (const s of sessions || []) {
    for (const p of s.pending || []) keys.add(`${s.name}:p:${p.request_id ?? p.tool}`);
    for (const r of s.requests || []) if (r.state === "needs-owner") keys.add(`${s.name}:r:${r.tool}:${r.since ?? ""}`);
    if (s.attention) keys.add(`${s.name}:a:${s.attention.since ?? ""}`);
    if (s.state === "failed") keys.add(`${s.name}:failed:${s.since ?? ""}`);
  }
  return keys;
}

// snapshot -> what to remember for the next comparison
export function digest(snap) {
  const out = {};
  for (const s of snap?.sessions || []) out[s.name] = s.last_out || 0;
  return { epoch: snap?.epoch ?? null, seq: snap?.seq || 0, out, waits: waitKeys(snap?.sessions) };
}

// prev — the digest of the previous snapshot (null — the page's first snapshot: remember, do not sound: old things stay
// silent). Returns {kind: "ask" | "message" | null, next}. "Waiting for you" wins: both in one snapshot — only it sounds.
export function diff(prev, snap) {
  const next = digest(snap);
  if (!prev || prev.epoch !== next.epoch || next.seq < prev.seq) return { kind: null, next };   // a new journal — start over
  if (next.seq === prev.seq) return { kind: null, next: prev };
  for (const k of next.waits) if (!prev.waits.has(k)) return { kind: "ask", next };
  // a session that was not in the previous snapshot: new is only what happened after it
  for (const [name, seq] of Object.entries(next.out)) if (seq > (prev.out[name] ?? prev.seq)) return { kind: "message", next };
  return { kind: null, next };
}

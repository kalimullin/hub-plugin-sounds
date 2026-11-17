// node --test test/
import test from "node:test";
import assert from "node:assert/strict";
import { diff } from "../events.js";

const sess = (name, extra = {}) => ({ name, state: "idle", last_out: 0, pending: [], requests: [], ...extra });
const snap = (seq, sessions, epoch = "e1") => ({ seq, epoch, sessions });

function run(...snaps) {
  let prev = null;
  return snaps.map((s) => { const r = diff(prev, s); prev = r.next; return r.kind; });
}

test("the first snapshot is silent, even with old messages and questions", () => {
  assert.deepEqual(run(snap(10, [sess("a", { last_out: 9, pending: [{ request_id: "q1" }] })])), [null]);
});

test("a turn's result to the owner is a message", () => {
  assert.deepEqual(run(snap(10, [sess("a", { last_out: 5 })]), snap(12, [sess("a", { last_out: 12 })])), [null, "message"]);
});

test("a snapshot without a new result (the owner's message, work) is silent", () => {
  assert.deepEqual(run(snap(10, [sess("a", { last_out: 5 })]), snap(11, [sess("a", { last_out: 5, state: "busy" })])),
    [null, null]);
});

test("a question as a form is waiting for you; the same question in later snapshots is silent", () => {
  const q = sess("a", { pending: [{ request_id: "q1", tool: "AskUserQuestion" }] });
  assert.deepEqual(run(snap(10, [sess("a")]), snap(11, [q]), snap(12, [q])), [null, "ask", null]);
});

test("a question and a result in one snapshot: only waiting for you sounds", () => {
  const both = sess("a", { last_out: 11, pending: [{ request_id: "q1" }] });
  assert.deepEqual(run(snap(10, [sess("a")]), snap(11, [both])), [null, "ask"]);
});

test("a needs-owner request, the watchdog's mark, a crash are waiting for you", () => {
  const base = snap(10, [sess("a")]);
  assert.deepEqual(run(base, snap(11, [sess("a", { requests: [{ tool: "mcp:x", since: 9, state: "needs-owner" }] })])), [null, "ask"]);
  assert.deepEqual(run(base, snap(11, [sess("a", { attention: { since: 5 } })])), [null, "ask"]);
  assert.deepEqual(run(base, snap(11, [sess("a", { state: "failed", since: 7 })])), [null, "ask"]);
  assert.deepEqual(run(base, snap(11, [sess("a", { requests: [{ tool: "mcp:x", since: 9, state: "granted" }] })])), [null, null]);
});

test("a new session: an old result is silent, a fresh one is a message", () => {
  const base = snap(10, [sess("a")]);
  assert.deepEqual(run(base, snap(11, [sess("a"), sess("b", { last_out: 4 })])), [null, null]);
  assert.deepEqual(run(base, snap(11, [sess("a"), sess("b", { last_out: 11 })])), [null, "message"]);
});

test("a new journal (epoch) starts over, without a sound", () => {
  assert.deepEqual(run(snap(10, [sess("a", { last_out: 3 })]), snap(20, [sess("a", { last_out: 19 })], "e2")), [null, null]);
});

test("a repeat of the same snapshot is silent", () => {
  const s = snap(11, [sess("a", { last_out: 11 })]);
  assert.deepEqual(run(snap(10, [sess("a")]), s, s), [null, "message", null]);
});

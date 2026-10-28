import assert from "node:assert/strict";
import test from "node:test";
import { NativeResidentActivityGate } from "../src/performance/nativeResidentActivityGate.ts";

test("game pause suspends native rendering without changing app visibility", () => {
  const transitions: boolean[] = [];
  const gate = new NativeResidentActivityGate(true, false, (value) => transitions.push(value));
  assert.equal(gate.active, true);
  gate.setGamePaused(true);
  assert.equal(gate.active, false);
  gate.setGamePaused(false);
  assert.deepEqual(transitions, [true, false, true]);
});

test("foregrounding a manually paused game must not resume residents", () => {
  const transitions: boolean[] = [];
  const gate = new NativeResidentActivityGate(true, true, (value) => transitions.push(value));
  gate.setForeground(false);
  gate.setForeground(true);
  assert.deepEqual(transitions, [false]);
  assert.equal(gate.active, false);
  gate.setGamePaused(false);
  assert.deepEqual(transitions, [false, true]);
});

test("unpausing while in background cannot schedule an animation", () => {
  const transitions: boolean[] = [];
  const gate = new NativeResidentActivityGate(false, true, (value) => transitions.push(value));
  gate.setGamePaused(false);
  assert.equal(gate.active, false);
  gate.setForeground(true);
  assert.deepEqual(transitions, [false, true]);
});

test("repeated state updates do not emit duplicate frame bus changes", () => {
  const transitions: boolean[] = [];
  const gate = new NativeResidentActivityGate(true, false, (value) => transitions.push(value));
  gate.setGamePaused(false);
  gate.setForeground(true);
  gate.setForeground(false);
  gate.setForeground(false);
  gate.setGamePaused(true);
  gate.setGamePaused(true);
  gate.setForeground(true);
  gate.setGamePaused(false);
  assert.deepEqual(transitions, [true, false, true]);
});

test("one gate represents every NPC; mixed pause and foreground changes remain ordered", () => {
  const states: boolean[] = [];
  const gate = new NativeResidentActivityGate(true, false, (active) => states.push(active));
  for (let i = 0; i < 200; i++) gate.setGamePaused(true);
  gate.setForeground(false);
  gate.setGamePaused(false);
  gate.setForeground(true);
  assert.deepEqual(states, [true, false, true]);
});

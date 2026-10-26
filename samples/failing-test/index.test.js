/**
 * index.test.js — failing-test
 *
 * Tests for capitalize() and reverse() from index.js.
 *
 * Most tests pass. One test is DELIBERATELY WRONG: it asserts that
 * capitalize("hello") equals "HELLO" (all caps), but the function
 * actually returns "Hello" (only first letter uppercased).
 *
 * This incorrect expectation causes a real assertion failure and a
 * nonzero exit code, which is what BuildProof is designed to detect.
 *
 * The failure is in the test expectation, not in a missing file,
 * syntax error, or missing dependency.
 */

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { capitalize, reverse } = require('./index.js');

// --- Tests for capitalize() ---

test('capitalize: uppercases the first letter', () => {
  // This test PASSES — the function correctly returns "Hello"
  assert.strictEqual(capitalize('hello'), 'Hello');
});

test('capitalize: lowercases the rest of the string', () => {
  // This test PASSES
  assert.strictEqual(capitalize('hELLO'), 'Hello');
});

test('capitalize: all-caps result (DELIBERATELY FAILING)', () => {
  // This test FAILS.
  // The function returns "Hello", but we are asserting "HELLO".
  // This demonstrates a real test failure that BuildProof must detect.
  assert.strictEqual(capitalize('hello'), 'HELLO');
});

// --- Tests for reverse() ---

test('reverse: reverses a simple string', () => {
  // This test PASSES
  assert.strictEqual(reverse('hello'), 'olleh');
});

test('reverse: reverses a single character', () => {
  // This test PASSES
  assert.strictEqual(reverse('a'), 'a');
});

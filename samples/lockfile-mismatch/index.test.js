/**
 * index.test.js — lockfile-mismatch
 *
 * Tests for the greet() function. These tests are correct and would pass
 * if the project could be installed — but npm ci will fail first.
 */

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { greet } = require('./index.js');

test('greet: returns a greeting with the given name', () => {
  assert.strictEqual(greet('Alice'), 'Hello, Alice!');
});

test('greet: works with any string', () => {
  assert.strictEqual(greet('World'), 'Hello, World!');
});

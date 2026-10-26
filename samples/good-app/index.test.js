/**
 * index.test.js — good-app
 *
 * Tests for the functions exported from index.js.
 * Uses Node.js built-in test runner (node:test) and assertion library (node:assert).
 * Run with: node --test
 * All tests in this file are designed to PASS.
 */

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { add, multiply } = require('./index.js');

test('add: returns the correct sum of two positive numbers', () => {
  assert.strictEqual(add(2, 3), 5);
});

test('add: handles zero correctly', () => {
  assert.strictEqual(add(0, 0), 0);
  assert.strictEqual(add(5, 0), 5);
});

test('add: handles negative numbers', () => {
  assert.strictEqual(add(-3, 3), 0);
  assert.strictEqual(add(-2, -4), -6);
});

test('multiply: returns the correct product of two numbers', () => {
  assert.strictEqual(multiply(4, 5), 20);
});

test('multiply: any number multiplied by zero is zero', () => {
  assert.strictEqual(multiply(99, 0), 0);
});

test('multiply: handles negative numbers', () => {
  assert.strictEqual(multiply(-3, 4), -12);
  assert.strictEqual(multiply(-2, -5), 10);
});

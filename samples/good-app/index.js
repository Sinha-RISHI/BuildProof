/**
 * index.js — good-app
 *
 * A tiny utility library that exposes two simple math functions.
 * This file is used by index.test.js to verify the functions work correctly.
 */

'use strict';

/**
 * add(a, b)
 * Returns the sum of two numbers.
 */
function add(a, b) {
  return a + b;
}

/**
 * multiply(a, b)
 * Returns the product of two numbers.
 */
function multiply(a, b) {
  return a * b;
}

module.exports = { add, multiply };

// When run directly (node index.js), print a short demo
if (require.main === module) {
  console.log('add(2, 3)      =>', add(2, 3));
  console.log('multiply(4, 5) =>', multiply(4, 5));
}

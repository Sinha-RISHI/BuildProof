/**
 * index.js — failing-test
 *
 * A simple string utility module. The code is correct.
 * The test file deliberately tests an incorrect expectation for one function,
 * so that BuildProof can demonstrate a real test failure with a real exit code.
 */

'use strict';

/**
 * capitalize(str)
 * Returns the string with its first letter uppercased and the rest lowercased.
 * Example: capitalize("hello") → "Hello"
 */
function capitalize(str) {
  if (typeof str !== 'string' || str.length === 0) return str;
  return str[0].toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * reverse(str)
 * Returns the string with its characters in reverse order.
 * Example: reverse("hello") → "olleh"
 */
function reverse(str) {
  if (typeof str !== 'string') return str;
  return str.split('').reverse().join('');
}

module.exports = { capitalize, reverse };

if (require.main === module) {
  console.log(capitalize('hello'));  // Hello
  console.log(reverse('world'));     // dlrow
}

/**
 * index.js — lockfile-mismatch
 *
 * A simple greeting utility.
 * This file is syntactically correct and would work fine — the problem
 * with this sample project is only in its lockfile, not its code.
 */

'use strict';

/**
 * greet(name)
 * Returns a greeting string for the given name.
 */
function greet(name) {
  return `Hello, ${name}!`;
}

module.exports = { greet };

if (require.main === module) {
  console.log(greet('World'));
}

/**
 * index.js — no-tests-no-readme
 *
 * A minimal Node.js counter module.
 * This file is syntactically valid and works correctly.
 * The project has no test suite and no README, which BuildProof
 * will flag as "Not Verified" or "Failed" for those checks.
 */

'use strict';

let count = 0;

function increment() {
  count += 1;
  return count;
}

function getCount() {
  return count;
}

function reset() {
  count = 0;
}

module.exports = { increment, getCount, reset };

if (require.main === module) {
  increment();
  increment();
  increment();
  console.log('Count after 3 increments:', getCount()); // 3
  reset();
  console.log('Count after reset:', getCount());         // 0
}

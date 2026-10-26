# good-app

A minimal Node.js utility library used as a sample project for BuildProof.

## Requirements

- Node.js 18 or later
- npm

## Installation

```bash
npm ci
```

This installs all dependencies from the lockfile exactly.
Since this project has no external dependencies, `npm ci` completes almost instantly.

## Running the application

```bash
node index.js
```

Expected output:

```
add(2, 3)      => 5
multiply(4, 5) => 20
```

## Running the tests

```bash
npm test
```

This runs `node --test`, which discovers all `*.test.js` files and reports results.

All tests should pass.

## Project structure

```
good-app/
├── index.js        # Main module: exports add() and multiply()
├── index.test.js   # Tests using Node.js built-in test runner
├── package.json    # Project manifest and scripts
└── README.md       # This file
```

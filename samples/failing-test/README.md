# failing-test

A minimal Node.js string utility, used as a sample project for BuildProof.

## Requirements

- Node.js 18 or later
- npm

## Installation

```bash
npm ci
```

## Running the application

```bash
node index.js
```

Expected output:

```
Hello
dlrow
```

## Running the tests

```bash
npm test
```

> **Note:** The test suite contains a failing test. This is intentional and is
> used to demonstrate that BuildProof correctly reports a test failure even when
> installation succeeds.

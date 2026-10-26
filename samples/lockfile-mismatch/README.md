# lockfile-mismatch

A minimal Node.js greeting utility, used as a sample project for BuildProof.

## Requirements

- Node.js 18 or later
- npm

## Installation

```bash
npm ci
```

> **Note:** If installation fails, make sure your `package-lock.json` is in sync
> with `package.json`. You can regenerate it with:
>
> ```bash
> npm install
> ```
>
> Then commit the updated lockfile and try again.

## Running the application

```bash
node index.js
```

Expected output:

```
Hello, World!
```

## Running the tests

```bash
npm test
```

# BuildProof — Project Handover Readiness Checker

BuildProof helps developers check whether a software project is ready to be handed over to another developer. It analyzes project files, checks setup requirements, runs supported tests in Docker, and generates reports showing potential issues and what needs to be fixed.

## Problem Statement

A project may work on the original developer's machine but fail when someone else tries to run it. This can happen because of missing dependencies, incorrect configuration, failing tests, or incomplete setup instructions.

BuildProof aims to identify these problems before the project is handed over, making the transition easier for the next developer.

## Features

- Upload software projects as ZIP files for analysis.
- Detect and analyze supported Node.js and Python projects.
- Check project structure, dependencies, configuration, and tests.
- Run supported commands inside Docker containers.
- Generate HTML and JSON reports containing scan results and findings.
- View previous scans through scan history.
- Provide information about detected issues and possible fixes.

## Tech Stack

| Component | Technology |
|---|---|
| Frontend | React, Vite, Tailwind CSS |
| Backend | Node.js, Express |
| Project analysis | Custom scanner and language adapters |
| Execution environment | Docker |
| Supported ecosystems | Node.js and Python |

## How It Works

1. The developer uploads a project ZIP file.
2. BuildProof extracts and analyzes the project files.
3. The scanner identifies the project type and selects the appropriate language adapter.
4. It checks the project configuration and runs supported commands in a Docker container.
5. The results are collected and used to generate a report.
6. The developer reviews the findings and addresses any issues before handing over the project.

## Security

BuildProof uses Docker to isolate project execution and includes safeguards designed to reduce the risks of running untrusted code. These include restricted container privileges, resource limits, execution timeouts, and disabled network access during the test phase.

Docker isolation does not eliminate every security risk. The implementation and configuration of these safeguards should be reviewed before using BuildProof with untrusted projects.

## Getting Started

### Prerequisites

Install the following:

- [Node.js 20](https://nodejs.org/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Git](https://git-scm.com/)

Docker Desktop should be running before starting scans that require Docker.

### 1. Clone the repository

```bash
git clone https://github.com/Sinha-RISHI/BuildProof.git
cd BuildProof
```

### 2. Start the backend

Open a terminal in the project directory and run:

```bash
cd server
npm install
npm run dev
```

The backend is configured to use port `4000`.

Health check: `http://localhost:4000/api/health`

### 3. Start the frontend

Open a second terminal in the project directory and run:

```bash
cd client
npm install
npm run dev
```

Open the local URL displayed in the terminal. Vite commonly uses `http://localhost:5173`.

Check the respective `package.json` files if the available scripts or ports differ.

## Sample Projects

The `samples/` directory contains example projects and ZIP files for testing different scenarios, including:

- Projects that pass their configured checks.
- Projects with failing tests.
- Projects with missing setup requirements.
- Projects without tests.
- Projects with dependency lockfile mismatches.

Python samples are also included to test the Python adapter. Actual results should be verified by running each sample through BuildProof.

## Project Structure

```text
BuildProof/
├── client/                 # Frontend application
├── server/                 # Backend API and scanning logic
│   ├── src/
│   │   └── services/
│   │       ├── adapters/   # Language-specific adapters
│   │       ├── scanner.js
│   │       ├── dockerRunner.js
│   │       ├── report.js
│   │       └── scanStore.js
│   ├── scripts/            # Utility scripts
│   └── tests/               # Backend tests
├── samples/                 # Sample projects and ZIP files
├── Stitch-References/       # UI design references
├── ARCHITECTURE.md          # Technical architecture
└── README.md
```

## Reports

BuildProof generates HTML and JSON reports containing the results of its configured checks. Depending on the scan, these may include project information, setup and dependency findings, test results, command output, warnings, and suggested fixes.

The readiness result is based on the checks performed. A successful scan does not guarantee that a project is completely secure or free of defects.

## Future Improvements

- Support for more programming languages and frameworks.
- Additional project configuration and dependency checks.
- Better comparison of results across scans.
- Further improvements to sandbox security.
- Integration with continuous integration workflows.

## Team

Developed by Team Green for the Code Yudh Hackathon at Chandigarh University.

## License

No license has been added yet. Until a license is specified, users should not assume they have permission to redistribute or reuse this project.

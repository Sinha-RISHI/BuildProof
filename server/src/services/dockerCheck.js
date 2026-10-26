/**
 * services/dockerCheck.js
 *
 * What this file does:
 *   Runs the "docker version" command as a separate process and reports back
 *   whether Docker is reachable on this machine.
 *
 * How it fits into BuildProof:
 *   The /api/health endpoint calls checkDocker() so the frontend (and we as
 *   developers) know immediately if Docker is missing or not running.
 *   Without Docker, no project can be verified inside the sandbox.
 *
 * Security note (from ARCHITECTURE.md §9):
 *   We ALWAYS pass arguments as an array to spawn(), never as one long shell
 *   string. This prevents path spaces (e.g. "C:\Users\My Name\...") from
 *   being misread, and prevents any uploaded text from becoming a shell command.
 */

import { spawn } from 'child_process';

/**
 * checkDocker()
 *
 * Runs: docker version --format {{.Server.Version}}
 * Returns an object with three fields:
 *   - reachable {boolean}  true if Docker responded normally
 *   - version  {string|null}  the Docker server version, or null on failure
 *   - error    {string|null}  a plain-English problem description, or null on success
 *
 * This function NEVER throws and NEVER leaves its promise unresolved.
 * Every code path leads to a return.
 */
export async function checkDocker() {
  return new Promise((resolve) => {
    // Track whether we have already resolved, so we don't resolve twice
    // (both an 'error' event and a 'close' event can fire in some failure cases)
    let settled = false;

    function settle(result) {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    }

    // Spawn the docker process.
    // We pass arguments as an ARRAY, never as a string — see security note above.
    const child = spawn('docker', ['version', '--format', '{{.Server.Version}}']);

    let stdout = '';
    let stderr = '';

    // Collect all text that docker prints to its normal output channel
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    // Collect all text that docker prints to its error/warning channel
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    // Set a 5-second deadline. If docker hasn't answered by then, kill it.
    const timer = setTimeout(() => {
      child.kill();
      settle({
        reachable: false,
        version: null,
        error: 'Docker did not respond in time.',
      });
    }, 5000);

    // 'error' fires when the OS cannot even start the process
    // (e.g. the docker program is not installed or not on PATH)
    child.on('error', (err) => {
      clearTimeout(timer);
      if (err.code === 'ENOENT') {
        settle({
          reachable: false,
          version: null,
          error: 'Docker is not installed or not on PATH.',
        });
      } else {
        settle({
          reachable: false,
          version: null,
          error: `Could not start docker process: ${err.message}`,
        });
      }
    });

    // 'close' fires when the process has finished (successfully or not)
    child.on('close', (exitCode) => {
      clearTimeout(timer);

      if (exitCode === 0) {
        // docker responded and reported its version
        settle({
          reachable: true,
          version: stdout.trim(),
          error: null,
        });
      } else {
        // docker ran but something is wrong — inspect stderr for a helpful message
        const stderrLower = stderr.toLowerCase();
        const engineNotRunning =
          stderrLower.includes('is not running') ||
          stderrLower.includes('cannot connect') ||
          stderrLower.includes('error during connect') ||
          stderrLower.includes('does not seem to be running') ||
          stderrLower.includes('pipe') && stderrLower.includes('open');

        let errorMessage;
        if (engineNotRunning) {
          errorMessage =
            'Docker is installed but the engine is not running. Start Docker Desktop.';
        } else {
          // Use the first line of stderr, trimmed, capped at 200 characters
          const firstLine = stderr.trim().split('\n')[0].trim();
          errorMessage = firstLine.slice(0, 200) || 'docker exited with an unexpected error.';
        }

        settle({
          reachable: false,
          version: null,
          error: errorMessage,
        });
      }
    });
  });
}

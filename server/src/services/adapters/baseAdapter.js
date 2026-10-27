/**
 * services/adapters/baseAdapter.js
 *
 * What this file does:
 *   Base class defining the standard interface for project ecosystem adapters.
 */

export class BaseAdapter {
  constructor(id, displayName, defaultImage, containerUser) {
    this.id = id;
    this.displayName = displayName;
    this.defaultImage = defaultImage;
    this.containerUser = containerUser;
  }

  /**
   * inspect(projectDir, rootEntries, helpers)
   * Runs static file inspection on the project.
   */
  async inspect(projectDir, rootEntries, helpers) {
    throw new Error('BaseAdapter.inspect must be implemented by subclass.');
  }

  /**
   * getInstallCommand(metadata, rootEntries)
   * Returns container execution configuration for dependency installation.
   */
  getInstallCommand(metadata, rootEntries) {
    throw new Error('BaseAdapter.getInstallCommand must be implemented by subclass.');
  }

  /**
   * getTestCommand(metadata, rootEntries)
   * Returns container execution configuration for test execution.
   */
  getTestCommand(metadata, rootEntries) {
    throw new Error('BaseAdapter.getTestCommand must be implemented by subclass.');
  }

  /**
   * getBuildCommand(metadata, rootEntries)
   * Optional build step; returns null if not configured/needed.
   */
  getBuildCommand(metadata, rootEntries) {
    return null;
  }

  /**
   * analyzeInstallFailure(output, exitCode, timedOut)
   * Analyzes installation output and returns { explanation, nextStep }.
   */
  analyzeInstallFailure(output, exitCode, timedOut) {
    return {
      explanation: `Dependency installation exited with code ${exitCode}.`,
      nextStep: 'Inspect the installation logs for missing dependencies or build errors.',
    };
  }

  /**
   * analyzeTestFailure(output, exitCode, timedOut)
   * Analyzes test execution output and returns { explanation, nextStep }.
   */
  analyzeTestFailure(output, exitCode, timedOut) {
    return {
      explanation: `Test execution exited with code ${exitCode}. One or more tests failed.`,
      nextStep: 'Inspect the test execution logs and resolve failing assertions.',
    };
  }
}

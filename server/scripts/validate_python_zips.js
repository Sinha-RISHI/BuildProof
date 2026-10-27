import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { extractZip } from '../src/services/extract.js';
import { scanProject } from '../src/services/scanner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SAMPLES_DIR = path.resolve(__dirname, '../../samples');

const archives = [
  { name: 'python-good-app.zip', expectedVerdict: 'ready' },
  { name: 'python-failing-tests.zip', expectedVerdict: 'not_ready' },
  { name: 'python-no-tests.zip', expectedVerdict: 'partially_verified' },
];

async function validateArchive({ name, expectedVerdict }) {
  console.log(`\n========================================`);
  console.log(`Validating archive: ${name}`);
  const zipPath = path.join(SAMPLES_DIR, name);
  const stat = fs.statSync(zipPath);
  console.log(`  Size: ${stat.size} bytes (limit 50MB)`);
  if (stat.size > 50 * 1024 * 1024) throw new Error('File size exceeds upload limit');

  const tmpExtractDir = fs.mkdtempSync(path.join(os.tmpdir(), `buildproof-validate-${name}-`));

  try {
    const extractResult = await extractZip(zipPath, tmpExtractDir);
    console.log(`  Extraction: Success (${extractResult.entryCount} entries extracted, ${extractResult.totalBytes} bytes)`);

    // Verify root files
    const rootFiles = fs.readdirSync(tmpExtractDir);
    console.log(`  Root entries:`, rootFiles);
    if (!rootFiles.includes('pyproject.toml') && !rootFiles.includes('requirements.txt')) {
      throw new Error('Project manifest missing at extraction root');
    }

    // Run static scan
    const scanResult = await scanProject(tmpExtractDir);
    console.log(`  Ecosystem: ${scanResult.ecosystem}`);
    console.log(`  Checks performed: ${scanResult.checks.length}`);
    for (const c of scanResult.checks) {
      console.log(`    - [${c.status}] ${c.id}: ${c.title || c.id}`);
    }

    if (scanResult.ecosystem !== 'python') {
      throw new Error(`Expected ecosystem python, got ${scanResult.ecosystem}`);
    }
  } finally {
    fs.rmSync(tmpExtractDir, { recursive: true, force: true });
  }
}

async function run() {
  for (const archive of archives) {
    await validateArchive(archive);
  }
  console.log('\nAll archives validated cleanly against BuildProof extraction and scanner.');
}

run().catch((err) => {
  console.error('Validation failed:', err);
  process.exit(1);
});

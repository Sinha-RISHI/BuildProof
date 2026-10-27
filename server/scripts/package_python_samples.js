import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildZip } from '../tests/zipBuilder.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SAMPLES_DIR = path.resolve(__dirname, '../../samples');

function collectFiles(dir, baseDir = dir) {
  const entries = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    if (item.name === '__pycache__' || item.name === '.deps' || item.name === '.git') {
      continue;
    }
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      entries.push(...collectFiles(fullPath, baseDir));
    } else if (item.isFile()) {
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      entries.push({
        name: relPath,
        data: fs.readFileSync(fullPath),
      });
    }
  }
  return entries;
}

function packageSample(sampleName, zipNames) {
  const sampleDir = path.join(SAMPLES_DIR, sampleName);
  const entries = collectFiles(sampleDir);
  console.log(`Packaging ${sampleName} (${entries.length} files):`);
  for (const e of entries) {
    console.log(`  - ${e.name} (${e.data.length} bytes)`);
  }
  const zipBuffer = buildZip(entries);
  for (const zipName of zipNames) {
    const zipPath = path.join(SAMPLES_DIR, zipName);
    fs.writeFileSync(zipPath, zipBuffer);
    console.log(`-> Wrote ${zipPath} (${zipBuffer.length} bytes)`);
  }
}

packageSample('python-good-app', ['python-good-app.zip']);
packageSample('python-failing-tests', ['python-failing-tests.zip', 'python-failing-test.zip']);
packageSample('python-no-tests', ['python-no-tests.zip']);

console.log('All Python sample packages generated successfully.');

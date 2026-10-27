import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SAMPLES_DIR = path.resolve(__dirname, '../../samples');
const BASE_URL = 'http://localhost:4000';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function uploadAndScan(zipFileName) {
  console.log(`\n======================================================`);
  console.log(`Starting E2E Scan for: ${zipFileName}`);
  console.log(`======================================================`);

  const zipPath = path.join(SAMPLES_DIR, zipFileName);
  const fileBytes = fs.readFileSync(zipPath);
  const blob = new Blob([fileBytes], { type: 'application/zip' });

  const formData = new FormData();
  formData.append('project', blob, zipFileName);

  // 1. Upload ZIP
  const uploadRes = await fetch(`${BASE_URL}/api/scans`, {
    method: 'POST',
    body: formData,
  });

  if (!uploadRes.ok) {
    const errorBody = await uploadRes.text();
    throw new Error(`Upload failed with status ${uploadRes.status}: ${errorBody}`);
  }

  const initialScan = await uploadRes.json();
  const scanId = initialScan.id || initialScan.scanId;
  console.log(`Uploaded successfully. Scan ID: ${scanId}, Initial status: ${initialScan.status}`);

  // 2. Poll until completed or failed
  let scanRecord = null;
  const startTime = Date.now();
  const timeoutMs = 60000;

  while (Date.now() - startTime < timeoutMs) {
    await sleep(1000);
    const pollRes = await fetch(`${BASE_URL}/api/scans/${scanId}`);
    if (!pollRes.ok) throw new Error(`Poll failed: ${pollRes.status}`);
    scanRecord = await pollRes.json();
    console.log(`  [${Math.round((Date.now() - startTime) / 1000)}s] Status: ${scanRecord.status}`);
    if (scanRecord.status === 'done' || scanRecord.status === 'error') {
      break;
    }
  }

  if (!scanRecord || (scanRecord.status !== 'done' && scanRecord.status !== 'error')) {
    throw new Error(`Scan ${scanId} timed out after 60s`);
  }

  console.log(`\nScan Finished. Verdict: ${scanRecord.verdict}, Ecosystem: ${scanRecord.ecosystem}`);

  // 3. Inspect checks
  const checks = scanRecord.checks || [];
  console.log(`Checks (${checks.length}):`);
  for (const c of checks) {
    console.log(`  - [${c.status}] ${c.id}: ${c.title || c.id} (critical: ${c.critical})`);
    if (c.id === 'test-script' || c.id === 'tests' || c.id === 'install') {
      if (c.command) console.log(`      Command: ${c.command}`);
      if (c.output) {
        const preview = c.output.trim().split('\n').slice(0, 5).join('\n      ');
        console.log(`      Output Preview:\n      ${preview}`);
      }
    }
  }

  // 4. Download and inspect JSON report
  const jsonRes = await fetch(`${BASE_URL}/api/scans/${scanId}/report.json`);
  if (!jsonRes.ok) throw new Error(`Failed to fetch report.json: ${jsonRes.status}`);
  const reportJson = await jsonRes.json();
  console.log(`\nJSON Report Verified:`);
  console.log(`  - Ecosystem: ${reportJson.ecosystem}`);
  console.log(`  - Verdict: ${reportJson.verdict}`);
  console.log(`  - Summary: ${JSON.stringify(reportJson.summary)}`);
  console.log(`  - Environment Image: ${reportJson.environment?.image}`);
  console.log(`  - Environment Python: ${reportJson.environment?.python}`);

  // 5. Fetch HTML report
  const htmlRes = await fetch(`${BASE_URL}/api/scans/${scanId}/report.html`);
  if (!htmlRes.ok) throw new Error(`Failed to fetch report.html: ${htmlRes.status}`);
  const htmlReport = await htmlRes.text();
  console.log(`HTML Report Verified: Length = ${htmlReport.length} chars, Contains DOCTYPE: ${htmlReport.includes('<!DOCTYPE html>')}`);

  return {
    scanId,
    verdict: scanRecord.verdict,
    ecosystem: scanRecord.ecosystem,
    checks: scanRecord.checks,
    reportJson,
  };
}

async function run() {
  const goodResult = await uploadAndScan('python-good-app.zip');
  const failingResult = await uploadAndScan('python-failing-tests.zip');
  const noTestsResult = await uploadAndScan('python-no-tests.zip');
  const nodeResult = await uploadAndScan('good-app.zip');
  const nodeFailingResult = await uploadAndScan('failing-test.zip');
  const missingSetupResult = await uploadAndScan('no-tests-no-readme.zip');

  console.log('\n======================================================');
  console.log('SUMMARY OF END-TO-END VERIFICATION (6 PROJECTS):');
  console.log('======================================================');
  console.log(`1. python-good-app.zip:`);
  console.log(`   - Ecosystem: ${goodResult.ecosystem}, Verdict: ${goodResult.verdict} (Expected: ready)`);
  console.log(`2. python-failing-tests.zip:`);
  console.log(`   - Ecosystem: ${failingResult.ecosystem}, Verdict: ${failingResult.verdict} (Expected: not_ready)`);
  console.log(`3. python-no-tests.zip:`);
  console.log(`   - Ecosystem: ${noTestsResult.ecosystem}, Verdict: ${noTestsResult.verdict} (Expected: partially_verified)`);
  console.log(`4. good-app.zip (Node.js):`);
  console.log(`   - Ecosystem: ${nodeResult.ecosystem}, Verdict: ${nodeResult.verdict} (Expected: ready)`);
  console.log(`5. failing-test.zip (Node.js):`);
  console.log(`   - Ecosystem: ${nodeFailingResult.ecosystem}, Verdict: ${nodeFailingResult.verdict} (Expected: not_ready)`);
  console.log(`6. no-tests-no-readme.zip (Node.js missing setup):`);
  console.log(`   - Ecosystem: ${missingSetupResult.ecosystem}, Verdict: ${missingSetupResult.verdict} (Expected: partially_verified)`);

  if (
    goodResult.verdict === 'ready' &&
    failingResult.verdict === 'not_ready' &&
    noTestsResult.verdict === 'partially_verified' &&
    nodeResult.verdict === 'ready' &&
    nodeFailingResult.verdict === 'not_ready' &&
    missingSetupResult.verdict === 'partially_verified'
  ) {
    console.log('\n>>> ALL 6 SAMPLE PROJECTS VERIFIED END-TO-END WITH ACCURATE VERDICTS & REPORTS! <<<');
  } else {
    throw new Error('One or more scan verdicts did not match expectations.');
  }
}

run().catch((err) => {
  console.error('\nE2E Verification Error:', err);
  process.exit(1);
});

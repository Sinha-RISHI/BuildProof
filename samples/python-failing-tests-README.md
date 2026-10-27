# Python Failing Tests Sample — Intentional Failure Documentation

**Sample Location:** `samples/python-failing-tests/`  
**Archive:** `samples/python-failing-tests.zip`

## Purpose

This sample project is constructed specifically for testing BuildProof's multi-language verification pipeline when a project contains valid code, valid dependency manifests, valid project detection, but fails automated test execution.

## Intentional Failure Specification

- **File:** `tests/test_calculator.py`
- **Method:** `test_intentional_failure`
- **Assertion:** `self.assertEqual(multiply(2, 2), 5, "Intentional failure: expected 2 * 2 == 5 to fail")`
- **Expected Outcome:**
  - Python project detection succeeds (`ecosystem: 'python'`).
  - Manifest checks succeed (`pyproject.toml`, `requirements.txt`).
  - Dependency installation succeeds (exit code 0).
  - Test runner executes inside the isolated Docker sandbox (`--network none`).
  - `unittest` runner exits with non-zero exit code `1` due to `AssertionError: 4 != 5 : Intentional failure: expected 2 * 2 == 5 to fail`.
  - BuildProof flags the `test-script` check as `Failed`.
  - Overall project verdict is marked as `not_ready` ("Not Ready for Handover").
  - The actual stderr/stdout traceback is preserved in the scan result and reports.

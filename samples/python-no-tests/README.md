# Calculator Utility (No Automated Tests Configured)

A deterministic arithmetic calculation utility written in Python. This repository provides core arithmetic helper functions but intentionally does not configure any automated test runner or test suites.

## Supported Python Version

- Python 3.11+

## Project Structure

```text
python-no-tests/
├── pyproject.toml         # Primary project manifest with metadata
├── requirements.txt       # Dependency manifest
├── .python-version        # Declared Python version target (3.11)
└── src/
    ├── __init__.py
    └── calculator.py      # Core arithmetic operations (add, subtract, multiply, divide)
```

## Note on Automated Testing

This sample project intentionally contains no automated test discovery files (`test*.py`) or test script definitions, enabling BuildProof verification of the "Not Verified" test status and `partially_verified` readiness verdict.

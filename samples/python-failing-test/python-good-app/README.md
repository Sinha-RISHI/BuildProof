# Calculator Utility (Python)

A deterministic, reproducible arithmetic calculation utility written in Python, designed for BuildProof project handover readiness verification.

## Supported Python Version

- Python 3.11+ (Runtime target: Python 3.11 LTS)

## Project Structure

```text
python-good-app/
├── pyproject.toml         # Primary project manifest with metadata
├── requirements.txt       # Pinned dependency manifest
├── .python-version        # Declared Python version target (3.11)
├── src/
│   ├── __init__.py
│   └── calculator.py      # Core arithmetic operations (add, subtract, multiply, divide)
└── tests/
    ├── __init__.py
    └── test_calculator.py # Automated unittest suite
```

## Installation Instructions

Install dependencies into your active virtual environment:

```bash
pip install -r requirements.txt
```

Or install the package in editable mode:

```bash
pip install -e .
```

## Running the Automated Tests

Execute the automated test suite using standard discovery:

```bash
python -m unittest discover -s . -p "test*.py"
```

All 5 test assertions cover addition, subtraction, multiplication, division, and strict division-by-zero validation.

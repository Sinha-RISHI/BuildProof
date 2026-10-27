import sys
from pathlib import Path
import unittest

# Ensure src/ is available on sys.path for direct execution and discovery
SRC_DIR = Path(__file__).resolve().parent.parent / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from calculator import add, subtract, multiply, divide

class TestCalculator(unittest.TestCase):
    def test_addition(self):
        self.assertEqual(add(2, 3), 5)
        self.assertEqual(add(-1, 1), 0)
        self.assertAlmostEqual(add(0.1, 0.2), 0.3, places=7)

    def test_subtraction(self):
        self.assertEqual(subtract(10, 4), 6)
        self.assertEqual(subtract(0, 5), -5)

    def test_multiplication(self):
        self.assertEqual(multiply(6, 7), 42)
        self.assertEqual(multiply(-3, 4), -12)
        self.assertEqual(multiply(5, 0), 0)

    def test_division(self):
        self.assertEqual(divide(10, 2), 5.0)
        self.assertEqual(divide(7, 2), 3.5)
        self.assertEqual(divide(-9, 3), -3.0)

    def test_division_by_zero(self):
        with self.assertRaises(ValueError) as ctx:
            divide(10, 0)
        self.assertIn("Division by zero", str(ctx.exception))

    def test_intentional_failure(self):
        """
        Intentional failure for BuildProof test suite verification.
        Asserts that 2 * 2 equals 5, which predictably fails and generates
        an AssertionError in the Docker test runner.
        """
        self.assertEqual(multiply(2, 2), 5, "Intentional failure: expected 2 * 2 == 5 to fail")

if __name__ == '__main__':
    unittest.main()

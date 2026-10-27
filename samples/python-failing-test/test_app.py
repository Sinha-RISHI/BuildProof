import unittest
from app import calculate

class TestApp(unittest.TestCase):
    def test_calculation(self):
        # Deliberately failing assertion to verify Docker test failure reporting
        self.assertEqual(calculate(5), 999)

if __name__ == '__main__':
    unittest.main()

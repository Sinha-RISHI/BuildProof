"""
Calculator Utility Module
Implements fundamental arithmetic functions with strict edge-case validation.
"""

from typing import Union

Number = Union[int, float]

def add(a: Number, b: Number) -> Number:
    """Returns the sum of a and b."""
    return a + b

def subtract(a: Number, b: Number) -> Number:
    """Returns the difference between a and b (a - b)."""
    return a - b

def multiply(a: Number, b: Number) -> Number:
    """Returns the product of a and b."""
    return a * b

def divide(a: Number, b: Number) -> float:
    """
    Returns the quotient of a divided by b (a / b).
    Raises ValueError if b is zero.
    """
    if b == 0:
        raise ValueError("Division by zero is not permitted.")
    return a / b

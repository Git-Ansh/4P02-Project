import math

# --- 1. Variables and Constants ---
# Use descriptive variable names (snake_case is standard in Python)
GREETING = "Welcome to the Calculator App!" # A constant (by convention, not enforced)
user_name = "Alice"
user_balance = 150.75
is_active = True

# --- 2. Function Definitions ---

def display_welcome_message():
    """Prints a welcome message using global variables."""
    print(f"{GREETING} Hello, {user_name}!")
    print(f"Current Balance: ${user_balance}\n")
    # Control Flow: If/Else
    if is_active:
        print("Status: Active User")
    else:
        print("Status: Inactive User")

def calculate_simple_interest(principal, rate, time):
    """
    Calculates the simple interest earned on a principal amount.

    Args:
        principal (float): The initial amount of money.
        rate (float): The annual interest rate (as a decimal, e.g., 0.05 for 5%).
        time (int/float): The time (in years).

    Returns:
        float: The total interest amount.
    """
    # Operation: Multiplication
    interest = principal * rate * time
    return round(interest, 2)

def print_multiplication_table(number, limit=5):
    """Prints a short multiplication table using a loop."""
    print(f"\n--- Multiplication Table for {number} (up to {limit}x) ---")
    # Control Flow: For loop and range
    for i in range(1, limit + 1):
        result = number * i
        # String Formatting (f-string)
        print(f"{number} x {i} = {result}")


# --- Main execution block ---
if __name__ == "__main__":
    # Calling the functions
    display_welcome_message()

    # Variables for function call
    initial_investment = 1000.0
    annual_rate = 0.04
    years = 3

    # Storing the returned value from a function call in a new variable
    interest_earned = calculate_simple_interest(initial_investment, annual_rate, years)

    print(f"\nAfter {years} years, the interest earned on ${initial_investment} at {annual_rate*100}% is: ${interest_earned}")

    # Calling the third function
    print_multiplication_table(number=7)
    # Using an imported module function
    print(f"\nThe square root of 81 is: {math.sqrt(81)}")

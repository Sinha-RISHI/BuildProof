import os

# Unhandled environment variable dependency without .env.example
database_url = os.environ['DATABASE_URL']
api_key = os.getenv('SECRET_API_KEY')

print(f"Connecting to {database_url}...")

Here are the instructions to run the Python backend locally without Docker:

  Prerequisites

  # Install Python 3.8+ if not already installed
  python3 --version

  # Install PostgreSQL locally (if not using Docker for Postgres)
  brew install postgresql  # macOS
  # or install from postgresql.org

  Setup Steps

  1. Set up PostgreSQL Database (if not using Docker)

  # Start PostgreSQL
  brew services start postgresql  # macOS

  # Create database and user
  psql postgres
  CREATE DATABASE webhook_db;
  CREATE USER webhook_user WITH PASSWORD 'webhook_password';
  GRANT ALL PRIVILEGES ON DATABASE webhook_db TO webhook_user;
  \q

  # Run migrations
  psql -h localhost -U webhook_user -d webhook_db -f
  database/migrations/001_initial_schema.sql
  psql -h localhost -U webhook_user -d webhook_db -f
  database/migrations/002_add_admin_users.sql
  # ... run all migration files

  2. Set up Python Environment

  cd backendpy

  # Create virtual environment
  python3 -m venv venv

  # Activate virtual environment
  source venv/bin/activate  # macOS/Linux
  # or
  venv\Scripts\activate  # Windows

  # Install dependencies
  pip install -r requirements.txt

  3. Configure Environment Variables

  # The .env file is already there, just verify:
  cat .env

  # Should have:
  # DATABASE_HOST=localhost
  # DATABASE_PORT=5432
  # KAFKA_ENABLED=true
  # KAFKA_BROKERS=localhost:9092

  4. Run the Server

  # Make sure you're in backendpy/ and venv is activated
  python3 local_server.py

  The server will start on http://localhost:3005

  Notes:

  - If using Docker for Postgres and Kafka only (recommended), keep those
  containers running
  - The Python backend connects to Postgres at localhost:5432 and Kafka at
  localhost:9092
  - To deactivate the virtual environment later: deactivate
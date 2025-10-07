# Python Backend Quick Start Guide

## Prerequisites
- Python 3.8 or higher
- PostgreSQL database running (shared with TypeScript backend)
- pip package manager

## Quick Setup

### 1. Navigate to Python Backend Directory
```bash
cd backendpy
```

### 2. Create and Activate Virtual Environment
```bash
# Create virtual environment
python3 -m venv venv

# Activate it
# On macOS/Linux:
source venv/bin/activate

# On Windows:
# venv\Scripts\activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Configure Environment Variables
```bash
# Copy the template
cp .env.template .env

# Edit .env with your database credentials
# The database should be the same one used by the TypeScript backend
```

### 5. Run the Server
```bash
python local_server.py
```

You should see output like:
```
======================================================================
Python Webhook Management System - Local Development Server
======================================================================
Server running on http://localhost:3005
PostgreSQL: localhost:5432

Available endpoints:
   POST   /api/v1/producers/onboard
   POST   /api/v1/admin/login
   GET    /health

Note: Other endpoints return 501 Not Implemented

Ready to accept requests!
======================================================================
```

## Test the API

### Health Check
```bash
curl http://localhost:3005/health
```

### Create Producer (if you have the database set up)
```bash
curl -X POST http://localhost:3005/api/v1/producers/onboard \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Producer",
    "contactEmail": "test@example.com",
    "description": "A test producer",
    "contactName": "Test User",
    "department": "Engineering"
  }'
```

### Admin Login (after creating an admin user in the database)
```bash
curl -X POST http://localhost:3005/api/v1/admin/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "your-password"
  }'
```

## Database Setup

The Python backend uses the same PostgreSQL database as the TypeScript backend. Ensure the database is properly initialized with the schema.

If you need to create an admin user for testing, you can use the TypeScript backend's endpoints or directly insert into the database.

## Troubleshooting

### Import Errors
If you see import errors, make sure:
1. You're in the `backendpy` directory
2. Virtual environment is activated
3. All dependencies are installed: `pip install -r requirements.txt`

### Database Connection Errors
Check your .env file:
- DATABASE_HOST is correct
- DATABASE_PORT is correct (default: 5432)
- DATABASE_NAME matches your database
- DATABASE_USER has proper permissions
- DATABASE_PASSWORD is correct

### Port Already in Use
If port 3005 is already in use, change it in your .env file:
```
API_PORT=3006
```

## Next Steps

1. Review the README.md for detailed documentation
2. Check IMPLEMENTATION_SUMMARY.md for architecture details
3. Implement additional Lambda handlers as needed
4. Add tests using pytest

## Development Tips

### Running with Debug Mode
The server runs with Flask's debug mode enabled by default, which provides:
- Auto-reload on code changes
- Detailed error messages
- Interactive debugger

### Code Formatting
```bash
# Format code
black .

# Check code style
flake8 .
```

### Running Tests (when implemented)
```bash
pytest
pytest --cov  # With coverage
```

## Deactivating Virtual Environment

When you're done:
```bash
deactivate
```

## Support

For issues or questions, refer to:
- README.md - Full documentation
- IMPLEMENTATION_SUMMARY.md - Architecture and design decisions
- TypeScript backend at `/backend/` - Reference implementation

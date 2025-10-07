# Python Backend File Structure

```
backendpy/
│
├── .env                          # Environment configuration (created from template)
├── .env.template                 # Environment variables template
├── __init__.py                   # Python package initializer
├── local_server.py              # Flask local development server (port 3005)
├── requirements.txt              # Python dependencies
│
├── README.md                     # Main documentation
├── QUICKSTART.md                 # Quick start guide
├── IMPLEMENTATION_SUMMARY.md    # Detailed implementation summary
├── FILE_STRUCTURE.md            # This file
│
├── lambda/                       # Lambda function handlers
│   ├── __init__.py
│   │
│   ├── producer_onboarding/     # Producer onboarding handler [IMPLEMENTED]
│   │   ├── __init__.py
│   │   └── handler.py           # Creates producers, generates API keys
│   │
│   ├── admin_auth/              # Admin authentication handler [IMPLEMENTED]
│   │   ├── __init__.py
│   │   └── handler.py           # Login, password verification
│   │
│   ├── schema_admin/            # Schema administration [READY FOR IMPLEMENTATION]
│   │
│   ├── subscription_admin/      # Subscription management [READY FOR IMPLEMENTATION]
│   │
│   ├── event_publisher/         # Event publishing [READY FOR IMPLEMENTATION]
│   │
│   ├── event_admin/             # Event administration [READY FOR IMPLEMENTATION]
│   │
│   └── admin_user_manager/      # Admin user management [READY FOR IMPLEMENTATION]
│
├── shared/                       # Shared utilities and models
│   ├── __init__.py
│   │
│   ├── models/                  # Database models
│   │   ├── __init__.py
│   │   ├── producer.py          # Producer CRUD operations
│   │   ├── admin.py             # Admin CRUD operations, password verification
│   │   ├── schema.py            # Schema operations [PLACEHOLDER]
│   │   └── subscription.py      # Subscription operations [PLACEHOLDER]
│   │
│   └── utils/                   # Utility functions
│       ├── __init__.py
│       ├── database.py          # PostgreSQL connection, pooling, query helpers
│       ├── response.py          # Response formatting, error handling, CORS
│       ├── validation.py        # Input validation, schema validation
│       └── crypto.py            # API key generation and hashing
│
└── handlers/                     # Additional handler files (legacy)
    ├── __init__.py
    ├── admin_auth.py
    └── admin_user_manager.py
```

## File Descriptions

### Root Level Files

- **.env** - Active environment configuration (gitignored)
- **.env.template** - Template for environment variables
- **local_server.py** - Flask application serving all endpoints
- **requirements.txt** - Python package dependencies

### Lambda Handlers (`lambda/`)

Each Lambda function is in its own directory with:
- `__init__.py` - Package marker
- `handler.py` - Main handler function

Currently implemented:
1. **producer_onboarding** - Producer registration
2. **admin_auth** - Admin login

Ready for implementation:
3. schema_admin
4. subscription_admin
5. event_publisher
6. event_admin
7. admin_user_manager

### Shared Models (`shared/models/`)

Database models with CRUD operations:

- **producer.py** - Full implementation
  - create_producer()
  - get_producer_by_id()
  - get_producer_by_api_key()
  - list_producers()
  - update_producer()
  - increment_event_published_count()
  - increment_schema_registered_count()

- **admin.py** - Full implementation
  - create_admin()
  - get_admin_by_id()
  - get_admin_by_email()
  - get_admin_by_api_key()
  - list_admins()
  - update_admin()
  - verify_admin_password()
  - update_admin_last_login()

- **schema.py** - Placeholder
- **subscription.py** - Placeholder

### Shared Utilities (`shared/utils/`)

- **database.py** - Database connectivity
  - initialize_database() - Set up connection pool
  - get_pool() - Get connection pool
  - get_db_connection() - Context manager for connections
  - get_db_cursor() - Context manager for cursors
  - query() - Execute SELECT queries
  - query_one() - Execute query, return single result
  - execute() - Execute INSERT/UPDATE/DELETE
  - close_database() - Clean up connections
  - build_where_clause() - Dynamic WHERE clause builder
  - build_pagination_clause() - LIMIT/OFFSET builder
  - build_order_by_clause() - ORDER BY builder

- **response.py** - Response formatting
  - success_response() - Success JSON response
  - error_response() - Error JSON response
  - ErrorResponses class with methods:
    - bad_request()
    - unauthorized()
    - forbidden()
    - not_found()
    - conflict()
    - unprocessable_entity()
    - rate_limit_exceeded()
    - internal_server_error()
    - service_unavailable()
  - paginated_response() - Paginated list response
  - cors_preflight_response() - CORS OPTIONS response

- **validation.py** - Input validation
  - validate_schema() - JSON schema validation
  - validate_webhook_payload()
  - is_valid_url()
  - validate_webhook_config()
  - sanitize_string()
  - validate_pagination()
  - is_valid_email()
  - is_valid_uuid()

- **crypto.py** - Cryptographic operations
  - generate_api_key() - Generate random API key
  - hash_api_key() - SHA256 hash of API key

## Import Paths

From lambda handlers:
```python
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))

from shared.models.producer import create_producer
from shared.utils.response import success_response, ErrorResponses
```

From local_server.py:
```python
import sys
sys.path.insert(0, os.path.dirname(__file__))

from lambda.producer_onboarding.handler import handler as producer_handler
```

## Dependencies (requirements.txt)

### Core
- Flask==3.0.0
- psycopg2-binary==2.9.9
- python-dotenv==1.0.0

### Security
- bcrypt==4.1.2

### Validation
- jsonschema==4.20.0

### HTTP
- requests==2.31.0
- flask-cors==4.0.0

### Optional (for production)
- boto3==1.34.10 (AWS SDK)
- kafka-python==2.0.2 (Kafka client)

### Development
- pytest==7.4.3
- pytest-cov==4.1.0
- black==23.12.1
- flake8==7.0.0

## Configuration (.env)

```bash
# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=webhook_db
DATABASE_USER=webhook_user
DATABASE_PASSWORD=webhook_password

# API
API_PORT=3005

# Environment
NODE_ENV=development
```

## API Endpoints (local_server.py)

### Implemented:
- POST /api/v1/producers/onboard
- POST /api/v1/admin/login
- GET /health

### Placeholder (501 Not Implemented):
- Schema: register, list, marketplace, details, validate
- Subscription: subscribe, list, details, update, delete
- Events: publish, list
- Admin Users: CRUD operations
- Subscribers: list, update
- Stats: delivery stats, DLQ

## Notes

- All `__init__.py` files are empty package markers
- Python modules use relative imports: `from ..utils.database import query`
- Lambda handlers are compatible with AWS Lambda event structure
- Flask server wraps Lambda handlers for local development
- Database connection uses pooling for performance
- All responses include CORS headers
- Environment variables control behavior

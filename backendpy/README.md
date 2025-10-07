# Python Backend for Webhook Management System

This is a Python implementation of the webhook management backend, mirroring the TypeScript backend functionality.

## Structure

```
backendpy/
├── lambda/                    # Lambda function handlers
│   ├── producer_onboarding/   # Producer onboarding
│   ├── schema_admin/          # Schema administration
│   ├── subscription_admin/    # Subscription management
│   ├── event_publisher/       # Event publishing
│   ├── event_admin/           # Event administration
│   ├── admin_user_manager/    # Admin user management
│   └── admin_auth/            # Admin authentication
├── shared/                    # Shared utilities and models
│   ├── models/                # Database models
│   │   ├── producer.py
│   │   ├── schema.py
│   │   ├── subscription.py
│   │   └── admin.py
│   └── utils/                 # Utility functions
│       ├── database.py        # PostgreSQL connection
│       ├── response.py        # Response helpers
│       ├── validation.py      # Validation utilities
│       └── crypto.py          # Cryptographic functions
├── local_server.py            # Flask development server
├── requirements.txt           # Python dependencies
└── .env.template              # Environment variables template

## Setup

### 1. Create Virtual Environment

```bash
cd backendpy
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure Environment

```bash
cp .env.template .env
# Edit .env with your local settings
```

### 4. Run the Server

```bash
python local_server.py
```

The server will start on port 3005 (configurable via API_PORT in .env).

## API Endpoints

### Producer Onboarding
- `POST /api/v1/producers/onboard` - Onboard a new producer

### Admin Authentication  
- `POST /api/v1/admin/login` - Admin login

### Schema Management
- `POST /api/v1/schemas/register` - Register a schema (Not yet implemented)
- `GET /api/v1/schemas` - List schemas (Not yet implemented)
- `GET /api/v1/schemas/marketplace` - List public schemas (Not yet implemented)
- `GET /api/v1/schemas/:id` - Get schema details (Not yet implemented)
- `POST /api/v1/schemas/:id/validate` - Validate payload (Not yet implemented)

### Subscription Management
- `POST /api/v1/subscriptions/subscribe` - Create subscription (Not yet implemented)
- `GET /api/v1/subscriptions` - List subscriptions (Not yet implemented)
- `GET /api/v1/subscriptions/:id` - Get subscription details (Not yet implemented)
- `PATCH /api/v1/subscriptions/:id` - Update subscription (Not yet implemented)
- `DELETE /api/v1/subscriptions/:id` - Cancel subscription (Not yet implemented)

### Event Publishing
- `POST /api/v1/events/publish` - Publish event (Not yet implemented)
- `GET /api/v1/events` - List events (Not yet implemented)

### Admin User Management
- `POST /api/v1/admin/users` - Create admin user (Not yet implemented)
- `GET /api/v1/admin/users` - List admin users (Not yet implemented)
- `GET /api/v1/admin/users/:id` - Get admin user (Not yet implemented)
- `PATCH /api/v1/admin/users/:id` - Update admin user (Not yet implemented)
- `DELETE /api/v1/admin/users/:id` - Delete admin user (Not yet implemented)

### Health Check
- `GET /health` - Health check endpoint

## Database

The Python backend uses the same PostgreSQL database as the TypeScript backend. Ensure the database is running and properly configured in your .env file.

## Development Notes

- This implementation uses Flask for the local development server
- Database access is handled via psycopg2
- The code structure mirrors the TypeScript backend for consistency
- Lambda handlers can be deployed to AWS Lambda if needed
- Currently, only producer onboarding and admin authentication are fully implemented
- Other endpoints return 501 Not Implemented status

## Running Tests

```bash
pytest
```

## Code Formatting

```bash
black .
flake8 .
```

## Comparison with TypeScript Backend

| Feature | TypeScript | Python |
|---------|-----------|--------|
| Web Framework | Express | Flask |
| Database Driver | pg | psycopg2 |
| Password Hashing | bcryptjs | bcrypt |
| Port | 3000 | 3005 |
| Lambda Support | Yes | Yes |
| Schema Validation | ajv | jsonschema |

## TODO

- [ ] Implement remaining Lambda handlers (schema_admin, subscription_admin, event_publisher, etc.)
- [ ] Add comprehensive error handling
- [ ] Add request validation middleware
- [ ] Implement Kafka integration
- [ ] Add AWS SDK integration for production deployment
- [ ] Add comprehensive test coverage
- [ ] Add API documentation (Swagger/OpenAPI)

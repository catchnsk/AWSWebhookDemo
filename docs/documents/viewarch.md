hat the Diagram Shows:

Components:

1. Frontend Layer
   - CloudFront CDN
   - S3 for React app hosting
2. API Layer
   - API Gateway
   - 7 Lambda functions (Admin Auth, Schemas, Subscriptions, Events, Producer Onboarding, User Management,
   Webhook Delivery Worker)
3. Data Layer
   - RDS PostgreSQL (schemas, events, subscriptions, delivery queue)
   - S3 for logs/backups
4. Delivery System
   - SQS Queue for webhook delivery
   - Lambda worker triggered by SQS
   - Dead Letter Queue (DLQ) for failed deliveries
5. Monitoring
   - CloudWatch for logs and metrics
   - EventBridge for event routing

Flow:

1. Admin users → CloudFront → S3 (UI)
2. Producers/Admins → API Gateway → Lambda functions → RDS
3. Event published → SQS → Lambda Delivery Worker → Subscriber webhooks (HTTP POST with HMAC)
4. Failed deliveries → DLQ for manual review

The diagram is fully editable in draw.io if you want to customize colors, add more details, or adjust the
layout!
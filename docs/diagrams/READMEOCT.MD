Webhook Event Processing Platform
This project implements an event-driven webhook delivery system with schema validation, subscription management, and delivery tracking.
The system is designed to run on AWS (Lambda + RDS + SQS/SNS/Kafka) with a PostgreSQL backend and a lightweight UI for administration.

🚀 Features
•	Schema Registry – Register and validate webhook schemas
•	Webhook Subscription API – Subscribe clients to events with endpoint details
•	Message Ingestion API – Receive and validate events against registered schemas
•	In-Memory Queue / Kafka – Event processing pipeline (lightweight or Kafka mode)
•	Delivery API – Send events to subscribed endpoints with retries & backoff
•	Retry Mechanism – Automatic exponential retry for failed deliveries
•	Delivery Status API – Query and update event delivery status
•	Event Storage – Store schemas, subscriptions, events, and delivery history in PostgreSQL
•	Admin UI – Manage schemas, subscriptions, and monitor event delivery

•	AWS Lambda – Event ingestion, delivery, retry workers
•	Kafka (or SQS/SNS) – Event streaming backbone
•	PostgreSQL (RDS) – Persistent storage for schemas, subscriptions, and event delivery logs
•	UI (React/Angular) – Admin portal for schema & subscription management

⚙️ Setup
1. Prerequisites
   •	AWS Account with Lambda, RDS, API Gateway, IAM
   •	PostgreSQL (AWS RDS preferred)
   •	Kafka cluster (optional if not using SQS/SNS)
   •	Node.js / Java (for APIs)
   •	Terraform or CloudFormation for infra automation
2. Infra Setup
1.	Deploy PostgreSQL RDS with schemas
2.	Set up Kafka cluster (or AWS MSK / SQS+SNS alternative)
3.	Deploy AWS Lambda functions via CI/CD pipeline
4.	Configure IAM roles & security groups
5.	Provision CloudWatch metrics & alarms
3. Build & Deployment
   •	Code is packaged and deployed via CI/CD (Jenkins/GitHub Actions)
   •	Follows CSO approval and CR process before deployment
   •	Environments: dev → qa → staging → prod

📅 Project Plan (Oct 16, 2024 – Feb 15, 2025)
•	Oct – Nov: Governance approvals, CR, build pipeline, infra setup
•	Nov – Dec: Kafka & Lambda deployment, DB setup
•	Dec – Jan: Core APIs (Schema, Subscription, Delivery, Retry)
•	Jan – Feb: UI development & Delivery status dashboard
•	Feb: Stabilization & Go-Live

✅ Acceptance Criteria
•	Schemas can be registered via API/UI and validated against payloads
•	Subscriptions can be created, updated, and deleted
•	Ingested events are validated and pushed into Kafka/Queue
•	Delivery API sends webhooks and retries on failures with exponential backoff
•	Delivery status can be queried via API and UI
•	PostgreSQL persists all schemas, events, subscriptions, and delivery history
•	UI allows schema registration, subscription management, and delivery monitoring

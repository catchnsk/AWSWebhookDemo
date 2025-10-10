# AWS Prod Rollout Plan (Lambda + API Gateway + RDS PostgreSQL)

### 1) Target Architecture

- **Compute**: AWS Lambda (Python 3.12) for `backendpy` app; additional Lambda for background worker from `backendpy/webhook_delivery_worker.py`.
- **API**: Amazon API Gateway HTTP API with custom domain and stage `prod`.
- **DB**: Amazon RDS PostgreSQL (db.t4g.micro or db.t4g.small), Multi-AZ disabled initially to reduce cost; enable later.
- **Queue/Async**: Amazon SQS for webhook delivery queue; Lambda consumer as worker.
- **Storage/Config**: AWS Secrets Manager for DB creds; S3 for assets/backups; Parameter Store for non-secret configs.
- **Networking**: VPC with 2 public + 2 private subnets; RDS in private; Lambdas in private subnets with NAT Gateway (or VPC endpoints if no public egress needed).
- **Observability**: CloudWatch Logs, X-Ray tracing, metric alarms; structured JSON logs.
- **Security**: Least-privilege IAM roles per Lambda; SG allow-list; KMS for Secrets and RDS storage.

### 2) Infrastructure as Code (Terraform)

Create a new module under `infra/terraform/`:

- `vpc.tf`: VPC, subnets, route tables, NAT (1 NAT for cost), VPC endpoints (Secrets, SQS, CloudWatch, S3) to reduce NAT egress.
- `rds.tf`: PostgreSQL instance, subnet group, SGs, parameter group, backups (7 days), KMS encryption, `db.t4g.micro`.
- `api.tf`: API Gateway HTTP API, routes, integrations to Lambdas, stage `prod`, throttling.
- `lambda.tf`: Two Lambdas (api, worker), IAM roles/policies, env vars, VPC config, X-Ray.
- `sqs.tf`: Standard queue + DLQ for webhook deliveries; redrive policy.
- `secrets.tf`: Secrets Manager secret for DB credentials; rotation optional.
- `acm_route53.tf`: ACM cert (us-east-1 for API GW), Route53 A/AAAA alias records for custom domain.
- `cloudwatch.tf`: Log groups, metric filters, alarms (errors, DLQ depth, RDS CPU/Storage), SNS notifications.
- `variables.tf`, `outputs.tf`, `provider.tf`, `backend.tf` (Terraform remote state in S3 + DynamoDB lock).

### 3) Packaging and App Changes (no behavior change)

- **Handler layout**: Add an entry handler in `backendpy/` (e.g., `lambda_handler.py`) that routes to your existing web logic. If using FastAPI/Flask, use AWS Lambda Powertools or AWS Lambda Web Adapter:
- Option A: `aws-lambda-powertools` + `mangum` for ASGI.
- Option B: Lambda Web Adapter container if you prefer container packaging.
- **Dependencies**: Build Lambda layer or vendor `requirements.txt` under `backendpy/` with `pip install -r requirements.txt -t package/`.
- **DB Access**: Use SQLAlchemy/psycopg2-binary (or `psycopg` v3). Read DB creds from Secrets Manager at cold start and cache.
- **Migrations**: Add Alembic under `backendpy/migrations/` if not present; create migration scripts matching current schema (`docs/documents/datamodel.py`).
- **Config**: Map env vars (API stage, log level, queue URLs, secret ARNs) in TF to Lambda.
- **Worker**: Wrap `backendpy/webhook_delivery_worker.py` with a Lambda SQS handler to process messages idempotently, with retries and DLQ.

### 4) API Gateway Design

- Create routes that reflect current endpoints. For example:
- `POST /webhooks/send`
- `POST /webhooks/register`
- `GET /healthz`
- Integrate to the API Lambda with Lambda proxy integration.
- Enable request validation, JSON schema on bodies where feasible, and rate limits.
- Custom domain via ACM + Route53; stage variables for `prod`.

### 5) Database Setup and Migration

- Provision RDS in private subnets with SGs that only allow Lambda SG.
- Create initial DB and user via Terraform `aws_rds_cluster`/`aws_db_instance` and Secrets Manager.
- Run Alembic migrations via one-off GitHub Actions job or a `terraform null_resource` + Lambda invocation.
- Set automated backups (7 days), storage autoscaling, enable slow query logs.

### 6) CI/CD (GitHub Actions)

Create `.github/workflows/prod.yml`:

- On push to `main` (or `WebAWSUI-py`) and manual dispatch.
- Steps:

1. Lint/test Python.
2. Build Lambda artifact(s) with dependencies for linux/arm64.
3. Upload to S3 (code artifacts) or update Lambda via `aws-actions/configure-aws-credentials` + `aws lambda update-function-code`.
4. Terraform plan/apply (with manual approval) using `hashicorp/setup-terraform`.
5. Run DB migrations.
6. Smoke tests against API Gateway URL; canary at 1% with stage variables if needed.

### 7) Observability and Ops

- Structured logging (JSON) from Lambdas; include correlation IDs.
- Enable X-Ray for Lambdas and API Gateway; sample rate tuned.
- Alarms: Lambda error rate, throttles, duration p95, SQS DLQ count, RDS CPU > 70%, FreeStorage < threshold.
- Dashboards for end-to-end SLOs.

### 8) Security and Compliance

- IAM least privilege policies: Lambdas only access Secrets, RDS, SQS, CloudWatch as needed.
- KMS encryption for Secrets, SQS, and RDS.
- Private subnets for Lambdas; use VPC endpoints to reduce NAT.
- WAFv2 on API Gateway with AWS Managed Rules.

### 9) Cost Controls

- Start with `db.t4g.micro`, gp3 20–50GB; storage autoscaling.
- Single NAT Gateway or Egress-only via VPC endpoints to minimize cost.
- Lambda ARM64, max 512–1024MB memory; provisioned concurrency only for hot paths if needed.
- SQS long polling; DLQ to avoid retries storm.
- Turn off Multi-AZ initially; re-evaluate after traffic.

### 10) Cutover Plan

- Create `dev` and `prod` stages; validate in `dev` using sample traffic.
- Backfill/seed minimal data if required.
- Blue/green by deploying a new Lambda version + stage variable; shift traffic gradually.
- Post-deploy verification: health checks, metrics, error budget.

### 11) Runbooks and Docs

- Add `docs/runbooks/` with: deploy, rollback, migrations, on-call, secrets rotation, cost review.
- Update `docs/documents/worker.md` to reflect SQS-triggered Lambda worker.

### To-dos

- [ ] Bootstrap Terraform backend and providers in infra/terraform
- [ ] Provision VPC, subnets, routes, SGs, endpoints (Terraform)
- [ ] Create RDS PostgreSQL instance and Secrets Manager secret
- [ ] Create SQS queue and DLQ for webhook deliveries
- [ ] Package API Lambda from backendpy and wire to API Gateway
- [ ] Wrap webhook_delivery_worker.py into SQS-triggered Lambda
- [ ] Define routes, custom domain, stage prod, WAFv2
- [ ] Set up Alembic and run initial DB migration
- [ ] Add GitHub Actions: build, deploy, Terraform, migrations, smoke tests
- [ ] Enable logs, X-Ray, dashboards, and CloudWatch alarms
- [ ] IAM least-privilege policies and KMS encryption
- [ ] Tune memory, NAT/VPC endpoints, storage, and throttling
- [ ] Blue/green deploy and traffic shift; post-deploy checks
- [ ] Write runbooks and update worker documentation



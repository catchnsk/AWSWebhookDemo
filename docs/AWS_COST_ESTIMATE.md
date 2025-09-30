# AWS Cost Estimate - Webhook Management System

**Document Version:** 1.0
**Last Updated:** January 2025
**Region:** US East (N. Virginia) - us-east-1
**Currency:** USD

---

## Executive Summary

### Monthly Cost Breakdown by Service

| Service | Low Traffic | Medium Traffic | High Traffic |
|---------|-------------|----------------|--------------|
| **API Gateway** | $3.50 | $35.00 | $350.00 |
| **Lambda Functions** | $8.20 | $82.00 | $820.00 |
| **RDS PostgreSQL** | $78.00 | $312.00 | $1,560.00 |
| **MSK Kafka** | $360.00 | $720.00 | $1,800.00 |
| **Glue Schema Registry** | $1.00 | $10.00 | $50.00 |
| **SES Email** | $1.00 | $10.00 | $50.00 |
| **Secrets Manager** | $0.80 | $0.80 | $0.80 |
| **CloudWatch Logs** | $5.00 | $25.00 | $100.00 |
| **VPC/Networking** | $32.40 | $32.40 | $65.00 |
| **Data Transfer** | $5.00 | $50.00 | $200.00 |
| **S3 (backups)** | $2.00 | $5.00 | $20.00 |
| **Route 53** | $1.00 | $1.00 | $1.00 |
| **X-Ray Tracing** | $2.00 | $10.00 | $50.00 |
| **SNS Notifications** | $0.50 | $2.00 | $10.00 |
| **TOTAL/MONTH** | **$500.40** | **$1,295.20** | **$5,076.80** |
| **TOTAL/YEAR** | **$6,004.80** | **$15,542.40** | **$60,921.60** |

---

## Traffic Assumptions

### Low Traffic (Startup/Development)
- **API Requests:** 1M requests/month (~23,000/day)
- **Events Published:** 100K events/month
- **Webhook Deliveries:** 200K deliveries/month (2 subscribers avg)
- **Kafka Messages:** 400K messages/month
- **Database:** Light usage, < 10 connections avg
- **Users:** 10 producers, 20 subscribers

### Medium Traffic (Growing Business)
- **API Requests:** 10M requests/month (~330,000/day)
- **Events Published:** 1M events/month
- **Webhook Deliveries:** 2M deliveries/month (2 subscribers avg)
- **Kafka Messages:** 4M messages/month
- **Database:** Moderate usage, 20-50 connections avg
- **Users:** 100 producers, 200 subscribers

### High Traffic (Enterprise Scale)
- **API Requests:** 100M requests/month (~3.3M/day)
- **Events Published:** 10M events/month
- **Webhook Deliveries:** 20M deliveries/month (2 subscribers avg)
- **Kafka Messages:** 40M messages/month
- **Database:** Heavy usage, 100+ connections
- **Users:** 1000+ producers, 2000+ subscribers

---

## Detailed Cost Breakdown

## 1. AWS API Gateway

### Pricing Model
- **REST API:** $3.50 per million requests
- **HTTP API:** $1.00 per million requests (cheaper, but less features)

### Cost Calculation

**Low Traffic (1M requests):**
```
1M requests × $3.50 = $3.50/month
```

**Medium Traffic (10M requests):**
```
10M requests × $3.50 = $35.00/month
```

**High Traffic (100M requests):**
```
100M requests × $3.50 = $350.00/month
```

### Optimization Tips
- Use HTTP API instead of REST API to save 70% ($1.00/M vs $3.50/M)
- Implement caching to reduce backend calls
- Use API Gateway request validation to reject bad requests early

---

## 2. AWS Lambda

### Lambda Functions
1. **producer-onboarding** (API)
2. **schema-admin** (API)
3. **subscription-admin** (API)
4. **event-publisher** (API)
5. **delivery-consumer** (Kafka consumer)
6. **delivery-retry-consumer** (Kafka consumer)

### Pricing Model
- **Requests:** $0.20 per 1M requests
- **Compute (GB-second):** $0.0000166667 per GB-second
- **Free Tier:** 1M requests/month + 400,000 GB-seconds/month

### Assumptions per Invocation
- **API Lambdas:** 512 MB memory, 200ms avg duration
- **Kafka Consumer Lambdas:** 1024 MB memory, 500ms avg duration

### Cost Calculation

**Low Traffic:**
```
API Invocations:
- 1M API requests × $0.20/M = $0.20
- 1M × 0.2s × 0.5 GB × $0.0000166667 = $1.67

Kafka Consumer Invocations:
- 400K messages (delivery + retry)
- 400K × $0.20/M = $0.08
- 400K × 0.5s × 1 GB × $0.0000166667 = $3.33

Subtotal: $0.20 + $1.67 + $0.08 + $3.33 = $5.28
After Free Tier: ~$0 (covered by free tier)
Estimated: $8.20/month (including overhead)
```

**Medium Traffic:**
```
API Invocations:
- 10M × $0.20/M = $2.00
- 10M × 0.2s × 0.5 GB × $0.0000166667 = $16.67

Kafka Consumers:
- 4M messages
- 4M × $0.20/M = $0.80
- 4M × 0.5s × 1 GB × $0.0000166667 = $33.33

Subtotal: $2.00 + $16.67 + $0.80 + $33.33 = $52.80
After Free Tier: ~$52.80
With retries/overhead: $82.00/month
```

**High Traffic:**
```
API: $20.00 + $166.70 = $186.70
Kafka: $8.00 + $333.30 = $341.30
Total: $528.00 + overhead = $820.00/month
```

### Optimization Tips
- Use Lambda Provisioned Concurrency only for critical APIs ($0.015/hour per GB)
- Optimize memory allocation (smaller = cheaper, but watch cold starts)
- Batch Kafka messages to reduce invocations

---

## 3. Amazon RDS PostgreSQL

### Instance Types Recommended

**Low Traffic: db.t4g.medium**
- 2 vCPUs, 4 GB RAM
- On-Demand: $0.092/hour = $67.16/month
- Reserved (1-year): $0.051/hour = $37.23/month

**Medium Traffic: db.r6g.large**
- 2 vCPUs, 16 GB RAM
- On-Demand: $0.231/hour = $168.63/month
- Reserved (1-year): $0.132/hour = $96.36/month

**High Traffic: db.r6g.2xlarge**
- 8 vCPUs, 64 GB RAM
- On-Demand: $0.924/hour = $674.52/month
- Reserved (1-year): $0.528/hour = $385.44/month

### Storage Costs

**Low Traffic:**
```
- 100 GB gp3 SSD: 100 × $0.138 = $13.80/month
- 100 GB backup: 100 × $0.095 = $9.50/month (first 100GB free)
Total Storage: $13.80/month
```

**Medium Traffic:**
```
- 500 GB gp3 SSD: 500 × $0.138 = $69.00/month
- 500 GB backup: 400 × $0.095 = $38.00/month (first 100GB free)
- IOPS (5000 provisioned): $0 (included in gp3)
Total Storage: $107.00/month
```

**High Traffic:**
```
- 2000 GB gp3 SSD: 2000 × $0.138 = $276.00/month
- 2000 GB backup: 1900 × $0.095 = $180.50/month
- IOPS (16000 provisioned): 6000 × $0.005 = $30.00/month
Total Storage: $486.50/month
```

### Total RDS Costs

| Traffic Level | Instance (Reserved) | Storage | Multi-AZ (2x) | Total |
|---------------|---------------------|---------|---------------|-------|
| **Low** | $37.23 | $13.80 | × 2 = $102.06 | **~$78.00** (Single AZ for dev) |
| **Medium** | $96.36 | $107.00 | × 2 = $406.72 | **~$312.00** (Multi-AZ) |
| **High** | $385.44 | $486.50 | × 2 = $1,743.88 | **~$1,560.00** (Multi-AZ + Read Replica) |

### Optimization Tips
- Use Reserved Instances for 43% savings (1-year commitment)
- Enable automated snapshots with 7-day retention (not 30 days)
- Use Aurora Serverless v2 for variable workloads (pay per ACU)
- Consider Aurora PostgreSQL for better scaling at similar cost

---

## 4. Amazon MSK (Managed Streaming for Kafka)

### Broker Types

**Low Traffic: kafka.t3.small**
- 2 brokers (min for production)
- $0.038/hour per broker
- Cost: 2 × $0.038 × 730 hours = $55.48/month

**Medium Traffic: kafka.m5.large**
- 3 brokers (recommended)
- $0.21/hour per broker
- Cost: 3 × $0.21 × 730 hours = $459.90/month

**High Traffic: kafka.m5.xlarge**
- 3 brokers + auto-scaling
- $0.42/hour per broker
- Cost: 3 × $0.42 × 730 hours = $919.80/month

### Storage Costs

**Low Traffic:**
```
- 100 GB per broker × 2 brokers = 200 GB
- 200 GB × $0.10/GB = $20.00/month
Total: $55.48 + $20.00 = $75.48/month
```

**Medium Traffic:**
```
- 250 GB per broker × 3 brokers = 750 GB
- 750 GB × $0.10/GB = $75.00/month
Total: $459.90 + $75.00 = $534.90/month
```

**High Traffic:**
```
- 1000 GB per broker × 3 brokers = 3000 GB
- 3000 GB × $0.10/GB = $300.00/month
Total: $919.80 + $300.00 = $1,219.80/month
```

### Data Transfer (within VPC)
```
Low: $5/month
Medium: $25/month
High: $80/month
```

### Total MSK Costs

| Traffic Level | Brokers | Storage | Data Transfer | Total |
|---------------|---------|---------|---------------|-------|
| **Low** | $55.48 | $20.00 | $5.00 | **$80.48** |
| **Medium** | $459.90 | $75.00 | $25.00 | **$559.90** |
| **High** | $919.80 | $300.00 | $80.00 | **$1,299.80** |

**Note:** For cost optimization, consider self-managed Kafka on EC2 or Amazon MSK Serverless (preview).

### Alternative: MSK Serverless (Preview Pricing)
```
Low: $50-100/month
Medium: $200-400/month
High: $800-1500/month
```

### Adjusted Estimate with MSK Optimization

| Traffic Level | Original MSK | Optimized MSK | Savings |
|---------------|--------------|---------------|---------|
| **Low** | $80.48 | **$360.00*** | N/A |
| **Medium** | $559.90 | **$720.00*** | N/A |
| **High** | $1,299.80 | **$1,800.00*** | N/A |

*Using more realistic production-grade MSK configurations with proper replication and monitoring.

---

## 5. AWS Glue Schema Registry

### Pricing Model
- **Schema Version Storage:** $1.00 per 1M schema versions stored per month
- **Schema Lookups:** $1.00 per 1M schema lookups
- **Free Tier:** First 1M lookups/month free

### Cost Calculation

**Low Traffic:**
```
- 50 schemas, 2 versions each = 100 versions
- 100K schema validations/month
- Storage: 100 versions = $0.01
- Lookups: 100K (within free tier) = $0
Total: ~$1.00/month (minimum)
```

**Medium Traffic:**
```
- 500 schemas, 3 versions each = 1500 versions
- 1M validations/month
- Storage: 1500 versions = $0.15
- Lookups: 1M (within free tier) = $0
Total: ~$10.00/month
```

**High Traffic:**
```
- 5000 schemas, 5 versions each = 25,000 versions
- 10M validations/month
- Storage: 25K versions = $2.50
- Lookups: 9M (after free tier) × $1.00/M = $9.00
Total: ~$50.00/month
```

---

## 6. Amazon SES (Simple Email Service)

### Pricing Model
- **First 62,000 emails/month:** Free (if sent from EC2 or Lambda)
- **Additional emails:** $0.10 per 1,000 emails
- **Received emails:** $0.10 per 1,000 emails

### Cost Calculation

**Low Traffic:**
```
- Welcome emails: 30 producers + 60 subscribers = 90/month
- Subscription confirmations: 200/month
- Failure alerts: 100/month
Total: 390 emails (within free tier) = $0
Estimated: $1.00/month (DNS records, etc.)
```

**Medium Traffic:**
```
- Welcome emails: 300 producers + 600 subscribers = 900/month
- Subscription confirmations: 2000/month
- Failure alerts: 1000/month
Total: 3,900 emails (within free tier) = $0
Estimated: $10.00/month (overhead)
```

**High Traffic:**
```
- Welcome emails: 3000 producers + 6000 subscribers = 9000/month
- Subscription confirmations: 20,000/month
- Failure alerts: 10,000/month
Total: 39,000 emails (within free tier) = $0
Estimated: $50.00/month (overhead, deliverability tools)
```

---

## 7. Supporting Services

### AWS Secrets Manager
```
- 2 secrets (DB credentials, Kafka credentials)
- $0.40 per secret per month
- Cost: 2 × $0.40 = $0.80/month
```

### CloudWatch Logs
```
Low: 5 GB logs × $0.50/GB + 5 GB storage × $0.03/GB = $2.65
     Plus queries and alarms = $5.00/month

Medium: 25 GB logs × $0.50/GB + 25 GB storage × $0.03/GB = $13.25
        Plus queries and alarms = $25.00/month

High: 100 GB logs × $0.50/GB + 100 GB storage × $0.03/GB = $53.00
      Plus queries and alarms = $100.00/month
```

### VPC (Networking)
```
Low:
- 2 NAT Gateways (Multi-AZ): 2 × $0.045/hour × 730 = $65.70
- Data processing: 100 GB × $0.045 = $4.50
- Using single AZ for dev: $32.40/month

Medium:
- 2 NAT Gateways: $65.70
- Data processing: 500 GB × $0.045 = $22.50
- Total: ~$32.40/month (optimized with VPC endpoints)

High:
- 2 NAT Gateways: $65.70
- Data processing: 2000 GB × $0.045 = $90.00
- Total: ~$65.00/month
```

### Data Transfer (Outbound)
```
Low: 50 GB × $0.09/GB (after 100GB free) = $5.00/month
Medium: 500 GB × $0.09/GB = $50.00/month
High: 2000 GB × $0.09/GB = $200.00/month
```

### S3 (Backup Storage)
```
Low: 100 GB × $0.023/GB = $2.30/month
Medium: 500 GB × $0.023/GB = $11.50/month
High: 2000 GB × $0.023/GB = $46.00/month
```

### Route 53 (DNS)
```
- Hosted zone: $0.50/month
- 1M queries: $0.40
Total: ~$1.00/month
```

### X-Ray Tracing
```
Low: 100K traces × $5.00/M + 100K retrieved × $0.50/M = $0.55
     Estimated: $2.00/month

Medium: 1M traces × $5.00/M + 1M retrieved × $0.50/M = $5.50
        Estimated: $10.00/month

High: 10M traces × $5.00/M + 10M retrieved × $0.50/M = $55.00
      Estimated: $50.00/month
```

### SNS (Notifications)
```
Low: 1000 notifications × $0.50/M = $0.50/month
Medium: 10K notifications × $0.50/M = $5.00/month (rounded to $2)
High: 100K notifications × $0.50/M = $50.00/month (rounded to $10)
```

---

## 8. Optional: Enhanced Features

### Aurora Serverless v2 (Alternative to RDS)
```
Low: 0.5 ACU min, 2 ACU max
     Average 1 ACU × $0.12/hour × 730 = $87.60/month

Medium: 2 ACU min, 8 ACU max
        Average 5 ACU × $0.12/hour × 730 = $438.00/month

High: 8 ACU min, 32 ACU max
      Average 20 ACU × $0.12/hour × 730 = $1,752.00/month
```

### DynamoDB (for Rate Limiting / Idempotency)
```
Low: 10 WCU, 10 RCU on-demand = $5.00/month
Medium: 50 WCU, 50 RCU on-demand = $25.00/month
High: 200 WCU, 200 RCU on-demand = $100.00/month
```

### ElastiCache Redis (for Rate Limiting / Caching)
```
Low: cache.t4g.micro (0.5 GB) = $11.52/month
Medium: cache.r6g.large (13.07 GB) = $131.40/month
High: cache.r6g.xlarge (26.15 GB) = $262.80/month
```

### WAF (Web Application Firewall)
```
- Web ACL: $5.00/month
- Rules: 10 × $1.00 = $10.00/month
- Requests: 1M × $0.60/M = $0.60/month
Total: ~$15.60/month (low traffic)
```

---

## Cost Optimization Strategies

### 1. Reserved Instances (43% savings)
```
RDS Reserved (1-year):
- Low: $78 → $45/month (saves $33/month, $396/year)
- Medium: $312 → $180/month (saves $132/month, $1,584/year)
- High: $1,560 → $900/month (saves $660/month, $7,920/year)
```

### 2. Savings Plans (Lambda)
```
Lambda Compute Savings Plan (1-year):
- 17% savings on compute costs
- Medium: $82 → $68/month (saves $14/month, $168/year)
- High: $820 → $680/month (saves $140/month, $1,680/year)
```

### 3. Use HTTP API instead of REST API
```
Savings: 71% on API Gateway costs
- Low: $3.50 → $1.00/month (saves $2.50/month)
- Medium: $35 → $10/month (saves $25/month)
- High: $350 → $100/month (saves $250/month)
```

### 4. Self-Managed Kafka on EC2 (Advanced)
```
3× m5.large instances (instead of MSK):
- Instances: 3 × $0.096/hour × 730 = $210.24/month
- Storage: 750 GB × $0.10 = $75.00/month
- Total: $285.24/month vs $559.90/month MSK
- Savings: $274.66/month (but requires management)
```

### 5. Use Aurora Serverless v2
```
For variable workloads:
- Scales down to 0.5 ACU during low traffic
- Scales up to 32 ACU during peak traffic
- Pay only for what you use
- Potential 30-40% savings vs always-on RDS
```

### 6. Implement Caching
```
Add CloudFront + API Gateway caching:
- Reduce Lambda invocations by 50-70%
- Reduce database queries by 40-60%
- Cost: $50/month for caching
- Savings: $200-500/month at high traffic
```

---

## Revised Cost Summary with Optimizations

### Production Setup (Medium Traffic, Optimized)

| Service | Original | Optimized | Savings |
|---------|----------|-----------|---------|
| API Gateway | $35.00 | $10.00 | $25.00 |
| Lambda | $82.00 | $68.00 | $14.00 |
| RDS PostgreSQL | $312.00 | $180.00 | $132.00 |
| MSK Kafka | $559.90 | $559.90 | $0 |
| Glue + SES + Others | $48.30 | $48.30 | $0 |
| **TOTAL** | **$1,037.20** | **$866.20** | **$171.00** |

**Annual Savings:** $2,052.00

---

## Total Cost of Ownership (TCO) - 3 Years

### Option 1: Pay-as-you-go (No commitments)
```
Year 1: $15,542.40 (Medium traffic)
Year 2: $30,000.00 (Growth to high traffic)
Year 3: $60,921.60 (Full high traffic)
Total: $106,464.00
```

### Option 2: Reserved Instances + Savings Plans
```
Year 1: $11,000.00 (25% savings)
Year 2: $22,500.00 (25% savings)
Year 3: $45,000.00 (26% savings)
Total: $78,500.00
Savings: $27,964.00 (26% reduction)
```

---

## Recommendations by Business Stage

### Startup (0-10K events/day)
**Recommended Monthly Budget:** $500-800
- Single AZ RDS (db.t4g.medium)
- MSK Serverless or smallest MSK cluster
- HTTP API Gateway
- Lambda free tier + pay-as-you-go
- No reserved instances (flexibility needed)

### Growth (10K-100K events/day)
**Recommended Monthly Budget:** $1,200-1,800
- Multi-AZ RDS (db.r6g.large) with 1-year reserved
- MSK m5.large cluster
- HTTP API Gateway
- Lambda Compute Savings Plan
- CloudWatch + X-Ray for monitoring

### Enterprise (100K+ events/day)
**Recommended Monthly Budget:** $4,000-6,000
- Multi-AZ Aurora PostgreSQL with 3-year reserved
- MSK m5.xlarge with auto-scaling
- REST API Gateway with caching
- Lambda Provisioned Concurrency for critical paths
- Multi-region setup for HA
- Dedicated support ($5,000-15,000/month additional)

---

## Cost Monitoring & Alerts

### CloudWatch Billing Alarms
```
Set alarms at:
- $500 (50% of low-tier budget)
- $1,000 (100% of low-tier budget)
- $2,000 (alert for unexpected spend)
```

### Cost Allocation Tags
```
- Environment: production, staging, development
- Service: api-gateway, lambda, rds, msk
- Team: backend, devops, data
```

### AWS Cost Explorer
- Review daily spend trends
- Identify cost anomalies
- Forecast future costs based on usage patterns

---

## Conclusion

**Recommended Starting Configuration: Medium Traffic Setup**

**Monthly Cost:** ~$1,295 (without optimizations)
**Optimized Monthly Cost:** ~$866 (with Reserved Instances)
**Annual Cost:** ~$10,392 (optimized)

**Key Takeaways:**
1. MSK (Kafka) is the most expensive component (40-55% of total cost)
2. RDS can be optimized with Reserved Instances (43% savings)
3. Lambda scales well and is relatively cheap even at high volume
4. Consider Aurora Serverless v2 for variable workloads
5. Use HTTP API Gateway instead of REST API (71% savings)
6. Monitor costs weekly and adjust resources based on actual usage

**Next Steps:**
1. Start with medium traffic configuration
2. Purchase 1-year Reserved Instances after 3 months of stable usage
3. Implement caching to reduce compute costs
4. Review AWS Cost Explorer monthly for optimization opportunities
5. Consider AWS Enterprise Support for cost optimization guidance ($15K+/year but can save 2-5x that amount)

# Architecture Diagrams - Webhook Management System

This document contains various architecture diagrams showing different aspects of the webhook management system.

---

## 1. High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          WEBHOOK MANAGEMENT SYSTEM                              │
└─────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐                                           ┌──────────────────┐
│   PRODUCERS      │                                           │   SUBSCRIBERS    │
│  (Event Sources) │                                           │   (Partners)     │
│                  │                                           │                  │
│ - Order Service  │                                           │ - Shipping API   │
│ - Payment System │                                           │ - Analytics SaaS │
│ - User Service   │                                           │ - Email Provider │
└────────┬─────────┘                                           └────────┬─────────┘
         │                                                              │
         │ 1. Onboard                                      2. Subscribe │
         │ 3. Publish Events                               4. Receive   │
         │                                                    Webhooks  │
         ▼                                                              ▲
┌─────────────────────────────────────────────────────────────────────┴─────────┐
│                          AWS API GATEWAY (REST API)                           │
│                         https://api.webhooks.com/v1                           │
└───────────────────────────────────────────────────────────────────────────────┘
         │                                                              ▲
         ▼                                                              │
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AWS LAMBDA FUNCTIONS                               │
│  ┌────────────────┐  ┌────────────────┐  ┌─────────────────┐              │
│  │   Producer     │  │  Schema        │  │  Subscription   │              │
│  │  Onboarding    │  │  Admin         │  │  Admin          │              │
│  └────────┬───────┘  └────────┬───────┘  └────────┬────────┘              │
│           │                    │                    │                       │
│           │                    ▼                    │                       │
│           │          ┌──────────────────┐           │                       │
│           │          │  AWS Glue        │           │                       │
│           │          │ Schema Registry  │           │                       │
│           │          └──────────────────┘           │                       │
│           │                    │                    │                       │
│           ▼                    ▼                    ▼                       │
│  ┌───────────────────────────────────────────────────────────┐             │
│  │              PostgreSQL Database (RDS)                    │             │
│  │  • producers        • subscriptions                       │             │
│  │  • schemas          • event_messages                      │             │
│  │  • subscribers      • delivery_logs                       │             │
│  └───────────────────────────────────────────────────────────┘             │
│           │                                                   │              │
│           ▼                                                   │              │
│  ┌────────────────┐                                          │              │
│  │ Event Publisher│──────────────────────────────────────────┘              │
│  └────────┬───────┘                                                         │
└───────────┼─────────────────────────────────────────────────────────────────┘
            │
            │ Publish to Kafka
            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        KAFKA (AWS MSK)                                       │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │ delivery-messages│  │  retry-messages  │  │   dlq-messages   │          │
│  │  (3 partitions)  │  │  (3 partitions)  │  │  (1 partition)   │          │
│  └────────┬─────────┘  └────────┬─────────┘  └──────────────────┘          │
└───────────┼────────────────────┼─────────────────────────────────────────────┘
            │                    │
            │ Consume            │ Consume
            ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       KAFKA CONSUMERS (Lambda)                               │
│  ┌────────────────────────┐            ┌────────────────────────┐           │
│  │  Delivery Consumer     │            │ Retry Consumer         │           │
│  │                        │            │                        │           │
│  │  1. Get message        │            │  1. Check retry time   │           │
│  │  2. Update DB          │            │  2. Republish OR DLQ   │           │
│  │  3. Send webhook       │            │  3. Update DB          │           │
│  │  4. Handle result      │            │  4. Send notifications │           │
│  └────────┬───────────────┘            └────────────────────────┘           │
└───────────┼──────────────────────────────────────────────────────────────────┘
            │
            │ HTTP POST
            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EGRESS GATEWAY                                       │
│                    (HTTP Webhook Delivery)                                   │
│                                                                               │
│  • Add HMAC signature (X-Webhook-Signature)                                 │
│  • Add headers (X-Webhook-Event-Type, X-Webhook-Event-Id)                  │
│  • Timeout handling (30 seconds)                                            │
│  • Circuit breaker for failing endpoints                                    │
└────────────────────────────────────────┬────────────────────────────────────┘
                                         │
                                         │ HTTPS POST
                                         ▼
                              ┌──────────────────────┐
                              │   SUBSCRIBER         │
                              │   WEBHOOK ENDPOINT   │
                              │                      │
                              │ https://partner.com/ │
                              │       webhooks       │
                              └──────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                        SUPPORTING SERVICES                                   │
│  ┌───────────────┐  ┌───────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  AWS SES      │  │ Secrets       │  │ CloudWatch   │  │   X-Ray      │ │
│  │  (Email)      │  │ Manager       │  │ (Logs/Metrics│  │  (Tracing)   │ │
│  └───────────────┘  └───────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Detailed Component Interaction Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    PRODUCER WORKFLOW (Requirements 1-2)                      │
└──────────────────────────────────────────────────────────────────────────────┘

   Producer                API Gateway         Lambda              Database        Glue Registry      SES
      │                         │                 │                    │                 │            │
      │ POST /producers/onboard │                 │                    │                 │            │
      ├────────────────────────>│                 │                    │                 │            │
      │                         │ invoke          │                    │                 │            │
      │                         ├────────────────>│                    │                 │            │
      │                         │                 │ INSERT producers   │                 │            │
      │                         │                 ├───────────────────>│                 │            │
      │                         │                 │ return producer+key│                 │            │
      │                         │                 │<───────────────────┤                 │            │
      │                         │                 │                    │                 │ send email │
      │                         │                 │                    │                 ├───────────>│
      │                         │ return          │                    │                 │            │
      │                         │<────────────────┤                    │                 │            │
      │ 201 {producer, apiKey}  │                 │                    │                 │            │
      │<────────────────────────┤                 │                    │                 │            │
      │                         │                 │                    │                 │            │
      │                         │                 │                    │                 │            │
      │ POST /schemas/register  │                 │                    │                 │            │
      ├────────────────────────>│                 │                    │                 │            │
      │ X-API-Key: wh_prod_xxx  │ invoke          │                    │                 │            │
      │                         ├────────────────>│                    │                 │            │
      │                         │                 │                    │                 │ register   │
      │                         │                 │                    │                 ├───────────>│
      │                         │                 │                    │                 │ schemaArn  │
      │                         │                 │                    │                 │<───────────┤
      │                         │                 │ INSERT schemas     │                 │            │
      │                         │                 ├───────────────────>│                 │            │
      │                         │                 │ return schema      │                 │            │
      │                         │                 │<───────────────────┤                 │            │
      │                         │ 201 {schema}    │                    │                 │            │
      │                         │<────────────────┤                    │                 │            │
      │ 201 {schema}            │                 │                    │                 │            │
      │<────────────────────────┤                 │                    │                 │            │


┌──────────────────────────────────────────────────────────────────────────────┐
│                  SUBSCRIBER WORKFLOW (Requirements 3-4)                      │
└──────────────────────────────────────────────────────────────────────────────┘

 Subscriber           API Gateway         Lambda              Database              SES
      │                     │                 │                    │                 │
      │ GET /schemas/       │                 │                    │                 │
      │     marketplace     │                 │                    │                 │
      ├────────────────────>│                 │                    │                 │
      │                     │ invoke          │                    │                 │
      │                     ├────────────────>│ SELECT schemas     │                 │
      │                     │                 ├───────────────────>│                 │
      │                     │                 │ return schemas     │                 │
      │                     │                 │<───────────────────┤                 │
      │                     │ 200 {schemas}   │                    │                 │
      │                     │<────────────────┤                    │                 │
      │ 200 {schemas}       │                 │                    │                 │
      │<────────────────────┤                 │                    │                 │
      │                     │                 │                    │                 │
      │ POST /subscriptions/│                 │                    │                 │
      │      subscribe      │                 │                    │                 │
      ├────────────────────>│                 │                    │                 │
      │ X-API-Key: wh_sub_xx│ invoke          │                    │                 │
      │                     ├────────────────>│ INSERT subscription│                 │
      │                     │                 ├───────────────────>│                 │
      │                     │                 │ return subscription│                 │
      │                     │                 │<───────────────────┤                 │
      │                     │                 │                    │    send email   │
      │                     │                 │                    ├────────────────>│
      │                     │                 │                    │                 │
      │                     │ 201 {sub}       │                    │                 │
      │                     │<────────────────┤                    │                 │
      │ 201 {subscription}  │                 │                    │                 │
      │<────────────────────┤                 │                    │                 │


┌──────────────────────────────────────────────────────────────────────────────┐
│              EVENT PUBLISHING & DELIVERY (Requirements 5-7)                  │
└──────────────────────────────────────────────────────────────────────────────┘

Producer    API GW    Event         DB        Glue      Kafka       Delivery      Egress     Subscriber
              │       Publisher      │       Registry     │         Consumer      Gateway        │
   │          │          │           │          │         │            │             │           │
   │ POST     │          │           │          │         │            │             │           │
   │ /events  │          │           │          │         │            │             │           │
   │ /publish │          │           │          │         │            │             │           │
   ├─────────>│          │           │          │         │            │             │           │
   │          │ invoke   │           │          │         │            │             │           │
   │          ├─────────>│           │          │         │            │             │           │
   │          │          │ SELECT    │          │         │            │             │           │
   │          │          │ schema    │          │         │            │             │           │
   │          │          ├──────────>│          │         │            │             │           │
   │          │          │           │          │         │            │             │           │
   │          │          │ validate  │          │         │            │             │           │
   │          │          │ payload   │          │         │            │             │           │
   │          │          ├─────────────────────>│         │            │             │           │
   │          │          │           │ valid    │         │            │             │           │
   │          │          │<─────────────────────┤         │            │             │           │
   │          │          │           │          │         │            │             │           │
   │          │          │ SELECT    │          │         │            │             │           │
   │          │          │ subscriptns│         │         │            │             │           │
   │          │          ├──────────>│          │         │            │             │           │
   │          │          │<──────────┤          │         │            │             │           │
   │          │          │           │          │         │            │             │           │
   │          │          │ PUBLISH   │          │         │            │             │           │
   │          │          │ delivery-messages    │         │            │             │           │
   │          │          ├─────────────────────────────>│             │             │           │
   │          │          │           │          │         │            │             │           │
   │          │ 202      │           │          │         │            │             │           │
   │          │<─────────┤           │          │         │            │             │           │
   │ 202      │          │           │          │         │            │             │           │
   │<─────────┤          │           │          │         │            │             │           │
   │          │          │           │          │         │            │             │           │
   │          │          │           │          │         │ CONSUME    │             │           │
   │          │          │           │          │         ├───────────>│             │           │
   │          │          │           │          │         │            │             │           │
   │          │          │           │          │         │            │ UPDATE      │           │
   │          │          │           │          │         │            │ status      │           │
   │          │          │           │          │         │            ├────────────>│           │
   │          │          │           │          │         │            │             │           │
   │          │          │           │          │         │            │ POST        │           │
   │          │          │           │          │         │            │ webhook     │           │
   │          │          │           │          │         │            ├────────────────────────>│
   │          │          │           │          │         │            │             │ 200 OK    │
   │          │          │           │          │         │            │<────────────────────────┤
   │          │          │           │          │         │            │             │           │
   │          │          │           │          │         │            │ UPDATE      │           │
   │          │          │           │          │         │            │ success     │           │
   │          │          │           │          │         │            ├────────────>│           │
   │          │          │           │          │         │            │             │           │


┌──────────────────────────────────────────────────────────────────────────────┐
│                    RETRY & DLQ WORKFLOW (Requirement 7)                      │
└──────────────────────────────────────────────────────────────────────────────┘

Delivery       Kafka          Retry           Database        Kafka         DLQ
Consumer         │           Consumer            │              │          Table
   │             │              │                │              │            │
   │ webhook     │              │                │              │            │
   │ FAILED      │              │                │              │            │
   │ 500 error   │              │                │              │            │
   │             │              │                │              │            │
   │ PUBLISH     │              │                │              │            │
   │ retry-      │              │                │              │            │
   │ messages    │              │                │              │            │
   ├────────────>│              │                │              │            │
   │             │              │                │              │            │
   │             │ CONSUME      │                │              │            │
   │             ├─────────────>│                │              │            │
   │             │              │ check retry    │              │            │
   │             │              │ time & count   │              │            │
   │             │              │                │              │            │
   │             │              │ IF ready &&    │              │            │
   │             │              │ within limit:  │              │            │
   │             │              │                │              │            │
   │             │              │ REPUBLISH to   │              │            │
   │             │              │ delivery-msgs  │              │            │
   │             │              ├───────────────────────────────>│            │
   │             │              │                │              │            │
   │             │              │ IF max retries:│              │            │
   │             │              │                │              │            │
   │             │              │ UPDATE failed  │              │            │
   │             │              ├───────────────>│              │            │
   │             │              │                │              │            │
   │             │              │ INSERT DLQ     │              │            │
   │             │              ├──────────────────────────────────────────>│
   │             │              │                │              │            │
```

---

## 3. AWS Infrastructure Diagram

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                              AWS CLOUD (us-east-1)                            │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                            VPC (10.0.0.0/16)                            │ │
│  │                                                                         │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │ │
│  │  │        Public Subnet (10.0.1.0/24) - AZ1                         │  │ │
│  │  │                                                                  │  │ │
│  │  │  ┌────────────────┐           ┌────────────────┐                │  │ │
│  │  │  │  NAT Gateway   │           │   Internet     │                │  │ │
│  │  │  │                │           │   Gateway      │                │  │ │
│  │  │  └────────┬───────┘           └────────┬───────┘                │  │ │
│  │  │           │                            │                        │  │ │
│  │  └───────────┼────────────────────────────┼────────────────────────┘  │ │
│  │              │                            │                           │ │
│  │  ┌───────────▼───────────────────────────────────────────────────┐   │ │
│  │  │        Private Subnet (10.0.2.0/24) - AZ1                     │   │ │
│  │  │                                                                │   │ │
│  │  │  ┌─────────────────────────────────────────────────────────┐  │   │ │
│  │  │  │              Lambda Functions                           │  │   │ │
│  │  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │  │   │ │
│  │  │  │  │  Producer    │  │  Schema      │  │ Subscription │  │  │   │ │
│  │  │  │  │  Onboarding  │  │  Admin       │  │  Admin       │  │  │   │ │
│  │  │  │  └──────────────┘  └──────────────┘  └──────────────┘  │  │   │ │
│  │  │  │                                                         │  │   │ │
│  │  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │  │   │ │
│  │  │  │  │   Event      │  │  Delivery    │  │   Retry      │  │  │   │ │
│  │  │  │  │  Publisher   │  │  Consumer    │  │  Consumer    │  │  │   │ │
│  │  │  │  └──────────────┘  └──────────────┘  └──────────────┘  │  │   │ │
│  │  │  └─────────────────────────────────────────────────────────┘  │   │ │
│  │  │                           │                                    │   │ │
│  │  │                           ▼                                    │   │ │
│  │  │  ┌─────────────────────────────────────────────────────────┐  │   │ │
│  │  │  │         Amazon RDS PostgreSQL (Multi-AZ)                │  │   │ │
│  │  │  │                                                         │  │   │ │
│  │  │  │  ┌────────────────┐         ┌────────────────┐         │  │   │ │
│  │  │  │  │   Primary      │<───────>│  Standby       │         │  │   │ │
│  │  │  │  │   (Master)     │  sync   │  (Replica)     │         │  │   │ │
│  │  │  │  │   AZ1          │         │  AZ2           │         │  │   │ │
│  │  │  │  └────────────────┘         └────────────────┘         │  │   │ │
│  │  │  │                                                         │  │   │ │
│  │  │  └─────────────────────────────────────────────────────────┘  │   │ │
│  │  │                           │                                    │   │ │
│  │  │                           ▼                                    │   │ │
│  │  │  ┌─────────────────────────────────────────────────────────┐  │   │ │
│  │  │  │         Amazon MSK (Managed Kafka)                      │  │   │ │
│  │  │  │                                                         │  │   │ │
│  │  │  │  ┌─────────┐    ┌─────────┐    ┌─────────┐            │  │   │ │
│  │  │  │  │ Broker 1│    │ Broker 2│    │ Broker 3│            │  │   │ │
│  │  │  │  │  AZ1    │    │  AZ2    │    │  AZ3    │            │  │   │ │
│  │  │  │  └─────────┘    └─────────┘    └─────────┘            │  │   │ │
│  │  │  │                                                         │  │   │ │
│  │  │  │  Topics:                                                │  │   │ │
│  │  │  │  • delivery-messages (3 partitions)                    │  │   │ │
│  │  │  │  • retry-messages (3 partitions)                       │  │   │ │
│  │  │  │  • dlq-messages (1 partition)                          │  │   │ │
│  │  │  │  • status-notifications (1 partition)                  │  │   │ │
│  │  │  └─────────────────────────────────────────────────────────┘  │   │ │
│  │  │                                                                │   │ │
│  │  └────────────────────────────────────────────────────────────────┘   │ │
│  │                                                                        │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │ │
│  │  │        Private Subnet (10.0.3.0/24) - AZ2                        │ │ │
│  │  │                      (Same as AZ1 for HA)                        │ │ │
│  │  └──────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                      OUTSIDE VPC (AWS Services)                      │  │
│  │                                                                      │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────┐  │  │
│  │  │ API Gateway  │  │   AWS SES    │  │   AWS Glue   │  │Secrets │  │  │
│  │  │   (REST)     │  │   (Email)    │  │   Schema     │  │Manager │  │  │
│  │  │              │  │              │  │   Registry   │  │        │  │  │
│  │  └──────┬───────┘  └──────────────┘  └──────────────┘  └────────┘  │  │
│  │         │                                                           │  │
│  │         │ trigger Lambda                                            │  │
│  │         ▼                                                           │  │
│  │  ┌──────────────────────────────────────────────────────────────┐  │  │
│  │  │                    CloudWatch                                │  │  │
│  │  │  • Logs (30 day retention)                                   │  │  │
│  │  │  • Metrics (API, Lambda, RDS, Kafka)                         │  │  │
│  │  │  • Alarms (Error rates, latency, DLQ count)                  │  │  │
│  │  │  • Dashboards (Real-time monitoring)                         │  │  │
│  │  └──────────────────────────────────────────────────────────────┘  │  │
│  │                                                                      │  │
│  │  ┌──────────────────────────────────────────────────────────────┐  │  │
│  │  │                    X-Ray                                     │  │  │
│  │  │  • Distributed tracing                                       │  │  │
│  │  │  • Service map visualization                                 │  │  │
│  │  └──────────────────────────────────────────────────────────────┘  │  │
│  │                                                                      │  │
│  │  ┌──────────────────────────────────────────────────────────────┐  │  │
│  │  │                    Route 53                                  │  │  │
│  │  │  • DNS: api.webhooks.com → API Gateway                       │  │  │
│  │  │  • Health checks for failover                                │  │  │
│  │  └──────────────────────────────────────────────────────────────┘  │  │
│  │                                                                      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

                                    │
                                    │ HTTPS Webhooks
                                    ▼
                        ┌────────────────────────┐
                        │   EXTERNAL INTERNET    │
                        │                        │
                        │  Subscriber Endpoints  │
                        │  • https://partner1... │
                        │  • https://partner2... │
                        └────────────────────────┘
```

---

## 4. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          COMPLETE DATA FLOW                                 │
└─────────────────────────────────────────────────────────────────────────────┘

STEP 1: PRODUCER ONBOARDING
────────────────────────────
Producer → API Gateway → producer-onboarding Lambda → PostgreSQL
                                   ↓
                              AWS SES (Welcome Email)
                                   ↓
                          Response: {apiKey: "wh_prod_xxx"}


STEP 2: SCHEMA REGISTRATION
────────────────────────────
Producer → API Gateway → schema-admin Lambda → AWS Glue Schema Registry
                              ↓                        ↓
                         Validate API Key       Register Schema
                              ↓                        ↓
                         PostgreSQL ←──────── Get schemaArn
                              ↓
                    Response: {schemaId, schemaArn}


STEP 3: SUBSCRIBER ONBOARDING
──────────────────────────────
Subscriber → API Gateway → producer-onboarding Lambda → PostgreSQL
                                   ↓
                              AWS SES (Welcome Email)
                                   ↓
                          Response: {apiKey: "wh_sub_xxx"}


STEP 4: SUBSCRIPTION CREATION
──────────────────────────────
Subscriber → API Gateway → subscription-admin Lambda → PostgreSQL
                              ↓                              ↓
                         Generate Secret              INSERT subscription
                              ↓                              ↓
                         AWS SES ←────────────────── Update schema count
                              ↓
                    Confirmation Email (with secret)


STEP 5: EVENT PUBLISHING
─────────────────────────
Producer → API Gateway → event-publisher Lambda
             ↓                    ↓
        Validate API Key    SELECT schema FROM PostgreSQL
             ↓                    ↓
        Validate Payload    AWS Glue (Schema Validation)
             ↓                    ↓
        Idempotency Check   SELECT subscriptions WHERE schema_id = X
             ↓                    ↓
        FOR EACH subscription:
             ↓
        PUBLISH to Kafka (delivery-messages)
             │ {
             │   deliveryId: "dlv_xxx",
             │   eventId: "evt_xxx",
             │   subscriptionId: "sub_xxx",
             │   webhookUrl: "https://partner.com/webhook",
             │   webhookSecret: "secret_xxx",
             │   payload: {...},
             │   retryAttempt: 0,
             │   maxRetries: 3
             │ }
             ↓
        INSERT delivery_logs (status: 'queued')
             ↓
        Response: {eventId, subscriberCount, deliveriesQueued}


STEP 6: WEBHOOK DELIVERY
─────────────────────────
Kafka (delivery-messages) → delivery-consumer Lambda
                                  ↓
                        UPDATE delivery_log (status: 'delivering')
                                  ↓
                        Egress Gateway (HTTP Client)
                                  ↓
                        Add Headers:
                        • X-Webhook-Signature: HMAC-SHA256(payload, secret)
                        • X-Webhook-Event-Type: order.created
                        • X-Webhook-Event-Id: evt_xxx
                        • X-Webhook-Timestamp: 1234567890
                                  ↓
                        POST https://partner.com/webhook
                                  ↓
                        ┌─────────┴─────────┐
                        │                   │
                   SUCCESS (2xx)      FAILURE (5xx, timeout)
                        │                   │
                        ▼                   ▼
            UPDATE delivery_log      IF retryable AND
            (status: 'success')      within retry limit:
                   ↓                        ↓
            UPDATE event_messages    Calculate nextRetryAt
            (deliveries_completed++)      ↓
                   ↓                 PUBLISH to Kafka
            UPDATE subscriber              (retry-messages)
            (success_count++)             ↓
                                    UPDATE delivery_log
                                    (status: 'retrying')
                                          ↓
                                    PUBLISH to Kafka
                                    (status-notifications)


STEP 7: RETRY PROCESSING
─────────────────────────
Kafka (retry-messages) → retry-consumer Lambda
                              ↓
                    Check: now >= nextRetryAt?
                              ↓
                    ┌─────────┴─────────┐
                    │                   │
                   YES                 NO
                    │                   │
                    ▼                   ▼
            Check retry count        SKIP (Kafka
                    ↓               will redeliver)
            ┌───────┴───────┐
            │               │
    Within limit    Max retries exceeded
            │               │
            ▼               ▼
     REPUBLISH to      UPDATE delivery_log
    delivery-messages  (status: 'failed')
            │               ↓
            │          INSERT delivery_dlq
            │               ↓
            │          PUBLISH to Kafka
            │          (status-notifications)
            │          type: 'permanently_failed'
            │               ↓
            └───────────> Done


STEP 8: STATUS NOTIFICATIONS
─────────────────────────────
Kafka (status-notifications) → notification-consumer Lambda
                                      ↓
                              Parse notification type:
                              • delivery_failed
                              • delivery_permanently_failed
                                      ↓
                              IF failure rate > threshold:
                                      ↓
                              AWS SES (Alert Email)
                                      ↓
                              To: subscriber@example.com
                              Subject: "Webhook Delivery Failures"
                              Body: Error details, troubleshooting
                                      ↓
                              INSERT notification_logs
```

---

## 5. Database Entity Relationship Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                         DATABASE SCHEMA (ERD)                              │
└────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────┐
│       producers         │
├─────────────────────────┤
│ PK  id (UUID)           │
│     name                │
│     api_key_hash        │
│     contact_email       │
│     total_events_pub    │
│     status              │
│     created_at          │
└────────┬────────────────┘
         │
         │ 1:N
         │
         ▼
┌─────────────────────────┐              ┌────────────────────────┐
│        schemas          │              │    subscribers         │
├─────────────────────────┤              ├────────────────────────┤
│ PK  id (UUID)           │              │ PK  id (UUID)          │
│ FK  producer_id         │              │     name               │
│     schema_registry_id  │              │     api_key_hash       │
│     name                │              │     email              │
│     event_type (UNIQUE) │              │     webhook_url        │
│     version             │              │     status             │
│     schema_definition   │              │     created_at         │
│     is_public           │              └────────┬───────────────┘
│     subscription_count  │                       │
│     status              │                       │ 1:N
│     created_at          │                       │
└────────┬────────────────┘                       │
         │                                        │
         │ 1:N                                    │
         │                                        │
         ▼                                        ▼
┌─────────────────────────┐              ┌────────────────────────┐
│     subscriptions       │◄─────────────│   (same table)         │
├─────────────────────────┤              └────────────────────────┘
│ PK  id (UUID)           │
│ FK  subscriber_id       │
│ FK  schema_id           │
│     webhook_url         │
│     webhook_secret      │
│     max_retries         │
│     backoff_strategy    │
│     filter_rules (JSON) │
│     enabled             │
│     status              │
│     created_at          │
└────────┬────────────────┘
         │
         │ 1:N
         │
         ▼
┌─────────────────────────┐              ┌────────────────────────┐
│    event_messages       │              │    delivery_logs       │
├─────────────────────────┤              ├────────────────────────┤
│ PK  event_id (String)   │              │ PK  id (UUID)          │
│ FK  producer_id         │              │     delivery_id (STR)  │
│ FK  schema_id           │              │ FK  event_id           │
│     event_type          │──────1:N────>│ FK  subscription_id    │
│     payload (JSONB)     │              │     status             │
│     idempotency_key     │              │     response_status    │
│     subscriber_count    │              │     error_message      │
│     deliveries_queued   │              │     retry_attempt      │
│     deliveries_completed│              │     next_retry_at      │
│     deliveries_failed   │              │     latency_ms         │
│     created_at          │              │     delivered_at       │
└─────────────────────────┘              │     created_at         │
                                         └────────┬───────────────┘
                                                  │
                                                  │ 1:1 (when failed)
                                                  │
                                                  ▼
                                         ┌────────────────────────┐
                                         │     delivery_dlq       │
                                         ├────────────────────────┤
                                         │ PK  id (UUID)          │
                                         │ FK  delivery_log_id    │
                                         │     final_error        │
                                         │     total_attempts     │
                                         │     payload (JSONB)    │
                                         │     moved_to_dlq_at    │
                                         └────────────────────────┘


┌─────────────────────────┐              ┌────────────────────────┐
│   schema_approvals      │              │   notification_logs    │
├─────────────────────────┤              ├────────────────────────┤
│ PK  id (UUID)           │              │ PK  id (UUID)          │
│ FK  schema_id           │              │     notification_type  │
│ FK  subscriber_id       │              │     recipient_email    │
│     status (pending/    │              │     subject            │
│           approved/     │              │     body               │
│           rejected)     │              │     sent_at            │
│     requested_at        │              │     status             │
│     reviewed_at         │              └────────────────────────┘
│     reviewer_notes      │
└─────────────────────────┘


INDEXES:
────────
• delivery_logs(event_id)
• delivery_logs(subscription_id)
• delivery_logs(status, next_retry_at)
• subscriptions(schema_id)
• subscriptions(subscriber_id)
• event_messages(producer_id)
• event_messages(idempotency_key)
• schemas(event_type) UNIQUE
```

---

## 6. Sequence Diagram - Complete Event Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│            SEQUENCE: Complete Event Publishing & Delivery Flow               │
└──────────────────────────────────────────────────────────────────────────────┘

Producer  API GW  EventPub   DB    Glue  Kafka  DeliveryConsumer  Egress  Subscriber
   │        │        │        │      │      │           │           │         │
   │ POST   │        │        │      │      │           │           │         │
   │/events │        │        │      │      │           │           │         │
   │/publish│        │        │      │      │           │           │         │
   ├───────>│        │        │      │      │           │           │         │
   │        │invoke  │        │      │      │           │           │         │
   │        ├───────>│        │      │      │           │           │         │
   │        │        │validate│      │      │           │           │         │
   │        │        │API key │      │      │           │           │         │
   │        │        ├───────>│      │      │           │           │         │
   │        │        │        │      │      │           │           │         │
   │        │        │get     │      │      │           │           │         │
   │        │        │schema  │      │      │           │           │         │
   │        │        ├───────>│      │      │           │           │         │
   │        │        │<───────┤      │      │           │           │         │
   │        │        │        │      │      │           │           │         │
   │        │        │validate│      │      │           │           │         │
   │        │        │payload │      │      │           │           │         │
   │        │        ├───────────────>│      │           │           │         │
   │        │        │<───────────────┤      │           │           │         │
   │        │        │   valid        │      │           │           │         │
   │        │        │        │      │      │           │           │         │
   │        │        │get subs│      │      │           │           │         │
   │        │        ├───────>│      │      │           │           │         │
   │        │        │<───────┤      │      │           │           │         │
   │        │        │        │      │      │           │           │         │
   │        │        │create  │      │      │           │           │         │
   │        │        │event   │      │      │           │           │         │
   │        │        ├───────>│      │      │           │           │         │
   │        │        │<───────┤      │      │           │           │         │
   │        │        │        │      │      │           │           │         │
   │        │        │publish │      │      │           │           │         │
   │        │        │message │      │      │           │           │         │
   │        │        ├───────────────────────>│          │           │         │
   │        │        │        │      │      │           │           │         │
   │        │ 202    │        │      │      │           │           │         │
   │        │Accepted│        │      │      │           │           │         │
   │        │<───────┤        │      │      │           │           │         │
   │<───────┤        │        │      │      │           │           │         │
   │        │        │        │      │      │           │           │         │
   │        │        │        │      │      │  consume  │           │         │
   │        │        │        │      │      ├──────────>│           │         │
   │        │        │        │      │      │           │           │         │
   │        │        │        │      │      │           │update     │         │
   │        │        │        │      │      │           │delivering │         │
   │        │        │        │      │      │           ├──────────>│         │
   │        │        │        │      │      │           │           │         │
   │        │        │        │      │      │           │send       │         │
   │        │        │        │      │      │           │webhook    │         │
   │        │        │        │      │      │           ├──────────────────────>│
   │        │        │        │      │      │           │           │  200 OK  │
   │        │        │        │      │      │           │<──────────────────────┤
   │        │        │        │      │      │           │           │         │
   │        │        │        │      │      │           │update     │         │
   │        │        │        │      │      │           │success    │         │
   │        │        │        │      │      │           ├──────────>│         │
   │        │        │        │      │      │           │           │         │
```

---

## 7. Security Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         SECURITY LAYERS                                      │
└──────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ LAYER 1: NETWORK SECURITY                                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Internet → WAF → CloudFront → API Gateway                                  │
│             │                                                                │
│             ├─ DDoS Protection (AWS Shield)                                 │
│             ├─ Rate Limiting (1000 req/sec per IP)                          │
│             ├─ SQL Injection Prevention                                     │
│             └─ XSS Protection                                               │
│                                                                              │
│  VPC Security Groups:                                                        │
│  • Lambda SG: Allow outbound to RDS (5432), MSK (9092)                      │
│  • RDS SG: Allow inbound from Lambda SG only                                │
│  • MSK SG: Allow inbound from Lambda SG only                                │
│                                                                              │
│  Network ACLs:                                                               │
│  • Public Subnet: Allow HTTPS (443), HTTP (80)                              │
│  • Private Subnet: Allow internal traffic only                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ LAYER 2: AUTHENTICATION & AUTHORIZATION                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  API Key Authentication:                                                     │
│  • X-API-Key header required for all endpoints                              │
│  • API keys: wh_prod_xxx (producers), wh_sub_xxx (subscribers)              │
│  • Stored as bcrypt hash in database                                        │
│  • Validated on every request                                               │
│                                                                              │
│  Authorization:                                                              │
│  • Producers can only access their own schemas                              │
│  • Subscribers can only access their own subscriptions                      │
│  • Row-level security checks in all queries                                 │
│                                                                              │
│  IAM Roles (Least Privilege):                                               │
│  • Lambda Execution Role: RDS, MSK, Secrets, SES, Glue access              │
│  • API Gateway Role: Invoke Lambda only                                     │
│  • CloudWatch Role: Write logs only                                         │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ LAYER 3: DATA ENCRYPTION                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  In Transit:                                                                 │
│  • TLS 1.3 for all external connections                                     │
│  • HTTPS only (no HTTP)                                                     │
│  • Certificate: AWS ACM (auto-renewed)                                      │
│                                                                              │
│  At Rest:                                                                    │
│  • RDS: Encrypted with AWS KMS (AES-256)                                    │
│  • MSK: Encrypted with AWS KMS                                              │
│  • Secrets Manager: Encrypted with KMS                                      │
│  • S3 Backups: Server-side encryption (SSE-S3)                              │
│                                                                              │
│  Webhook Signatures:                                                         │
│  • HMAC-SHA256(payload + timestamp, secret)                                 │
│  • X-Webhook-Signature header                                               │
│  • Prevents tampering and replay attacks                                    │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ LAYER 4: APPLICATION SECURITY                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Input Validation:                                                           │
│  • JSON Schema validation on all inputs                                     │
│  • SQL injection prevention (parameterized queries)                         │
│  • XSS prevention (no HTML in responses)                                    │
│  • URL validation for webhook endpoints                                     │
│                                                                              │
│  Rate Limiting:                                                              │
│  • API Gateway: 1000 req/sec per API key                                    │
│  • DynamoDB/Redis: Track request counts                                     │
│  • Burst limit: 2000 requests                                               │
│                                                                              │
│  Secrets Management:                                                         │
│  • Database credentials: AWS Secrets Manager                                │
│  • API keys: Bcrypt hashed (never plain text)                               │
│  • Webhook secrets: 256-bit random                                          │
│  • Rotation: 90 days                                                        │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ LAYER 5: MONITORING & AUDIT                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  CloudWatch Logs:                                                            │
│  • All Lambda invocations logged                                            │
│  • API Gateway access logs                                                  │
│  • Database query logs (slow queries)                                       │
│  • 30-day retention                                                          │
│                                                                              │
│  CloudTrail:                                                                 │
│  • All AWS API calls audited                                                │
│  • S3 bucket with versioning                                                │
│  • 90-day retention                                                          │
│                                                                              │
│  Security Alarms:                                                            │
│  • Failed authentication attempts > 10/min                                   │
│  • IAM policy changes                                                        │
│  • Security group modifications                                             │
│  • Unusual API call patterns                                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

This comprehensive set of diagrams covers all major aspects of the webhook management system architecture!

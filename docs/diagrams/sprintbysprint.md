Sprint-by-Sprint Story Point Plan
Sprint 1 (Oct 16 – Oct 29) – Governance Kickoff
Capacity: ~20 SP (3 Devs + DevOps focus)
•	CSO Approval Process → 8 SP
•	CR Process → 6 SP
•	Build Job Pipeline (CI/CD base) → 6 SP
✅ Total: 20 SP

Sprint 2 (Oct 30 – Nov 12) – Governance Closure + Start Infra
Capacity: ~20 SP
•	CSO review closure + rework → 3 SP
•	CR approval → 3 SP
•	CI/CD Dev deployment automation → 5 SP
•	Kafka cluster provisioning (AWS MSK) → 9 SP
✅ Total: 20 SP

Sprint 3 (Nov 13 – Nov 26) – Kafka & RDS Setup
Capacity: ~22 SP (heavy DevOps + backend)
•	Kafka topics + partitions + IAM integration → 5 SP
•	PostgreSQL (RDS) provisioning + schema → 5 SP
•	Base Lambda functions (skeleton deployment) → 8 SP
•	Monitoring & logging baseline (CloudWatch/MSK) → 4 SP
✅ Total: 22 SP

Sprint 4 (Nov 27 – Dec 10) – Lambdas & DLQ
Capacity: ~22 SP
•	API Gateway + Lambda integration → 5 SP
•	Lambda <-> Kafka event flow validation → 5 SP
•	Retry + DLQ setup (SQS or Kafka DLQ) → 8 SP
•	CI/CD extended with integration tests → 4 SP
✅ Total: 22 SP

Sprint 5 (Dec 11 – Dec 24) – Core APIs – Part 1
Capacity: ~23 SP (backend-heavy)
•	Schema Registration Admin API → 8 SP
•	Webhook Subscription Admin API → 5 SP
•	DB persistence validation → 5 SP
•	E2E test: Schema + Subscription flow → 5 SP
✅ Total: 23 SP

Sprint 6 (Dec 25 – Jan 7) – Core APIs – Part 2
Capacity: ~25 SP (holiday sprint, but backend focus)
•	Message Ingestion API → 8 SP
•	Delivery API (async delivery + status logging) → 8 SP
•	Retry mechanism (exponential backoff) → 8 SP
•	Event storage + delivery logs in PostgreSQL → 5 SP
✅ Total: 25 SP

Sprint 7 (Jan 8 – Jan 21) – Delivery Status + UI Start
Capacity: ~22 SP (backend + frontend split)
•	Delivery Status API → 5 SP
•	UI for Schema Registration → 5 SP
•	UI for Subscription Management → 5 SP
•	End-to-end flow validation (Ingestion → Delivery → Status) → 7 SP
✅ Total: 22 SP

Sprint 8 (Jan 22 – Feb 4) – UI + Dashboard Finalization
Capacity: ~23 SP (frontend-heavy + QA)
•	Delivery Status Dashboard UI → 8 SP
•	API + UI integration testing → 5 SP
•	Performance/load testing (Kafka throughput, Lambda scaling, DB) → 5 SP
•	Bug fixes & refinements → 5 SP
✅ Total: 23 SP

Final Phase (Feb 5 – Feb 15) – Stabilization & Go-Live
Capacity: ~10–12 SP (wrap-up sprint)
•	UAT with business stakeholders → 4 SP
•	Production CR submission & approval → 3 SP
•	Production deployment → 3 SP
•	Documentation & handover → 2 SP
✅ Total: ~12 SP

🔹 Roll-up Summary
•	Total SP across sprints = ~164 SP (matches planned scope)
•	Velocity assumed = ~20–25 SP per sprint with 3 devs + part-time DevOps + QA ramp-up
•	Peak workload = Sprints 5–6 (core APIs & delivery engine)
•	QA-heavy workload = Sprints 7–8 + final phase


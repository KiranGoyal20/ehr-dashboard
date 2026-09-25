# EHR Patient Dashboard

A full-stack application that integrates with multiple EHR/FHIR sandbox environments, normalizes patient clinical data into PostgreSQL, and provides a unified dashboard for viewing patients, conditions, and medications.

The application currently integrates with:

* **HAPI FHIR R4** — public test server
* **Oracle Health / Cerner Millennium R4** — open sandbox
* **Epic FHIR R4** — SMART on FHIR sandbox integration

---

## Tech Stack

* **Next.js 16** with App Router
* **React 19**
* **TypeScript 5**
* **Tailwind CSS**
* **PostgreSQL / Neon**
* **`pg`** for database access
* **FHIR R4**
* **SMART on FHIR / OAuth 2.0 + PKCE** for Epic

---

## Architecture

The application uses Next.js as both the frontend and backend.

```text
                  ┌─────────────────────┐
                  │   React Dashboard   │
                  └──────────┬──────────┘
                             │
                      Next.js API Routes
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
          ▼                  ▼                  ▼
     HAPI FHIR          Oracle Health        Epic FHIR
       R4 API             R4 API          SMART on FHIR
          │                  │                  │
          └──────────────────┼──────────────────┘
                             │
                    Normalization Layer
                             │
                             ▼
                       PostgreSQL
                             │
                             ▼
                   Unified Patient API
```

Vendor-specific FHIR resources are mapped into a common internal representation before persistence. This allows the dashboard to use the same database queries and UI regardless of the originating EHR.

The original FHIR resources are also retained in `JSONB` fields so vendor-specific data is not lost during normalization.

---

## Features

### Multi-EHR Dashboard

The dashboard allows switching between EHR sources and viewing synchronized patients from each source.

For each patient, the application displays:

* Demographics (name, gender, birth date, MRN / external ID)
* Conditions (diagnoses, ICD/SNOMED codes, clinical status)
* Medications (prescriptions, medication codes, status, intent)
* Source EHR
* Original normalized clinical information and full raw FHIR JSON payload drill-down

### Manual Synchronization

The dashboard provides synchronization actions for supported EHR sources.

A synchronization:

1. Fetches data from the vendor's FHIR API.
2. Maps the FHIR resources into the application's normalized model.
3. Upserts the records into PostgreSQL.
4. Refreshes the dashboard using the persisted data.

Previously synchronized records remain available if an external sandbox is temporarily unavailable.

---

## HAPI FHIR Integration

HAPI uses the public R4 FHIR test server:

```text
https://hapi.fhir.org/baseR4
```

The integration retrieves:

* `Patient`
* `Condition`
* `MedicationRequest`

Patient pagination is handled using the FHIR Bundle `link` whose `relation` is `next`, rather than assuming a vendor-specific page-number format.

The demo sync intentionally processes a bounded sample rather than attempting to ingest the entire public HAPI server.

---

## Oracle Health Integration

The Oracle Health integration uses the Millennium R4 Open Sandbox:

```text
https://fhir-open.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d
```

It retrieves:

* `Patient`
* `Condition`
* `MedicationRequest`

Oracle's patient search pagination is handled by following the `next` link supplied in the returned FHIR Bundle.

The demo synchronization is deliberately bounded to keep execution predictable against a shared public sandbox. Clinical resource processing is also capped for the demonstration rather than attempting to ingest an unbounded amount of sandbox data.

Oracle sandbox requests may occasionally experience high latency or transient failures. The client therefore implements:

* Request timeouts (45 seconds)
* Retries for transient HTTP failures
* Exponential backoff
* Jitter
* `429 Too Many Requests` handling
* `Retry-After` support (both delta-seconds and HTTP-date formats per RFC 7231)
* Isolation of per-patient clinical-data failures

A failed clinical request for one patient therefore does not necessarily invalidate the complete synchronization.

---

## Epic Integration

Epic required a different integration approach because its FHIR APIs are protected by SMART on FHIR authorization.

A non-production Epic application was registered with:

* FHIR R4
* SMART v2
* Clinician / administrative audience
* Patient APIs
* Condition APIs
* MedicationRequest APIs

The application implements a SMART standalone authorization flow using OAuth 2.0 Authorization Code + PKCE (`S256`).

```text
Dashboard
   │
   ▼
Connect Epic
   │
   ▼
Epic Authorization
   │
   ▼
Epic User Authentication (Hyperspace Web)
   │
   ▼
Authorization Code
   │
   ▼
Token Exchange (PKCE)
   │
   ▼
Access Token
   │
   ▼
Epic FHIR R4 API
```

The implementation validates OAuth `state` and uses PKCE through a generated `code_verifier` and SHA-256 `code_challenge`.

### Epic Sandbox Testing Credentials

When clicking **"Sync Epic Data"**, Epic redirects to its simulated clinician portal (**Hyperspace Web** at `fhir.epic.com/HSWeb_uscdi/`). Because the application is configured for a Clinician audience, use Epic's standard sandbox clinician test credentials:

* **User ID**: `FHIR` *(or `FHIRTWO`)*
* **Password**: `EpicFhir11!`

### Epic Sandbox Context Handling

The standalone OAuth flow successfully authenticates and obtains an access token.

However, standalone clinician authentication does not inherently attach an active patient chart context. During sandbox testing, no patient FHIR ID is returned in the login/token context (unlike a patient-facing MyChart launch with `launch/patient`).

To validate the clinical data synchronization and downstream ingestion, the sandbox callback uses verified Epic sandbox patient identifiers (such as **Derrick Lin**, FHIR ID: `eq081-VQEgP8drUUqCWzHfw3` and **Camila Lopez**, FHIR ID: `erHIxAOdropDUHGkVZm2HgA3`) after successful authentication.

This exercises the full authenticated FHIR request path (Patient read, Condition query, and MedicationRequest query), successfully persisting their demographics, active problem list, and prescriptions.

In a production Epic deployment, patient context would typically be supplied through an EHR SMART launch when launched directly from an active chart in Hyperspace, or through a dedicated clinician patient-search workflow.

---

## Data Model

The schema uses PostgreSQL with `pgcrypto` (`src/lib/db/migrations/001_initial.sql`).

### Patients

Stores normalized demographics including:

* EHR source (`HAPI` | `ORACLE` | `EPIC`)
* Vendor patient ID (`external_id`)
* First name
* Last name
* Gender
* Birth date
* Original FHIR resource (`raw_data JSONB`)

The pair:

```text
(source, external_id)
```

is unique.

This is important because the same external identifier could theoretically exist in two different EHR systems.

### Conditions

Conditions reference the normalized patient record and retain:

* Vendor condition ID (`external_id`)
* Patient foreign key (`patient_id REFERENCES patients(id) ON DELETE CASCADE`)
* Code
* Display value
* Clinical status
* Original FHIR resource (`raw_data JSONB`)

Unique constraint: `(source, external_id)`.

### Medications

Medication requests retain:

* Vendor medication/request ID (`external_id`)
* Patient foreign key (`patient_id REFERENCES patients(id) ON DELETE CASCADE`)
* Code
* Display value
* Status
* Intent
* Original FHIR resource (`raw_data JSONB`)

Unique constraint: `(source, external_id)`.

---

## Idempotency

Repeated synchronization must not create duplicate patients or clinical resources.

This is enforced at the database level using unique constraints:

```text
(source, external_id)
```

Synchronization uses PostgreSQL upserts:

```sql
INSERT INTO patients (source, external_id, first_name, last_name, gender, birth_date, raw_data)
VALUES ($1, $2, $3, $4, $5, $6, $7)
ON CONFLICT (source, external_id)
DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  gender = EXCLUDED.gender,
  birth_date = EXCLUDED.birth_date,
  raw_data = EXCLUDED.raw_data,
  updated_at = NOW();
```

rather than performing a separate read-before-insert check.

This makes repeated synchronization idempotent and avoids race conditions associated with application-only duplicate checking.

Repeated HAPI, Oracle, and Epic synchronizations were tested without creating duplicate records.

---

## Pagination

FHIR APIs return paginated `Bundle` resources.

Instead of generating page URLs locally, the integrations follow the server-provided:

```text
Bundle.link[relation="next"]
```

URL.

This is important because pagination implementations differ between EHR vendors. For example, Oracle includes opaque paging tokens in its next-page URL.

The demo intentionally limits the total amount of data synchronized from public sandboxes.

---

## Rate Limits and External API Reliability

External EHR APIs are treated as unreliable dependencies.

The API clients implement bounded retry behavior for transient failures such as:

```text
408 Request Timeout
429 Too Many Requests
5xx Server Errors
network failures
request timeouts
```

Retries use exponential backoff with full randomized jitter:

$$T_{backoff} = \min(T_{max}, T_{base} \times 2^{attempt}) + \text{random}(0, 500\text{ms})$$

Where available, the HTTP `Retry-After` header is respected (supporting both integer delta-seconds and RFC 7231 HTTP-date formats).

Non-transient client errors are not blindly retried.

Public sandbox endpoints can occasionally exhibit transient latency or availability problems, so previously persisted records remain usable even when a new synchronization cannot be completed.

---

## Running Locally

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create `.env.local` or `.env`:

```env
# PostgreSQL Connection (Neon)
DATABASE_URL="postgresql://user:password@ep-sample-pooler.region.neon.tech/neondb?sslmode=require"

# Epic SMART on FHIR Sandbox Configuration
EPIC_CLIENT_ID="eb0b13dd-42b6-4397-bce0-ab7bbe1efcc6"
EPIC_FHIR_BASE_URL="https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4"
EPIC_REDIRECT_URI="http://localhost:3000/api/auth/epic/callback"
```

Do not commit `.env.local`, database credentials, OAuth tokens, or other secrets.

### 3. Create the database schema

Execute the migration file [`src/lib/db/migrations/001_initial.sql`](src/lib/db/migrations/001_initial.sql) against your PostgreSQL database (e.g., via the Neon SQL Editor or `psql`).

### 4. Start the application

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

---

## API Routes

The application exposes internal endpoints for operations such as:

```text
POST /api/sync/hapi
POST /api/sync/oracle

GET  /api/patients
GET  /api/patients/:id

GET  /api/auth/epic/login
GET  /api/auth/epic/callback
```

Epic synchronization is initiated through its authenticated SMART flow rather than treating it as an unauthenticated sandbox sync.

---

## What I Would Change for a Real Hospital With 25,000+ Patients

The current architecture intentionally favors simplicity for a take-home project. I would not perform a 25,000-patient synchronization inside a single HTTP request in production.

### 1. Asynchronous Ingestion Pipeline

The sync endpoint would create a background synchronization job rather than holding an HTTP connection open:

```text
User / Cron requests sync
          │
          ▼
   API creates Sync Job
          │
          ▼
  Message Queue (Redis / Kafka)
          │
          ▼
  Background Workers (Temporal / BullMQ)
          │
          ▼
   FHIR Bulk / REST APIs
          │
          ▼
  PostgreSQL (Partitioned Cluster)
```

The UI would display job status, progress percentages, and checkpoints rather than waiting synchronously.

### 2. Bulk Data Access (`$export`)

Where supported by the EHR, I would use the **HL7 FHIR Bulk Data Access specification (`$export`)** instead of making tens of thousands of sequential per-patient REST API calls:

1. Authenticate using **SMART Backend Services** (asymmetric RSA-SHA256 signed JWTs with `system/*.read` scopes, requiring no interactive human login).
2. Issue a kick-off request:
   ```http
   GET /Group/[id]/$export?_type=Patient,Condition,MedicationRequest
   Prefer: respond-async
   ```
3. Poll the `Content-Location` status URL until the EHR outputs Newline-Delimited JSON (`.ndjson`) files.
4. Workers stream the `.ndjson` files directly from cloud storage (S3/GCS) line-by-line with backpressure, avoiding massive memory overhead.

### 3. Incremental Synchronization (CDC & Delta Sync)

After an initial import, synchronization should fetch only records that changed since the previous checkpoint:

* Use the `_since` FHIR parameter (e.g. `_since=2026-09-24T00:00:00Z`) for efficient delta polling.
* Configure **FHIR Subscriptions** (REST hooks / WebSockets) on the EHR gateway to push real-time notifications for ADT (Admission, Discharge, Transfer) events and new prescriptions.

Sync state tracking would include:

* Last successful synchronization timestamp
* Pagination and cursor checkpoint state
* Records processed, updated, and skipped
* Failure logs and retry counts

### 4. Controlled Concurrency & Distributed Rate Limiting

FHIR calls would use bounded concurrency rather than firing unmetered requests simultaneously:

* Implement a distributed **token-bucket rate limiter** in Redis keyed per EHR gateway endpoint.
* Concurrency pools (e.g. 5–10 concurrent requests per vendor gateway) protect both the application and the EHR from traffic spikes and keep rate-limit consumption predictable.

### 5. High-Throughput Database Scalability

For a hospital system with 25,000+ patients and millions of associated clinical records:

* **Table Partitioning**: Apply PostgreSQL Declarative Partitioning on `patients`, `conditions`, and `medications` by `source` and quarterly date ranges (`created_at`) or hash-partitioning on `patient_id`.
* **High-Speed Staging & Batch Upserts**: Stream parsed records into `UNLOGGED` temporary tables via PostgreSQL binary `COPY`, then execute set-based merge upserts (`INSERT ... ON CONFLICT DO UPDATE`) in micro-batches (500–1,000 rows).
* **Connection Pooling**: Deploy **PgBouncer** or Neon Connection Pooling in transaction pooling mode to prevent connection starvation under high worker concurrency.
* **CQRS (Read/Write Separation)**: Direct ingestion writes to the primary database, while routing dashboard queries and clinical search to read replicas.

### 6. Failure Recovery & Dead-Letter Queues (DLQ)

* Individual patient/resource failures are routed to a **Dead-Letter Queue (DLQ)** with raw payload snapshots and error diagnostics for triage.
* A failure near the end of a large 25,000-patient batch resumes from the last confirmed checkpoint rather than restarting the entire import.

### 7. Observability

Production ingestion would include:

* Structured JSON logging with OpenTelemetry trace and correlation IDs
* Metrics dashboards (Prometheus / Grafana) monitoring sync duration, API latency, queue depth, error rates, and rate-limit headroom
* Real-time alerts (Slack / PagerDuty) on consecutive vendor 5xx errors or queue stalls

### 8. Security and Compliance

For real patient data, additional controls would include:

* Full HIPAA compliance controls and BAA agreements
* Encryption in transit (TLS 1.3) and at rest (AES-256 with KMS)
* Least-privilege OAuth scopes
* Immutable audit logging (HIPAA § 164.312(b)) tracking every PHI access, query, and mutation
* Automated token lifecycle management with encrypted credential storage (AWS Secrets Manager / HashiCorp Vault)
* Strict sanitization to prevent PHI exposure in logs or telemetry

---

## Key Design Decisions

**Next.js full stack rather than a separate backend**

For the scope of this take-home, a separate backend service would introduce operational complexity without providing significant value. Route handlers provide a clean boundary between the browser, database, and external EHR APIs.

For large-scale ingestion, long-running synchronization would be separated into dedicated workers/services.

**PostgreSQL upserts for idempotency**

Idempotency is enforced by database constraints rather than trusting application code alone.

**Common normalized model**

The UI does not need to understand HAPI-, Oracle-, or Epic-specific resource structures.

**Preserve raw FHIR**

Normalization makes common queries fast and simple while `JSONB` preserves vendor-specific information that may be useful later.

**Server-provided pagination**

FHIR `next` links are followed instead of assuming pagination works identically across vendors.

---

## Current Scope and Trade-offs

This project is intentionally a bounded demonstration rather than a production EHR ingestion platform.

The core required flows implemented and validated are:

* HAPI FHIR patient synchronization
* HAPI conditions and medications
* Oracle Health patient synchronization
* Oracle conditions and medications
* FHIR pagination
* PostgreSQL persistence
* Idempotent repeated synchronization
* Multi-EHR dashboard
* Patient details drill-down with raw JSON inspection
* Retry/rate-limit handling with exponential backoff and jitter
* Epic SMART on FHIR OAuth 2.0 PKCE authentication and synchronization

The main known limitation is that Epic standalone sandbox authentication did not supply patient context during testing, so the Epic sandbox validation uses known sandbox patient IDs rather than implementing general Epic patient discovery.

---

## Notes

All integrations in this project use **sandbox/test data only**.

The application must not be used with real PHI without the security, compliance, infrastructure, authorization, and operational controls required for a production healthcare environment.

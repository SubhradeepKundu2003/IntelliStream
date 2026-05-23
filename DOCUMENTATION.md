# IntelliStream — Full Project Documentation

> **Version:** As of May 2026  
> **Stack:** React 19 + TypeScript · Python FastAPI · Java 21 Spring Boot · PostgreSQL · Ollama (AI)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Project Structure](#3-project-structure)
4. [User Roles & Permissions](#4-user-roles--permissions)
5. [Frontend](#5-frontend)
6. [Backend — Python FastAPI](#6-backend--python-fastapi)
7. [Backend — Spring Boot](#7-backend--spring-boot)
8. [Database Schema](#8-database-schema)
9. [Features In Detail](#9-features-in-detail)
10. [API Reference](#10-api-reference)
11. [Data Flow](#11-data-flow)
12. [Configuration & Environment](#12-configuration--environment)
13. [Running the Project](#13-running-the-project)

---

## 1. Project Overview

**IntelliStream** is a trainee stream allocation and management platform built for TCS. It automates the process of assigning freshly onboarded trainees to technology streams (e.g., Java, Python, Cloud, AI/ML) based on:

- **DPI Score** — Aptitude score (0–5 scale) from the training management system
- **Subject Exam Scores** — Per-subject exam averages (0–100 scale)
- **Stream Subject Weights** — Configurable importance of each subject per stream
- **Stream Priority & Capacity** — Business-driven constraints on how many trainees each stream should absorb
- **Manual Overrides** — Manager/admin can override the algorithm for specific trainees
- **AI Recommendations** — Ollama-powered analysis that cross-checks the algorithm's decisions

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│             Frontend — React 19 + Vite + TypeScript              │
│                         localhost:5173                           │
└────────────────────────────┬─────────────────────────────────────┘
                             │ HTTP / REST (JWT)
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│           Auth Service — Python FastAPI                          │
│                        localhost:8000                            │
│                                                                  │
│  Modules: auth · streams · allocation · sync · notifications     │
│           business_requirements · scores_upload · dashboard      │
│           stream_templates · ai_suggestions · trainees           │
│                                                                  │
│  PostgreSQL: intellistream_auth                                  │
└────────────┬─────────────────────────────┬───────────────────────┘
             │ HTTP (on sync trigger)       │ HTTP
             ▼                             ▼
┌────────────────────────┐    ┌────────────────────────────────────┐
│  Spring Boot — Java 21  │    │  Ollama — Local LLM                │
│  localhost:8081         │    │  localhost:11434                   │
│  DB: intellistream_deco │    │  Model: gpt-oss:20b (default)      │
│                         │    │  Used for AI recommendations        │
│  Manages:               │    └────────────────────────────────────┘
│  · Batch definitions    │
│  · DPI records (0–5)    │
│  · Subject scores       │
└────────────────────────┘
```

**Key design decisions:**
- Spring Boot is the **source of truth** for raw training data; FastAPI syncs from it on demand
- FastAPI handles all business logic (allocation, streams, auth, notifications)
- Excel upload as an **alternative** to Spring Boot sync for batches where data isn't in the Spring Boot system
- Manual overrides and freeze states are **preserved** across allocation re-runs

---

## 3. Project Structure

```
IntelliStream/
├── intellistream-frontend-V1/     React + TypeScript frontend
│   ├── src/
│   │   ├── pages/                 All page components
│   │   ├── components/            Shared UI components
│   │   ├── contexts/              AuthContext (JWT management)
│   │   ├── services/              api.ts — all HTTP calls
│   │   └── types/                 TypeScript type definitions
│   ├── .env
│   └── vite.config.ts
│
├── auth-service/                  Python FastAPI backend
│   ├── auth/                      JWT auth, user management
│   ├── streams/                   Batch-specific stream config
│   ├── stream_templates/          Global stream library
│   ├── allocation/                Allocation engine + AI
│   ├── ai_suggestions/            AI stream suggestions
│   ├── sync/                      Spring Boot data sync
│   ├── batch_management/          Batch proxy to Spring Boot
│   ├── trainees/                  Trainee management
│   ├── business_requirements/     BR & capacity planning
│   ├── scores_upload/             Excel-based score upload
│   ├── notifications/             User notification system
│   ├── dashboard/                 KPIs and stats API
│   ├── models.py                  Global SQLAlchemy models
│   ├── database.py                DB session setup
│   ├── config.py                  Environment config
│   ├── main.py                    App entry, migrations, seeding
│   └── requirements.txt
│
└── IntelliStreamDeco/             Java Spring Boot data service
    └── src/main/java/.../
        ├── controller/            REST controllers
        ├── entity/                JPA entities
        ├── repository/            Spring Data repositories
        └── service/               Business services
```

---

## 4. User Roles & Permissions

| Action | Admin | Manager | SME |
|--------|:-----:|:-------:|:---:|
| Login / view dashboard | ✅ | ✅ | ✅ |
| View allocation results | ✅ | ✅ | ✅ |
| View stream configuration | ✅ | ✅ | ✅ |
| View stream templates | ✅ | ✅ | ✅ (read-only) |
| Run allocation engine | ✅ | ✅ | ❌ |
| Override trainee allocation | ✅ | ✅ | ❌ |
| Freeze / unfreeze batch | ✅ | ✅ | ❌ |
| Freeze / unfreeze trainee | ✅ | ✅ | ❌ |
| Generate AI recommendations | ✅ | ✅ | ❌ |
| Update scoring weights | ✅ | ✅ | ❌ |
| Create / rename / delete streams | ✅ | ✅ | ❌ |
| Assign SMEs to streams | ✅ | ✅ | ❌ |
| Approve / reject weight proposals | ✅ | ✅ | ❌ |
| Review SME associate requests | ✅ | ✅ | ❌ |
| Submit SME associate requests | ❌ | ❌ | ✅ |
| Propose stream weight changes | ❌ | ❌ | ✅ (assigned streams) |
| Manage business requirements | ✅ | ✅ | ❌ |
| Manage batches & trainees | ✅ | ✅ | ❌ |
| User management (create/deactivate) | ✅ | ❌ | ❌ |
| Export allocation to Excel | ✅ | ✅ | ❌ |
| Upload Excel scores | ✅ | ✅ | ❌ |
| Trigger data sync | ✅ | ✅ | ❌ |

---

## 5. Frontend

**Tech:** React 19, Vite, TypeScript, Tailwind CSS, Lucide Icons, Axios

### Pages & Routes

| Route | Page | Who Can Access |
|-------|------|----------------|
| `/login` | LoginPage | Public (redirects to home if logged in) |
| `/` | LandingPage | Public (redirects based on auth state) |
| `/home` | HomePage (Dashboard) | All authenticated users |
| `/streams` | StreamManagementPage | All authenticated users |
| `/allocation` | AllocationPage | Admin, Manager, SME |
| `/admin/users` | UserManagementPage | Admin only |
| `/admin/training-data` | SpringBootDataPage | Manager, Admin |
| `/admin/trainees` | TraineePage | Manager, Admin |
| `/admin/stream-templates` | StreamTemplatesPage | Manager, Admin, SME |
| `/admin/business-requirements` | BusinessRequirementsPage | Manager, Admin |

### Key Components

| Component | Purpose |
|-----------|---------|
| `AppLayout.tsx` | Main layout with sidebar navigation, header, notification bell |
| `ProtectedRoute.tsx` | Redirects to `/login` if no valid token |
| `GuestRoute.tsx` | Redirects to `/home` if already authenticated |
| `RoleRoute.tsx` | Shows 403 if user's role is insufficient |
| `NotificationBell.tsx` | Polls unread count, opens notification panel |
| `Button.tsx` | Shared button with variants: primary, secondary, ghost; sizes: sm, md, lg; loading state |
| `Modal.tsx` | Accessible overlay modal with configurable width |
| `Input.tsx` | Labeled input with inline error display |
| `ThemeToggle.tsx` | Light/dark mode switcher (persisted in localStorage) |

### Auth Context

**File:** `src/contexts/AuthContext.tsx`

- Reads JWT from `localStorage`
- Decodes payload to extract `email` and `role`
- Transparently refreshes access token on 401 (using refresh token)
- Provides: `user`, `login(email, password)`, `logout()`

### TypeScript Types

**`types/allocation.ts`**
```typescript
AllocationConfig        // batch_name, score_weight, dpi_weight, last_run_at, is_frozen
TraineeAllocation       // all allocation fields + score_breakdown + all_stream_scores
AllocationRunResult     // total, allocated, unallocated, mode ('priority' | 'fit_score')
AllocationAIRecommendation  // agrees_with_algorithm, confidence, reasoning
SMEAssociateRequest     // requested_employee_ids, status, approved_employee_ids
```

**`types/streams.ts`**
```typescript
BatchStream             // id, batch_name, name, priority, trainee_pct
StreamTemplate          // global template with subjects + intake_pct
WeightProposal          // proposed_weights, status, review tracking
BatchStreamSME          // SME assignment to a stream
StreamSuggestion        // AI-generated stream suggestion
SubjectName             // 'java' | 'python' | 'sql' | 'cybersecurity' | 'agile' | 'aiml' | 'webtech' | 'cloud'
```

**`types/sync.ts`**
```typescript
SyncedBatch             // batch_name, subjects, trainee_count, synced_at
SyncedDpiRecord         // trainee_id, batch_name, dpi (0-5), location
SyncedSubjectScore      // trainee_id, subject_name, score (0-100)
SyncStatus              // source, last_sync_at, last_sync_status
```

**`types/business_requirements.ts`**
```typescript
BusinessRequirement     // batch_name, title, location
BRStream                // name, is_mandatory, capacity_type, capacity_value, roles_needed, subjects_needed
```

**`types/dashboard.ts`**
```typescript
DashboardStats          // KPIs + stream_distribution + score_by_stream + recent_activity
```

---

## 6. Backend — Python FastAPI

**Entry:** `auth-service/main.py`  
**Port:** 8000  
**DB:** PostgreSQL (`intellistream_auth`)

### Module Overview

| Module | Prefix | Purpose |
|--------|--------|---------|
| `auth` | `/auth` | JWT login, register, refresh, user CRUD |
| `streams` | `/batches/{batch}/streams` | Batch-specific stream config, weights, SME assignments |
| `stream_templates` | `/streams` | Global stream template library |
| `allocation` | `/allocation` | Allocation engine, config, overrides, freeze, AI |
| `ai_suggestions` | `/batches/{batch}/ai-suggestions` | AI-generated stream suggestions |
| `sync` | `/sync` | Fetch & sync data from Spring Boot |
| `batch_management` | `/batch-management` | Proxy to Spring Boot batch CRUD |
| `trainees` | `/trainees` | Trainee listing per batch |
| `business_requirements` | `/business-requirements` | Capacity planning & BR management |
| `scores_upload` | `/scores` | Excel-based score upload |
| `notifications` | `/notifications` | User notification CRUD |
| `dashboard` | `/dashboard` | KPI stats for homepage |

### Authentication & Authorization

**JWT-based:** Access token (30 min) + Refresh token (7 days)

Dependency guards in `auth/dependencies.py`:
- `get_current_user` — any authenticated user
- `require_manager_or_above` — role must be `admin` or `manager`
- `require_admin` — role must be `admin`
- `require_sme_or_above` — role must be `admin`, `manager`, or `sme`

### Core Models

**Users (`models.py`):**
```
users: id, email (unique), hashed_password, role (admin|manager|sme), is_active
```

**Batch Streams (`streams/models.py`):**
```
batch_streams:            id, batch_name, name, is_active, priority, trainee_pct
stream_subject_weights:   id, stream_id, subject_name, weight_pct
stream_weight_proposals:  id, stream_id, proposed_by_email, status, proposed_weights_json, reviewed_by_email, review_notes
batch_stream_smes:        id, stream_id, user_id, assigned_by_email, assigned_at, is_active
```

**Allocation (`allocation/models.py`):**
```
allocation_configs:
  id, batch_name (unique), score_weight, dpi_weight,
  last_run_at, run_by_email, is_frozen, frozen_at, frozen_by_email

trainee_allocations:
  id, batch_name, employee_id, trainee_name
  dpi_score, subject_score, composite_score
  suggested_stream_id, manual_stream_id
  manual_override_reason, overridden_by_email, overridden_at
  score_breakdown_json, all_stream_scores_json
  is_frozen, frozen_at, frozen_by_email

allocation_ai_recommendations:
  id, batch_name, employee_id, generation_id
  agrees_with_algorithm, recommended_stream_name, confidence, reasoning

sme_associate_requests:
  id, batch_name, stream_id, sme_email
  requested_employee_ids (JSON), status
  approved_employee_ids (JSON), reviewed_by_email, review_notes
```

**Sync (`sync/models.py`):**
```
synced_batches:       batch_name (unique), subjects_json, trainee_count, synced_at
synced_dpi_records:   trainee_id (unique), batch_name, trainee_name, dpi, location, sub_batch
synced_subject_scores: external_id, batch_name, trainee_id, subject_name, exam_name, score
sync_status:          source (unique), last_sync_at, last_sync_status, records_synced
```

**Notifications (`notifications/models.py`):**
```
notifications:
  id, recipient_email, type (enum), title, message, is_read, created_at

NotificationType:
  proposal_submitted | proposal_approved | proposal_rejected
  sme_assigned | sme_removed | stream_deleted
  sme_request_submitted | sme_request_reviewed
```

---

## 7. Backend — Spring Boot

**Location:** `IntelliStreamDeco/`  
**Port:** 8081  
**DB:** PostgreSQL (`intellistream_deco`)

### Controllers

| Controller | Prefix | Operations |
|------------|--------|-----------|
| `BatchController` | `/api/subjects` | CRUD for batches (name, trainee count, subjects list) |
| `DpiController` | `/api/dpi` | CRUD for DPI records per trainee |
| `SubjectScoreController` | `/api/scores` | CRUD for subject exam scores per trainee |

### Entities

**`Batch`**
```java
batchName (PK), traineeCount, subjects (ElementCollection<String>)
```

**`DpiRecord`**
```java
traineeId (PK), batchName, traineeName, dpi (Double 0–5), location, subBatch
```

**`SubjectScore`**
```java
id (UUID), batchName, traineeId, traineeName,
subjectName, subjectId, examName, score (Double 0–100)
```

### Data Initializer

`DataInitializer.java` seeds sample data on startup if the database is empty, creating batches with DPI records and subject scores for testing.

---

## 8. Database Schema

### intellistream_auth (FastAPI database)

```sql
-- Authentication
users                  (id, email UNIQUE, hashed_password, role ENUM, is_active)

-- Global stream templates
streams                (id, name UNIQUE, description, is_mandatory, intake_pct, is_active)
stream_subjects        (id, stream_id FK, subject_name, weight_pct)
stream_suggestions     (id, batch_name, generation_id, name, priority, reasoning, weights_json, status, generated_by_email)

-- Batches & trainees (local mirror)
batches                (id, name, year, quarter, total_trainees, status, is_active)
trainees               (id, employee_id, name, email, batch_id FK, is_active)

-- Synced data from Spring Boot
synced_batches         (id, batch_name UNIQUE, subjects_json, trainee_count, synced_at)
synced_dpi_records     (id, trainee_id UNIQUE, batch_name, trainee_name, dpi, location, sub_batch, synced_at)
synced_subject_scores  (id, external_id, batch_name, trainee_id, trainee_name, subject_name, subject_id, exam_name, score, synced_at)
sync_status            (id, source UNIQUE, last_sync_at, last_sync_status, records_synced)

-- Batch-specific streams
batch_streams          (id, batch_name, name, is_active, priority, trainee_pct)
                       UNIQUE(batch_name, name)
stream_subject_weights (id, stream_id FK, subject_name, weight_pct)
stream_weight_proposals(id, stream_id FK, proposed_by_email, status, proposed_weights_json, created_at,
                        reviewed_by_email, reviewed_at, rejection_reason)
batch_stream_smes      (id, stream_id FK, user_id FK, assigned_by_email, assigned_at, is_active)
                       UNIQUE(stream_id, user_id)

-- Allocation
allocation_configs     (id, batch_name UNIQUE, score_weight, dpi_weight, last_run_at,
                        run_by_email, is_frozen, frozen_at, frozen_by_email)
trainee_allocations    (id, batch_name, employee_id, trainee_name,
                        dpi_score, subject_score, composite_score,
                        suggested_stream_id FK, manual_stream_id FK,
                        manual_override_reason, overridden_by_email, overridden_at,
                        score_breakdown_json, all_stream_scores_json,
                        is_frozen, frozen_at, frozen_by_email, created_at, updated_at)
                       UNIQUE(batch_name, employee_id)
allocation_ai_recommendations (id, batch_name, employee_id, generation_id,
                        agrees_with_algorithm, recommended_stream_name, confidence, reasoning,
                        generated_by_email, created_at)
sme_associate_requests (id, batch_name, stream_id FK, sme_user_id FK, sme_email,
                        requested_employee_ids JSON, status ENUM,
                        approved_employee_ids JSON, reviewed_by_email, reviewed_at, review_notes)

-- Business requirements
business_requirements  (id, batch_name, title, location, created_at, is_active)
br_streams             (id, br_id FK, name, is_mandatory, capacity_type, capacity_value,
                        roles_needed JSON, subjects_needed JSON, is_active)

-- Notifications
notifications          (id, recipient_email, type ENUM, title, message, is_read, created_at)

-- Excel upload registry
excel_batch_registry   (batch_name PK, uploaded_at, trainee_count)
trainee_stream_references (trainee_id PK, batch_name, stream_name, updated_at)
```

### intellistream_deco (Spring Boot database)

```sql
batches        (batch_name PK, trainee_count, subjects TEXT[])
dpi_records    (trainee_id PK, batch_name, trainee_name, dpi DOUBLE, location, sub_batch)
subject_scores (id UUID PK, batch_name, trainee_id, trainee_name,
                subject_name, subject_id, exam_name, score DOUBLE)
```

---

## 9. Features In Detail

### 9.1 Allocation Engine

**File:** `auth-service/allocation/service.py`

The allocation engine assigns each trainee in a batch to a technology stream. It supports two modes:

#### Mode A — By Stream Priority (Default)

Best choice for production: respects business headcount constraints while still using fit scores internally.

**Algorithm:**
1. Preserve any existing manual overrides before clearing
2. Load all DPI records + subject scores for the batch
3. For every `trainee × stream` pair, compute a composite fit score
4. Sort streams by `priority` (lower = higher priority, 0 = unranked/last)
5. For each stream in priority order:
   - Calculate capacity: `cap = round(trainee_pct / 100 × total_trainees)`
   - From the unallocated pool, pick the top `cap` trainees by composite score for this stream
6. Restore manual overrides
7. Persist all `TraineeAllocation` records

**Use case:** When the business needs specific headcount per stream (e.g., 30 in Java, 20 in Python, 10 in Cloud).

#### Mode B — By Stream Fit Score

Each trainee is assigned to the stream where their composite score is highest, ignoring capacity limits entirely.

**Use case:** Analysis only — to see natural trainee clustering, or when all streams are equally needed and pure merit should decide.

**Important:** Same-priority streams in Mode A are processed in an arbitrary DB-dependent order (known limitation — a tier-based fix groups equal-priority streams and runs fit-score within the tier).

#### Composite Score Formula

```
Composite (0–100) =
  (Weighted Subject Score / 100) × score_weight
  + (DPI / 5) × dpi_weight

Where:
  Weighted Subject Score = Σ (avg_exam_score_for_subject × subject_weight_pct / total_weight)
  DPI is normalized from 0–5 to 0–1 range
  Default: score_weight = 0.60 (60%), dpi_weight = 0.40 (40%)
```

All per-stream scores are stored in `all_stream_scores_json` for transparency in the UI breakdown view.

#### Manual Overrides

- Manager/Admin can override any non-frozen trainee to any stream
- Override requires a written reason
- Overrides are **preserved** across re-runs — they are saved before clearing, then restored after the algorithm writes new suggestions
- Effective stream = manual override (if set) OR suggested stream

#### Freeze Mechanism

| Level | Effect |
|-------|--------|
| Batch freeze | Blocks re-runs, config changes, and all individual overrides |
| Trainee freeze | Blocks override for just that trainee; batch re-runs still update their suggestion |

---

### 9.2 Stream Management

**Page:** `StreamManagementPage.tsx`

Each batch has its own set of streams. A stream has:
- **Name** — unique within the batch
- **Priority** — integer (1 = highest; 0 = unranked, processed last)
- **Trainee %** — target percentage of batch to be allocated here
- **Subject Weights** — importance of each subject for fit score calculation (must sum to 100% across the batch's subjects)

**Weight Proposals (SME workflow):**
1. SME assigned to a stream can propose new subject weights
2. Proposal is stored as `pending` and a notification is sent to managers
3. Manager approves (applies immediately) or rejects (with optional notes)
4. SME is notified of the decision

**SME Assignments:**
- Admin/Manager assigns one or more SMEs to a stream
- SME can only propose weights for streams they are assigned to
- SME can only submit associate requests for their assigned streams

---

### 9.3 Global Stream Templates

**Page:** `StreamTemplatesPage.tsx`

A library of reusable stream definitions (Java, Python, Cloud, etc.) that can be referenced when creating batch-specific streams. Templates store:
- Name, description
- `is_mandatory` flag
- `intake_pct` — suggested intake percentage
- Subject weights

**AI Stream Suggestions:** Managers can ask Ollama to suggest new streams or adjustments for a specific batch. Suggestions are stored as `pending` and can be accepted (creates a batch stream) or ignored.

---

### 9.4 Data Sync (Spring Boot → FastAPI)

**File:** `auth-service/sync/service.py`

**Trigger:** Automatically on FastAPI startup; manually via `POST /sync/trigger`

**What it syncs:**
1. Calls `GET /api/subjects` → upserts `synced_batches`
2. Calls `GET /api/dpi` → upserts `synced_dpi_records`
3. Calls `GET /api/scores` → upserts `synced_subject_scores`
4. Updates `sync_status` with timestamp

**Excel preservation:** If `preserve_excel=true` (default), batches registered via Excel upload are not overwritten by the Spring Boot sync.

---

### 9.5 Excel Score Upload

**Page:** Admin → Training Data  
**File:** `auth-service/scores_upload/routes.py`

An alternative data ingestion path for batches not in the Spring Boot system:
1. Download the Excel template from `/scores/excel-template`
2. Fill in DPI scores and subject exam scores per trainee
3. Upload to `/scores/upload-excel`
4. Registers the batch in `excel_batch_registry` (prevents sync overwrite)
5. Data is written directly into `synced_dpi_records` / `synced_subject_scores`
6. Allocation engine uses this data normally

---

### 9.6 AI Recommendations

**File:** `auth-service/allocation/ai_recommender.py`

After running the allocation engine, managers can request an AI review:
- Each trainee's data (DPI, subject scores, stream fit scores, algorithm suggestion) is sent to Ollama
- The AI returns: `agrees_with_algorithm`, `recommended_stream`, `confidence` (high/medium/low), `reasoning`
- Disagreements are flagged in the allocation table with an amber "Differs" badge
- Expanding a trainee row shows the full AI reasoning

**Model:** Configured via `OLLAMA_MODEL` env var (default: `gpt-oss:20b`)  
**Timeout:** 1800s (configurable via `OLLAMA_TIMEOUT`)

---

### 9.7 Business Requirements

**Page:** `BusinessRequirementsPage.tsx`  
**File:** `auth-service/business_requirements/`

Captures client/project demands that should influence allocation:
- A "Business Requirement" represents a project or client need for a batch
- Each BR has one or more `BRStream` entries specifying:
  - Stream name
  - Whether it's mandatory
  - Capacity (as % of batch or fixed headcount)
  - Roles needed and subjects needed
- Can be created manually or imported via Excel
- AI allocation recommendations factor in active BRs when evaluating algorithm decisions

---

### 9.8 Dashboard

**Page:** `HomePage.tsx`  
**API:** `GET /dashboard/stats?batch_name=...`

**KPI Cards:**
- Total trainees (global or per-batch)
- Active batches count
- Allocation rate (% of trainees with an effective stream)
- Pending SME requests count

**Charts:**
- **Stream Distribution** — Donut chart of effective stream assignments
- **Avg Score by Stream** — Bar chart of composite score averages per stream
- **Batch Freeze Status** — Stacked bar (frozen vs. active batches)
- **Recent Activity** — Feed of allocation runs, overrides, freezes, syncs

**System Health Panel:**
- Data sync status (last sync time, record counts)
- Allocation config per batch (weights, last run, frozen status)

---

### 9.9 SME Associate Requests

**Page:** AllocationPage → SME requests section

SMEs can request specific trainees to be associated with their stream (e.g., for mentoring or a project):
1. SME selects up to 5 trainees from the batch
2. Request is submitted as `pending`
3. Managers are notified
4. Manager reviews and can approve all, some (partial), or none
5. SME is notified of the decision
6. The request does **not** automatically change allocation — it's informational/administrative

---

### 9.10 Notifications

Sent automatically when:
| Event | Recipient |
|-------|-----------|
| Weight proposal submitted | All managers/admins |
| Weight proposal approved/rejected | Proposing SME |
| SME assigned to / removed from stream | The SME |
| Stream deleted | SMEs assigned to that stream |
| SME associate request submitted | All managers/admins |
| SME associate request reviewed | Requesting SME |

Notifications appear in the bell icon in the header with unread count badge.

---

## 10. API Reference

### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/login` | — | Login with email + password → JWT tokens |
| POST | `/auth/refresh` | — | Exchange refresh token → new access token |
| POST | `/auth/register` | Admin | Create new user |
| GET | `/auth/me` | Any | Current user info |
| GET | `/auth/users` | Admin | List all users |
| PATCH | `/auth/users/{id}/deactivate` | Admin | Deactivate user |

### Streams (Batch-Specific)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/batches/{batch}/streams` | Any | List streams for batch |
| POST | `/batches/{batch}/streams` | Manager+ | Create stream |
| PUT | `/batches/{batch}/streams/{id}` | Manager+ | Rename stream |
| DELETE | `/batches/{batch}/streams/{id}` | Manager+ | Delete stream |
| PATCH | `/batches/{batch}/streams/{id}/priority` | Manager+ | Update priority |
| PATCH | `/batches/{batch}/streams/{id}/trainee-pct` | Manager+ | Update capacity % |
| POST | `/batches/{batch}/streams/{id}/weights` | SME+ | Set subject weights (or propose) |
| GET | `/batches/{batch}/streams/{id}/proposals` | Manager+ | List weight proposals |
| POST | `/batches/{batch}/streams/{id}/proposals/{pid}/approve` | Manager+ | Approve proposal |
| POST | `/batches/{batch}/streams/{id}/proposals/{pid}/reject` | Manager+ | Reject proposal |
| GET | `/batches/{batch}/streams/{id}/smes` | Manager+ | List SME assignments |
| POST | `/batches/{batch}/streams/{id}/smes` | Manager+ | Assign SME to stream |
| DELETE | `/batches/{batch}/streams/{id}/smes/{uid}` | Manager+ | Remove SME |
| GET | `/batches/{batch}/streams/my-sme-assignments` | SME+ | Streams I'm assigned to |

### Allocation

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/allocation/{batch}/config` | Any | Get scoring weights + freeze status |
| PUT | `/allocation/{batch}/config` | Manager+ | Update score_weight + dpi_weight |
| POST | `/allocation/{batch}/run` | Manager+ | Run allocation (body: `{mode: "priority"\|"fit_score"}`) |
| GET | `/allocation/{batch}` | Any | List all trainee allocations |
| PATCH | `/allocation/{batch}/{eid}/override` | Manager+ | Set manual stream override |
| DELETE | `/allocation/{batch}/{eid}/override` | Manager+ | Clear override |
| POST | `/allocation/{batch}/freeze` | Manager+ | Freeze entire batch |
| POST | `/allocation/{batch}/unfreeze` | Manager+ | Unfreeze batch |
| POST | `/allocation/{batch}/{eid}/freeze` | Manager+ | Freeze individual trainee |
| POST | `/allocation/{batch}/{eid}/unfreeze` | Manager+ | Unfreeze trainee |
| GET | `/allocation/{batch}/export` | Any | Download Excel with all allocation data |
| POST | `/allocation/{batch}/ai-recommendations/generate` | Manager+ | Generate AI analysis via Ollama |
| GET | `/allocation/{batch}/ai-recommendations` | Any | Fetch AI recommendations |
| POST | `/allocation/{batch}/sme-requests` | SME+ | Submit associate request (max 5) |
| GET | `/allocation/{batch}/sme-requests` | SME+ | List requests (SME sees own, manager sees all) |
| POST | `/allocation/{batch}/sme-requests/{id}/review` | Manager+ | Approve / partially approve / reject |
| DELETE | `/allocation/{batch}/sme-requests/{id}` | SME+ | Cancel pending request |

### Sync

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/sync/batches` | Any | List synced batches |
| GET | `/sync/dpi` | Any | List DPI records |
| GET | `/sync/scores` | Any | List subject scores |
| GET | `/sync/status` | Any | Last sync timestamp + stats |
| POST | `/sync/trigger` | Manager+ | Manually trigger sync from Spring Boot |

### Business Requirements

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/business-requirements` | Any | List BRs (optional `?batch_name=`) |
| GET | `/business-requirements/{id}` | Any | Get single BR with streams |
| POST | `/business-requirements` | Manager+ | Create BR |
| PUT | `/business-requirements/{id}` | Manager+ | Update BR |
| DELETE | `/business-requirements/{id}` | Manager+ | Soft-delete BR |
| GET | `/business-requirements/excel-template` | Manager+ | Download Excel template |
| POST | `/business-requirements/parse-excel` | Manager+ | Upload + parse Excel |

### Scores Upload

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/scores/excel-template` | Manager+ | Download score upload template |
| POST | `/scores/upload-excel` | Manager+ | Upload DPI + subject scores from Excel |
| GET | `/scores/batch-info/{batch}` | Any | Check if batch is Excel-managed |
| GET | `/scores/excel-batches` | Any | List Excel-managed batches |

### Notifications

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/notifications` | Any | List own notifications |
| GET | `/notifications/unread-count` | Any | Count unread notifications |
| PATCH | `/notifications/{id}/read` | Any | Mark one as read |
| PATCH | `/notifications/read-all` | Any | Mark all as read |
| DELETE | `/notifications/{id}` | Any | Delete notification |

### Dashboard

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/dashboard/stats` | Any | KPIs + charts (optional `?batch_name=`) |

### Spring Boot (Port 8081)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/subjects` | List / create batches |
| GET/PUT/DELETE | `/api/subjects/{batchName}` | Get / update / delete batch |
| GET/POST | `/api/dpi` | List / create DPI records |
| GET | `/api/dpi/{traineeId}` | Get DPI by trainee |
| GET | `/api/dpi/batch/{batchName}` | Get DPI records for batch |
| GET/POST | `/api/scores` | List / create subject scores |
| GET | `/api/scores/trainee/{traineeId}` | Scores by trainee |
| GET | `/api/scores/batch/{batchName}` | Scores by batch |

---

## 11. Data Flow

### Normal Flow (Spring Boot as source)

```
1. Training data entered in Spring Boot
   POST /api/subjects, POST /api/dpi, POST /api/scores

2. FastAPI syncs on startup (or manual trigger)
   sync/service.py → calls Spring Boot APIs
   → upserts synced_batches, synced_dpi_records, synced_subject_scores

3. Manager opens AllocationPage, selects batch
   GET /allocation/{batch}/config
   GET /allocation/{batch}
   GET /batches/{batch}/streams

4. (Optional) Configure stream weights
   POST /batches/{batch}/streams/{id}/weights

5. Run allocation
   POST /allocation/{batch}/run  { mode: "priority" | "fit_score" }
   → service.py computes composite scores for every trainee × stream
   → greedy fill or fit-score assignment
   → writes trainee_allocations

6. (Optional) Generate AI recommendations
   POST /allocation/{batch}/ai-recommendations/generate
   → Sends trainee data to Ollama → stores analysis

7. Review results, override if needed
   PATCH /allocation/{batch}/{eid}/override

8. Freeze when done
   POST /allocation/{batch}/freeze

9. Export
   GET /allocation/{batch}/export → Excel file
```

### Excel Upload Flow (Alternative)

```
1. Download template
   GET /scores/excel-template

2. Fill template with DPI + subject scores

3. Upload
   POST /scores/upload-excel
   → Registers batch in excel_batch_registry
   → Writes to synced_dpi_records + synced_subject_scores

4. Allocation engine uses this data (same as Spring Boot path)
   Batch is preserved from sync overwrites going forward
```

---

## 12. Configuration & Environment

### Frontend — `intellistream-frontend-V1/.env`

```env
VITE_API_BASE_URL=http://localhost:8000
```

### FastAPI — `auth-service/.env`

```env
# JWT
SECRET_KEY=<32+ character secret key>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# Database
DATABASE_URL=postgresql://postgres:<password>@localhost:5432/intellistream_auth

# Default Admin (created on first startup)
DEFAULT_ADMIN_EMAIL=admin@example.com
DEFAULT_ADMIN_PASSWORD=Tcs#1234

# Spring Boot
SPRINGBOOT_BASE_URL=http://localhost:8081

# Allocation defaults
DPI_WEIGHT=0.40
SCORE_WEIGHT=0.60

# Ollama (AI)
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=gpt-oss:20b
OLLAMA_TIMEOUT=1800.0
```

### Spring Boot — `IntelliStreamDeco/src/main/resources/application.properties`

```properties
server.port=8081
spring.datasource.url=jdbc:postgresql://localhost:5432/intellistream_deco
spring.datasource.username=postgres
spring.datasource.password=<password>
spring.jpa.hibernate.ddl-auto=update
spring.jpa.show-sql=false
```

---

## 13. Running the Project

### Prerequisites

- Node.js 20+ and npm
- Python 3.11+
- Java 21 + Maven
- PostgreSQL 15+
- Ollama (for AI features only)

### Step 1 — PostgreSQL

Create two databases:
```sql
CREATE DATABASE intellistream_auth;
CREATE DATABASE intellistream_deco;
```

### Step 2 — Spring Boot

```bash
cd IntelliStreamDeco
mvn spring-boot:run
# Starts on port 8081
# Auto-creates schema and seeds sample data on first run
```

### Step 3 — FastAPI

```bash
cd auth-service
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
# Set up .env file (copy from above)
uvicorn main:app --reload --port 8000
# Auto-runs migrations and seeds default admin on startup
# Auto-syncs from Spring Boot
```

### Step 4 — Frontend

```bash
cd intellistream-frontend-V1
npm install
# Create .env with VITE_API_BASE_URL=http://localhost:8000
npm run dev
# Starts on port 5173
```

### Step 5 — Ollama (optional, for AI features)

```bash
ollama serve
ollama pull gpt-oss:20b
# Runs on port 11434
```

### Default Login

```
Email:    admin@example.com
Password: Tcs#1234
```

---

## Known Limitations & Planned Improvements

| Issue | Status |
|-------|--------|
| Same-priority streams in Priority mode are processed in arbitrary DB order (one gets unfair first-pick advantage) | Known — fix is tier-based allocation (group equal-priority streams, run fit-score within tier) |
| Trainee-level `is_frozen` does not block allocation re-runs from changing `suggested_stream` (only overrides are blocked) | By design — freeze only protects manual assignments |
| Ollama AI calls are synchronous and can time out on large batches | Timeout configurable via `OLLAMA_TIMEOUT`; future: async job queue |
| No email delivery for notifications — stored in DB only | Infrastructure (SMTP) not yet configured |
| No pagination on allocation results table for very large batches | Future improvement |

---

*Documentation generated: May 2026*

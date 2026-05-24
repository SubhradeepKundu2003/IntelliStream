# IntelliStream — Allocation System Documentation

## Overview

The allocation system assigns trainees in a batch to training streams based on their academic performance (subject exam scores) and a behavioral/performance index (DPI). It runs on-demand, supports two assignment strategies, preserves manual overrides, has a two-level freeze mechanism, and optionally layers an AI recommendation pass on top.

---

## 1. Data Inputs

Before allocation can run, the following data must be synced into the system:

| Source | Table | What it provides |
|---|---|---|
| External LMS | `synced_dpi_records` | One DPI score (0–5) per trainee |
| External LMS | `synced_subject_scores` | Per-subject, per-exam raw scores; multiple exams per subject are averaged |
| Admin config | `batch_streams` | The streams available in the batch, with priority and capacity targets |
| Admin config | `stream_subject_weights` | How much each subject counts toward a stream's score |

---

## 2. Scoring

Scoring is computed for **every trainee × every stream** before any assignment decision is made.

### Step 1 — Average subject scores

For a trainee who sat multiple exams in the same subject, all scores are averaged:

```
avg_subject[subject] = mean of all exam scores for that subject
```

### Step 2 — Normalize DPI

DPI is on a 0–5 scale. It is normalized to 0–1:

```
dpi_norm = min(dpi, 5.0) / 5.0
```

DPI values above 5 are capped at 5 before normalizing.

### Step 3 — Weighted subject score for a stream

Each stream defines a set of subjects and a percentage weight for each. The weighted subject score reflects how well a trainee's skills match that specific stream:

```
total_weight     = Σ weight_pct  (across all subjects defined for the stream)
weighted_subject = Σ (avg_subject[s] × weight_pct[s] / total_weight)
```

If a stream has no subject weights defined, `weighted_subject = 0`.

### Step 4 — Composite score (0–100)

The composite is the final ranking number for a trainee-stream pair:

```
composite = (weighted_subject / 100) × score_weight
          + dpi_norm            × dpi_weight
composite = round(composite × 100, 2)
```

**Default weights** (configurable per batch):

| Weight | Default | Meaning |
|---|---|---|
| `score_weight` | 0.60 | 60 % from subject exam performance |
| `dpi_weight` | 0.40 | 40 % from DPI (behavioral/performance index) |

The two weights must always sum to exactly `1.0`.

---

## 3. Allocation Modes

After scoring, the system assigns trainees to streams. Two modes are available, chosen at run time.

### Mode A — `priority` (default)

Streams are processed **in order of their `priority` field** (lower number = higher priority, i.e., most important stream is filled first).

Each stream has a `trainee_pct` — the percentage of the total batch it should receive:

```
cap = round(trainee_pct / 100 × total_trainees)
```

For each stream (highest priority first):

1. Take all **unallocated** trainees.
2. Rank them by their **composite score for that stream**, descending.
3. Assign the top `cap` trainees to the stream.
4. Remove them from the unallocated pool.

Trainees left after all streams are processed remain **unallocated**.

**Consequence:** A trainee may score highest for a low-priority stream but still be assigned to a high-priority stream if they also rank well there — the high-priority stream claims them first.

### Mode B — `fit_score`

Each trainee is independently assigned to whichever stream gives them their **highest composite score**. No capacity constraints apply; every trainee gets a suggestion.

**Consequence:** Streams can end up over- or under-populated relative to their `trainee_pct` targets, because each trainee acts purely on personal best fit.

---

## 4. Manual Overrides

Managers (and above) can override the algorithm's suggestion for any individual trainee.

- Requires a **reason string**.
- The **effective stream** shown in the UI and export is:
  - `manual_stream_id` if a manual override exists
  - `suggested_stream_id` otherwise

**Override persistence across re-runs:** When allocation is re-run, all existing manual overrides are captured first, the allocation table is wiped, the algorithm runs fresh, and then every previous manual override is re-applied to the new rows. Manual decisions are never lost by a re-run.

Overrides can also be **cleared** by a manager, restoring the algorithm's suggestion.

---

## 5. Freeze System

There are two independent freeze levels.

### Batch-level freeze (`AllocationConfig.is_frozen`)

Freezing an entire batch blocks **all** of the following:

- Re-running allocation
- Updating config weights
- Setting or clearing any manual override
- Freezing/unfreezing individual trainees

This is the final lock-down state for an allocation cycle. Only managers+ can freeze/unfreeze.

### Trainee-level freeze (`TraineeAllocation.is_frozen`)

A single trainee's record can be frozen independently. While frozen, their override cannot be changed or cleared — but the rest of the batch continues to be editable.

**Freeze hierarchy:** A batch-level freeze overrides everything. Even an unfrozen trainee cannot be edited when the batch is frozen.

---

## 6. Allocation Config

One `AllocationConfig` row exists per batch (auto-created on first access).

| Field | Default | Notes |
|---|---|---|
| `score_weight` | 0.60 | Must be in [0, 1] |
| `dpi_weight` | 0.40 | Must be in [0, 1]; `score_weight + dpi_weight` must = 1.0 |
| `is_frozen` | `false` | Batch-level lock |
| `last_run_at` | null | Timestamp of the last allocation run |
| `run_by_email` | null | Who triggered the last run |

Config can only be edited by **managers+** and only when the batch is **not frozen**.

---

## 7. AI Recommendations

After allocation runs, managers can optionally trigger an AI review pass. This uses a locally-hosted LLM (Ollama) and is purely **advisory** — it does not change the allocation automatically.

### What the AI receives

For each trainee:
- Employee ID and name
- DPI score
- Per-subject average scores
- The algorithm's suggested stream
- Composite scores against every stream (ranked)

Plus:
- The list of available streams in this batch
- Active Business Requirements (what skills/roles are needed where)

### What the AI returns

For each trainee:

| Field | Values | Meaning |
|---|---|---|
| `agrees` | `true` / `false` | Whether the AI agrees with the algorithm |
| `recommended_stream` | stream name or `null` | Alternate stream if `agrees=false` |
| `confidence` | `high` / `medium` / `low` | Strength of the recommendation |
| `reasoning` | 1–2 sentences | Key factor driving the decision |

### AI evaluation rules (system prompt)

- **Subject alignment:** The trainee's top subjects should match the stream's focus.
- **DPI interpretation:** ≥ 4 is excellent, 2.5–4 is acceptable, < 2.5 is concerning.
- **Score gap threshold:** If the best stream-fit score beats the algorithm's choice by > 15 points, the AI will recommend a change.
- **No marginal changes:** Differences < 5 points are not grounds for a recommendation change.
- **Confidence levels:** `high` when score gap > 15 pts, `medium` for 5–15 pts, `low` for borderline cases.
- **Business demand:** Higher-priority streams have greater business need and are factored in.

### Validation and safety

- The recommended stream must exactly match a name in the batch's active stream list (case-insensitive match, then restored to canonical casing). Unknown stream names are discarded and the AI is treated as agreeing.
- Each generation replaces the previous batch of recommendations — old recommendations do not accumulate.
- Temperature is set to 0.2 for consistency.

---

## 8. SME Associate Requests

SMEs (Subject Matter Experts) who are assigned to a stream can formally request specific trainees to be considered for their stream. This is a workflow on top of the algorithm, not an automatic re-assignment.

### Rules

- An SME can only submit requests for **their assigned stream**.
- A single request can include **1–5 employee IDs** (duplicates are de-duplicated).
- Employee IDs must belong to the same batch.
- Managers and admins can see **all** requests; SMEs can only see **their own**.

### Status lifecycle

```
pending → approved           (all requested employees approved)
        → partially_approved (only some approved)
        → rejected           (none approved)
        → cancelled          (SME cancels before review)
```

Only `pending` requests can be cancelled. Only `pending` requests can be reviewed. A reviewed request cannot be re-opened.

### Notifications

- When an SME submits a request → all active managers and admins are notified.
- When a manager reviews a request → the requesting SME is notified with the outcome.

---

## 9. Excel Export

Any authenticated user can export the current allocation for a batch as a `.xlsx` file.

Columns:
1. Employee ID
2. Trainee Name
3. DPI Score
4. One column per subject (dynamically discovered from score breakdowns, sorted alphabetically, title-cased)
5. Effective Stream (manual if set, otherwise algorithmic suggestion, or "Unallocated")

Frozen trainees are highlighted with a green background (`#E2EFDA`).

---

## 10. API Summary

All endpoints are prefixed with `/allocation`.

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/{batch}/config` | Any user | Get allocation config (weights, freeze state) |
| `PUT` | `/{batch}/config` | Manager+ | Update score/DPI weights |
| `POST` | `/{batch}/run` | Manager+ | Run allocation (`mode`: `priority` or `fit_score`) |
| `GET` | `/{batch}` | Any user | List all trainee allocations |
| `PATCH` | `/{batch}/{emp_id}/override` | Manager+ | Set a manual stream override |
| `DELETE` | `/{batch}/{emp_id}/override` | Manager+ | Clear a manual override |
| `POST` | `/{batch}/freeze` | Manager+ | Freeze the entire batch |
| `POST` | `/{batch}/unfreeze` | Manager+ | Unfreeze the entire batch |
| `POST` | `/{batch}/{emp_id}/freeze` | Manager+ | Freeze a single trainee |
| `POST` | `/{batch}/{emp_id}/unfreeze` | Manager+ | Unfreeze a single trainee |
| `GET` | `/{batch}/export` | Any user | Download allocation as Excel |
| `POST` | `/{batch}/ai-recommendations/generate` | Manager+ | Run AI recommendation pass |
| `GET` | `/{batch}/ai-recommendations` | Any user | Get latest AI recommendations |
| `POST` | `/{batch}/sme-requests` | SME+ | Submit a trainee associate request |
| `GET` | `/{batch}/sme-requests` | Any user | List SME requests (SME sees own only) |
| `POST` | `/{batch}/sme-requests/{id}/review` | Manager+ | Approve/reject/partially approve a request |
| `DELETE` | `/{batch}/sme-requests/{id}` | SME+ | Cancel a pending request |

---

## 11. End-to-End Flow

```
1. Data sync
   └─ DPI scores + subject scores imported into the database

2. Stream setup (admin)
   └─ Create streams, set priority, trainee_pct, subject weights

3. Run allocation (manager)
   ├─ Choose mode: priority (capacity-aware) or fit_score (pure best-fit)
   └─ System scores all trainees × all streams, then assigns

4. Review results
   ├─ Manager reviews suggestions, applies manual overrides if needed
   ├─ AI recommendation pass (optional) — advisory only
   └─ SMEs submit associate requests → manager reviews

5. Freeze
   └─ Manager freezes the batch (or individual trainees) to lock decisions

6. Export
   └─ Download final .xlsx with effective stream assignments
```

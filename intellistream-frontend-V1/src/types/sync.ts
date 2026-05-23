export interface SyncedBatch {
  id: number;
  batch_name: string;
  subjects: string[];
  trainee_count: number;
  synced_at: string;
}

export interface SyncedDpiRecord {
  id: number;
  trainee_id: string;
  batch_name: string;
  trainee_name: string;
  dpi: number;
  location: string | null;
  sub_batch: string | null;
  synced_at: string;
}

export interface SyncedSubjectScore {
  id: number;
  external_id: string;
  batch_name: string;
  trainee_id: string;
  trainee_name: string;
  subject_name: string;
  subject_id: string | null;
  exam_name: string | null;
  score: number;
  synced_at: string;
}

export interface SyncStatus {
  source: string;
  last_sync_at: string | null;
  last_sync_status: string | null;
  records_synced: number | null;
}

export interface SyncTriggerResponse {
  message: string;
  batches_synced: number;
  dpi_records_synced: number;
  scores_synced: number;
  synced_at: string;
}

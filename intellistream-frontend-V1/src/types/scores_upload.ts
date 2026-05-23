export interface RowResult {
  row: number;
  trainee_id: string;
  status: 'ok' | 'error';
  detail?: string;
}

export interface ScoresUploadResult {
  rows_processed: number;
  rows_succeeded: number;
  rows_failed: number;
  row_results: RowResult[];
  sync_triggered: boolean;
}

export interface StreamReference {
  trainee_id: string;
  batch_name: string;
  stream_name: string;
  updated_at: string;
}

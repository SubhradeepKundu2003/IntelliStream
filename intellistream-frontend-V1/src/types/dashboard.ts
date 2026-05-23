export interface StreamDistributionItem {
  stream_name: string;
  count: number;
}

export interface ScoreByStream {
  stream_name: string;
  avg_composite: number;
  count: number;
}

export interface BatchFreezeStatus {
  batch_name: string;
  frozen: number;
  unfrozen: number;
  total: number;
}

export interface ActivityItem {
  type: 'freeze' | 'override' | 'sync';
  message: string;
  timestamp: string;
  actor: string | null;
}

export interface SyncStatusSummary {
  last_sync_at: string | null;
  status: string;
  records_synced: number | null;
}

export interface AllocConfig {
  score_weight: number;
  dpi_weight: number;
  last_run_at: string | null;
  run_by_email: string | null;
  is_frozen: boolean;
  frozen_at: string | null;
  frozen_by_email: string | null;
}

export interface DashboardStats {
  batch_name: string | null;
  total_trainees: number;
  active_batches: number;
  allocation_rate: number;
  freeze_rate: number;
  pending_sme_requests: number;
  total_allocations: number;
  frozen_allocations: number;
  override_count: number;
  avg_composite_score: number | null;
  avg_dpi_score: number | null;
  stream_distribution: StreamDistributionItem[];
  score_by_stream: ScoreByStream[];
  batch_freeze_status: BatchFreezeStatus[];
  alloc_config: AllocConfig | null;
  sync_status: SyncStatusSummary | null;
  recent_activity: ActivityItem[];
}

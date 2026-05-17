export interface AllocationConfig {
  batch_name: string;
  score_weight: number;
  dpi_weight: number;
  last_run_at: string | null;
  run_by_email: string | null;
}

export interface StreamScoreDetail {
  stream_id: number;
  stream_name: string;
  composite: number;
  subject_score: number;
}

export interface TraineeAllocation {
  id: number;
  batch_name: string;
  employee_id: string;
  trainee_name: string;
  dpi_score: number | null;
  subject_score: number | null;
  composite_score: number | null;
  suggested_stream_id: number | null;
  suggested_stream_name: string | null;
  manual_stream_id: number | null;
  manual_stream_name: string | null;
  effective_stream_id: number | null;
  effective_stream_name: string | null;
  manual_override_reason: string | null;
  overridden_by_email: string | null;
  overridden_at: string | null;
  score_breakdown: Record<string, number>;
  all_stream_scores: StreamScoreDetail[];
}

export interface AllocationRunResult {
  batch_name: string;
  total: number;
  allocated: number;
  unallocated: number;
  run_by_email: string;
  run_at: string;
}

export interface AllocationAIRecommendation {
  id: number;
  batch_name: string;
  employee_id: string;
  generation_id: string;
  agrees_with_algorithm: boolean;
  recommended_stream_name: string | null;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  generated_by_email: string | null;
  created_at: string;
}

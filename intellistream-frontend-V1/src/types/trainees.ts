export type BatchStatus = 'setup' | 'training' | 'assessment' | 'allocation' | 'completed';

export interface Batch {
  id: number;
  name: string;
  year: number;
  quarter: number;
  total_trainees: number;
  status: BatchStatus;
  is_active: boolean;
}

export interface Trainee {
  id: number;
  employee_id: string;
  name: string;
  email: string | null;
  batch_id: number;
  is_active: boolean;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

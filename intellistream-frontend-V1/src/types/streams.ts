// ── Batch-specific streams (agent 12 / existing StreamManagementPage) ──
export interface StreamSubjectWeight {
  subject_name: string;
  weight_pct: number;
}

export interface BatchStream {
  id: number;
  batch_name: string;
  name: string;
  is_active: boolean;
  weights: StreamSubjectWeight[];
}

export interface StreamCreate {
  name: string;
}

export interface WeightsSet {
  weights: StreamSubjectWeight[];
}

// ── Global stream templates (agent 03 / StreamTemplatesPage) ──
export type SubjectName = 'java' | 'python' | 'sql' | 'cybersecurity' | 'agile' | 'aiml' | 'webtech' | 'cloud';

export interface SubjectWeight {
  id: number;
  stream_id: number;
  subject_name: SubjectName;
  weight_pct: number;
}

export interface StreamTemplate {
  id: number;
  name: string;
  description: string | null;
  is_mandatory: boolean;
  intake_pct: number;
  is_active: boolean;
}

export interface StreamTemplateDetail extends StreamTemplate {
  subjects: SubjectWeight[];
}

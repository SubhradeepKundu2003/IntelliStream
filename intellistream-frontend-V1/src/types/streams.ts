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
  has_pending_proposal: boolean;
}

export interface StreamCreate {
  name: string;
}

export interface WeightsSet {
  weights: StreamSubjectWeight[];
}

export type ProposalStatus = 'pending' | 'approved' | 'rejected';

export interface WeightProposal {
  id: number;
  stream_id: number;
  proposed_by_email: string;
  status: ProposalStatus;
  proposed_weights: StreamSubjectWeight[];
  created_at: string;
  reviewed_by_email: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
}

// ── SME assignments (batch + stream level) ──
export interface SMEAssignment {
  id: number;
  stream_id: number;
  stream_name: string;
  batch_name: string;
  user_id: number;
  user_email: string;
  assigned_by_email: string;
  assigned_at: string;
  is_active: boolean;
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

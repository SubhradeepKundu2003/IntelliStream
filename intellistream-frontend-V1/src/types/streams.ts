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

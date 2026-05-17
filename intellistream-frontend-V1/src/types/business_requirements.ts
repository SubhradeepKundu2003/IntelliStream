export type CapacityType = 'percentage' | 'count';

export interface BRStreamCreate {
  name: string;
  is_mandatory: boolean;
  capacity_type: CapacityType;
  capacity_value: number;
  roles_needed: string[];
  subjects_needed: string[];
}

export interface BRStreamResponse {
  id: number;
  br_id: number;
  name: string;
  is_mandatory: boolean;
  capacity_type: CapacityType;
  capacity_value: number;
  roles_needed: string[];
  subjects_needed: string[];
  is_active: boolean;
}

export interface BRCreate {
  batch_name: string;
  title: string;
  location?: string;
  streams: BRStreamCreate[];
}

export interface BRUpdate {
  title?: string;
  location?: string;
  streams?: BRStreamCreate[];
}

export interface BRSummary {
  id: number;
  batch_name: string;
  title: string;
  location?: string;
  created_at: string;
  is_active: boolean;
  stream_count: number;
}

export interface BRResponse {
  id: number;
  batch_name: string;
  title: string;
  location?: string;
  created_at: string;
  is_active: boolean;
  streams: BRStreamResponse[];
}

export interface ExcelImportResult {
  streams: BRStreamCreate[];
  errors: string[];
}

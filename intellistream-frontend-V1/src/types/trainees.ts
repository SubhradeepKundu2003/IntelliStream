export interface Trainee {
  id: number;
  employee_id: string;
  name: string;
  email: string | null;
  batch_id: number;
  is_active: boolean;
}

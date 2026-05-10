export type Role = 'admin' | 'manager' | 'sme';

export interface AuthUser {
  email: string;
  role: Role;
}

export interface UserResponse {
  id: number;
  email: string;
  role: Role;
  is_active: boolean;
}

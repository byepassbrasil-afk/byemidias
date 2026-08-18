export type UserRole = 'super_admin' | 'admin' | 'manager' | 'operator' | 'viewer';
export type UserStatus = 'active' | 'inactive' | 'invited';

export interface Profile {
  id: string;
  organization_id: string | null;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

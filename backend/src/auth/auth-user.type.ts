export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  roles: string[];
  departmentId: string | null;
}

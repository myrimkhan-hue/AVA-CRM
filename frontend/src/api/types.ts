export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  roles: string[];
  departmentId: string | null;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

export interface Department {
  id: string;
  name: string;
}

export interface Role {
  code: string;
  name: string;
}

export interface UserRecord {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  departmentId: string | null;
  department: Department | null;
  roles: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

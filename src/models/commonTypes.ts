export type UserRole = 'Root' | 'Admin' | 'Manager' | 'Caller';

export interface OrgUser {
  email: string;
  fullName: string;
  role: UserRole;
  reportsTo: string;
}

export interface ValidationError {
  row: number;
  message: string;
  userData: OrgUser;
}

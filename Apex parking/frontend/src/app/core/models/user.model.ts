export interface User {
  id?: string;
  name: string;
  email: string;
  role: 'admin' | 'client' | 'company';
  companyId?: string;
}

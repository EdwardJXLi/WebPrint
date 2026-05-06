import type { SessionData } from 'express-session';

export type UserRole = 'admin' | 'user';
export type JobStatusGroup = 'all' | 'active' | 'completed';

export interface UserRow {
  id: number;
  oidc_subject: string;
  email: string | null;
  name: string;
  picture: string | null;
  role: UserRole;
  last_login_at: string;
  created_at: string;
  updated_at: string;
}

export interface PrinterRow {
  id: number;
  name: string;
  ipp_uri: string;
  description: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface JobRow {
  id: number;
  user_id: number;
  printer_id: number;
  original_file_name: string;
  stored_file_name: string;
  file_path: string;
  mime_type: string;
  copies: number;
  duplex: string;
  color_mode: string;
  status: string;
  status_detail: string | null;
  external_job_id: number | null;
  external_job_uri: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  printerName?: string;
  printerIppUri?: string;
  printerEnabled?: boolean;
  userEmail?: string | null;
  userName?: string;
  userRole?: UserRole;
}

export interface OidcTransaction {
  state: string;
  nonce: string;
  codeVerifier: string;
}

export interface CloudPrintSessionData extends SessionData {
  userId?: number;
  csrfToken?: string;
  oidcTransaction?: OidcTransaction;
}

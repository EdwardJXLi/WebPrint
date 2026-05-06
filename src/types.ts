export type UserRole = 'admin' | 'user';

export interface AuthUser {
  id: number;
  email: string | null;
  name: string;
  picture: string | null;
  role: UserRole;
}

export interface AppConfig {
  appName: string;
  appVersion: string;
  loginButtonText: string;
  poweredByFooterEnabled: boolean;
}

export interface Printer {
  id: number;
  name: string;
  ipp_uri: string;
  description: string;
  enabled: boolean;
}

export interface DashboardStats {
  activeJobs: number;
  queuedJobs: number;
  completedJobs: number;
  availablePrinters: number;
}

export interface Job {
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
  printerName: string;
  printerIppUri: string;
  printerEnabled?: boolean;
  userEmail?: string | null;
  userName?: string;
  userRole?: UserRole;
  canCancel?: boolean;
}

export interface LiveJob {
  externalJobId: number | null;
  name: string;
  owner: string | null;
  status: string;
}

export interface PrinterStatus {
  printerState: string;
  stateMessage: string | null;
  acceptingJobs: boolean;
  queuedJobCount: number;
  jobs: LiveJob[];
}

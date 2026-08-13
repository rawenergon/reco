
export interface Employee {
  id: string;
  name: string;
  role: string;
  class_id?: string; // Link to class
  photo_url?: string; // URL from Supabase Storage
  photo_base64?: string; // Legacy / Fallback
  email?: string;
  phone?: string;
  student_id?: string;
  created_at: string;
}

export interface ClassGroup {
  id: string;
  name: string;
  created_at: string;
}

export interface AttendanceRecord {
  id: string;
  student_id: string; // CHANGED: Now using Student ID instead of UUID
  employee_name: string;
  timestamp: string;
  type: 'check-in' | 'check-out';
  confidence_score: number;
  latitude?: number;
  longitude?: number;
}

export enum AppView {
  KIOSK = 'KIOSK',
  ADMIN_LOGIN = 'ADMIN_LOGIN',
  ADMIN_DASHBOARD = 'ADMIN_DASHBOARD',
  DOCS = 'DOCS',
}

export interface GeminiConfig {
  apiKey: string;
}

export interface SupabaseConfig {
  url: string;
  key: string;
}

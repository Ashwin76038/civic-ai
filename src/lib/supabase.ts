import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  neighborhood: string | null;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
};

export type Issue = {
  id: string;
  user_id: string;
  type: 'pothole' | 'water_leakage' | 'sewage_overflow';
  location: string;
  description: string | null;
  image_url: string | null;
  ai_confidence: number | null;
  severity: 'low' | 'medium' | 'high' | null;
  status: 'pending' | 'in_progress' | 'resolved' | 'escalated';
  created_at: string;
  updated_at: string;
};

export type IssueUpdate = {
  id: string;
  issue_id: string;
  message: string;
  status: 'pending' | 'in_progress' | 'resolved' | 'escalated';
  created_at: string;
  created_by: string;
};

export type IssueAssignment = {
  id: string;
  issue_id: string;
  assigned_to: string;
  assigned_by: string;
  assigned_at: string;
  status: 'active' | 'completed' | 'reassigned';
};
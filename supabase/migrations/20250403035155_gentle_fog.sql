/*
  # Civic Issue Reporting System Schema

  1. New Tables
    - `profiles`
      - User profiles with additional information
      - Linked to auth.users
    - `issues`
      - Reported infrastructure issues
      - Stores issue details, location, and AI analysis results
    - `issue_updates`
      - Status updates and progress tracking for issues
      - Linked to issues table
    - `issue_assignments`
      - Tracks which municipal workers are assigned to issues
      - Enables team management and accountability

  2. Security
    - Enable RLS on all tables
    - Policies for authenticated users to:
      - Read their own profile
      - Create and read issues
      - Read issue updates
    - Admin policies for full access
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  phone text,
  neighborhood text,
  is_admin boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create issues table
CREATE TABLE IF NOT EXISTS issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('pothole', 'water_leakage', 'sewage_overflow')),
  location text NOT NULL,
  description text,
  image_url text,
  ai_confidence float CHECK (ai_confidence >= 0 AND ai_confidence <= 1),
  severity text CHECK (severity IN ('low', 'medium', 'high')),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved', 'escalated')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create issue updates table
CREATE TABLE IF NOT EXISTS issue_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid REFERENCES issues(id) ON DELETE CASCADE,
  message text NOT NULL,
  status text CHECK (status IN ('pending', 'in_progress', 'resolved', 'escalated')),
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create issue assignments table
CREATE TABLE IF NOT EXISTS issue_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid REFERENCES issues(id) ON DELETE CASCADE,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at timestamptz DEFAULT now(),
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'reassigned'))
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_assignments ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can read own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Issues policies
CREATE POLICY "Users can create issues"
  ON issues
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read all issues"
  ON issues
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own issues"
  ON issues
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Issue updates policies
CREATE POLICY "Users can read all updates"
  ON issue_updates
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can create updates"
  ON issue_updates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND is_admin = true
    )
  );

-- Issue assignments policies
CREATE POLICY "Admins can manage assignments"
  ON issue_assignments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND is_admin = true
    )
  );

CREATE POLICY "Users can view assignments"
  ON issue_assignments
  FOR SELECT
  TO authenticated
  USING (true);

-- Functions
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (new.id, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
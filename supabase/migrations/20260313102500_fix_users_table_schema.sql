/*
  # Fix Users Table Schema

  1. Changes to `users` table
    - Drop existing policies that depend on columns
    - Modify column types to match application schema
    - Add missing columns
    - Recreate policies with correct types

  2. New columns added
    - `first_name` (varchar) - User's first name
    - `last_name` (varchar) - User's last name  
    - `role` (text, default 'user') - User role
    - `quiz_completed` (boolean, default false) - Onboarding status
    - `updated_at` (timestamptz) - Last update timestamp
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can read own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;

-- Add missing columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'first_name'
  ) THEN
    ALTER TABLE users ADD COLUMN first_name varchar;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'last_name'
  ) THEN
    ALTER TABLE users ADD COLUMN last_name varchar;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'role'
  ) THEN
    ALTER TABLE users ADD COLUMN role text NOT NULL DEFAULT 'user';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'quiz_completed'
  ) THEN
    ALTER TABLE users ADD COLUMN quiz_completed boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE users ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Alter column types
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE users ALTER COLUMN id TYPE varchar USING id::text;
    ALTER TABLE users ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'email' AND data_type = 'text'
  ) THEN
    ALTER TABLE users ALTER COLUMN email TYPE varchar;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'profile_image_url' AND data_type = 'text'
  ) THEN
    ALTER TABLE users ALTER COLUMN profile_image_url TYPE varchar;
  END IF;
END $$;

-- Recreate policies with varchar id type
CREATE POLICY "Users can read own profile"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid()::text = id);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = id)
  WITH CHECK (auth.uid()::text = id);
-- Create company_join_requests table
CREATE TABLE IF NOT EXISTS company_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, company_id, status) -- Prevent duplicate pending requests for the same company/user
);

-- Enable RLS
ALTER TABLE company_join_requests ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own requests" ON company_join_requests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own requests" ON company_join_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Company admins can view requests for their company" ON company_join_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.company_id = company_join_requests.company_id
      AND EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid()
        AND r.name IN ('super_admin', 'company_admin')
      )
    )
    OR is_super_admin(auth.uid())
  );

-- Function to approve a join request
CREATE OR REPLACE FUNCTION approve_company_join_request(request_id UUID)
RETURNS boolean AS $$
DECLARE
  v_user_id UUID;
  v_company_id UUID;
  v_status TEXT;
  v_role_id BIGINT;
BEGIN
  -- Get request details
  SELECT user_id, company_id, status INTO v_user_id, v_company_id, v_status
  FROM company_join_requests
  WHERE id = request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF v_status != 'pending' THEN
    RAISE EXCEPTION 'Request is already processed';
  END IF;

  -- Check if caller has permission (Admin of the target company or Super Admin)
  IF NOT (
    is_super_admin(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.company_id = v_company_id
      AND EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid()
        AND r.name IN ('super_admin', 'company_admin')
      )
    )
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- 1. Update Profile
  UPDATE profiles
  SET company_id = v_company_id,
      updated_at = now()
  WHERE id = v_user_id;

  -- 2. Ensure user has a base role if they don't have one
  SELECT id INTO v_role_id FROM roles WHERE name = 'rep';
  
  INSERT INTO user_roles (user_id, role_id)
  VALUES (v_user_id, v_role_id)
  ON CONFLICT (user_id, role_id) DO NOTHING;

  -- 3. Mark request as approved
  UPDATE company_join_requests
  SET status = 'approved',
      updated_at = now()
  WHERE id = request_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reject a join request
CREATE OR REPLACE FUNCTION reject_company_join_request(request_id UUID)
RETURNS boolean AS $$
DECLARE
  v_company_id UUID;
BEGIN
  -- Get company_id for permission check
  SELECT company_id INTO v_company_id
  FROM company_join_requests
  WHERE id = request_id;

  -- Check permission
  IF NOT (
    is_super_admin(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.company_id = v_company_id
      AND EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid()
        AND r.name IN ('super_admin', 'company_admin')
      )
    )
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE company_join_requests
  SET status = 'rejected',
      updated_at = now()
  WHERE id = request_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

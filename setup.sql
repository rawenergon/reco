-- RECO SIMPLIFIED SQL SETUP
-- 1. CLASS TABLE
CREATE TABLE IF NOT EXISTS public.class (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. STUDENT_DATA TABLE
CREATE TABLE IF NOT EXISTS public.student_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'student',
    class_id UUID REFERENCES public.class(id) ON DELETE SET NULL,
    photo_url TEXT,
    photo_base64 TEXT,
    email TEXT,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. TODAY (ATTENDANCE) TABLE
CREATE TABLE IF NOT EXISTS public.today (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id TEXT NOT NULL,
    employee_name TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    type TEXT CHECK (type IN ('check-in', 'check-out', 'break-in', 'break-out')),
    confidence_score DOUBLE PRECISION,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION
);

-- 4. ENABLE RLS
ALTER TABLE public.class ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.today ENABLE ROW LEVEL SECURITY;

-- 5. POLICIES (Authenticated = Admin)
-- Classes
DROP POLICY IF EXISTS "classes_view" ON public.class;
DROP POLICY IF EXISTS "classes_admin" ON public.class;
CREATE POLICY "classes_view" ON public.class FOR SELECT USING (true);
CREATE POLICY "classes_admin" ON public.class FOR ALL TO authenticated USING (true);

-- Students
DROP POLICY IF EXISTS "students_view" ON public.student_data;
DROP POLICY IF EXISTS "students_admin" ON public.student_data;
CREATE POLICY "students_view" ON public.student_data FOR SELECT USING (true);
CREATE POLICY "students_admin" ON public.student_data FOR ALL TO authenticated USING (true);

-- Attendance
DROP POLICY IF EXISTS "attendance_view" ON public.today;
DROP POLICY IF EXISTS "attendance_insert" ON public.today;
DROP POLICY IF EXISTS "attendance_admin" ON public.today;
CREATE POLICY "attendance_view" ON public.today FOR SELECT USING (true);
CREATE POLICY "attendance_insert" ON public.today FOR INSERT WITH CHECK (true);
CREATE POLICY "attendance_admin" ON public.today FOR ALL TO authenticated USING (true);

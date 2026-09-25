-- 1. إنشاء جدول لحفظ حالة الوقود ونصوص الموقع
CREATE TABLE site_content (
  id text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. إدخال الحالة الافتراضية للوقود
INSERT INTO site_content (id, value) VALUES ('fuel_status', '{"gasoline": "available", "diesel": "available"}');

-- 3. إنشاء مستودع لحفظ الصور (عام للقراءة)
INSERT INTO storage.buckets (id, name, public) VALUES ('media', 'media', true);

-- 4. دالة مساعدة: هل صاحب الجلسة الحالية مدير حقيقي؟
-- auth.role() = 'authenticated' وحده لا يكفي: أي مستخدم مسجّل (بل وأي تسجيل
-- مجهول Anonymous Sign-in إن فُعّل) يحمل هذا الدور. المدير الحقيقي يُعرَّف
-- بصفة app_metadata.kaziet_admin=true لا يستطيع أي مستخدم تعيينها بنفسه
-- (تُضبط من طرف الخادم فقط). راجع ADMIN_SETUP.md لخطوات التعيين.
CREATE OR REPLACE FUNCTION public.kaziet_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce((auth.jwt() -> 'app_metadata' ->> 'kaziet_admin')::boolean, false);
$$;

-- 5. تفعيل الحماية (RLS) للجدول
ALTER TABLE site_content ENABLE ROW LEVEL SECURITY;
-- السماح للزوار بقراءة البيانات فقط
CREATE POLICY "Allow public read" ON site_content FOR SELECT USING (true);
-- السماح للمدير الحقيقي وحده بتعديل البيانات أو إدراجها
CREATE POLICY "Admin write update" ON site_content
  FOR UPDATE TO authenticated
  USING (public.kaziet_is_admin())
  WITH CHECK (public.kaziet_is_admin());
CREATE POLICY "Admin write insert" ON site_content
  FOR INSERT TO authenticated
  WITH CHECK (public.kaziet_is_admin());

-- 6. تفعيل الحماية (RLS) للصور
-- السماح للزوار بمشاهدة الصور
CREATE POLICY "Public Image Access" ON storage.objects FOR SELECT USING (bucket_id = 'media');
-- السماح للمدير الحقيقي وحده برفع الصور وتعديلها وحذفها
CREATE POLICY "Admin Image Upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'media' AND public.kaziet_is_admin());
CREATE POLICY "Admin Image Update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'media' AND public.kaziet_is_admin())
  WITH CHECK (bucket_id = 'media' AND public.kaziet_is_admin());
CREATE POLICY "Admin Image Delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'media' AND public.kaziet_is_admin());

-- 7. لا تنسَ بعد هذا الملف: أنشئ حساب المدير وعيّن صفته عبر ADMIN_SETUP.md،
-- وإلا لن يستطيع أحد الكتابة (وهذا هو السلوك الآمن الافتراضي المقصود).

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

-- 4. تفعيل الحماية (RLS) للجدول
ALTER TABLE site_content ENABLE ROW LEVEL SECURITY;
-- السماح للزوار بقراءة البيانات فقط
CREATE POLICY "Allow public read" ON site_content FOR SELECT USING (true);
-- السماح لمدير الموقع (المسجل دخوله) بتعديل البيانات
CREATE POLICY "Allow admin update" ON site_content FOR UPDATE USING (auth.role() = 'authenticated');

-- 5. تفعيل الحماية (RLS) للصور
-- السماح للزوار بمشاهدة الصور
CREATE POLICY "Public Image Access" ON storage.objects FOR SELECT USING (bucket_id = 'media');
-- السماح للمدير برفع وحذف الصور
CREATE POLICY "Admin Image Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'media' AND auth.role() = 'authenticated');
CREATE POLICY "Admin Image Update" ON storage.objects FOR UPDATE USING (bucket_id = 'media' AND auth.role() = 'authenticated');
CREATE POLICY "Admin Image Delete" ON storage.objects FOR DELETE USING (bucket_id = 'media' AND auth.role() = 'authenticated');

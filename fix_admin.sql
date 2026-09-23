-- إصلاح لوحة الإدارة · يُشغَّل مرة واحدة في Supabase ← SQL Editor ← Run
-- 1. السماح للمدير المسجّل بإدراج الصفوف (كان مسموحاً له التحديث وحده، فكان حفظ الصورة يفشل)
CREATE POLICY "Allow admin insert" ON site_content FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 2. صف صورة الواجهة فارغاً، فيعمل الرفع والعودة للفيديو بالتحديث وحده
INSERT INTO site_content (id, value) VALUES ('hero_image', '{"url": null}') ON CONFLICT (id) DO NOTHING;

-- 3. تحديث وقت آخر تعديل تلقائياً عند كل حفظ
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS site_content_updated_at ON site_content;
CREATE TRIGGER site_content_updated_at BEFORE UPDATE ON site_content
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

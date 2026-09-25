-- إصلاح لوحة الإدارة · يُشغَّل مرة واحدة في Supabase ← SQL Editor ← Run
--
-- ملاحظة أمنية: كانت النسخة السابقة من هذا الملف تُنشئ سياسة إدراج تسمح
-- لكل auth.role() = 'authenticated' (أي مستخدم مسجّل، وليس المدير حصراً)
-- بالكتابة على site_content. أُزيلت هنا لأنها كانت تعيد فتح الصلاحية التي
-- تسدّها migrations/2026-09-25_restrict_admin_write_access.sql. سياسة
-- الإدراج الصحيحة (بصفة مدير حقيقية عبر app_metadata.kaziet_admin) موجودة
-- الآن في supabase_setup.sql مباشرة، وفي ملف الترقيع لمن أنشأ مشروعه قبله.
-- لا حاجة لتشغيل شيء هنا لأجل الصلاحيات بعد تطبيق ملف الترقيع.

-- 1. صف صورة الواجهة فارغاً، فيعمل الرفع والعودة للفيديو بالتحديث وحده
INSERT INTO site_content (id, value) VALUES ('hero_image', '{"url": null}') ON CONFLICT (id) DO NOTHING;

-- 2. تحديث وقت آخر تعديل تلقائياً عند كل حفظ
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS site_content_updated_at ON site_content;
CREATE TRIGGER site_content_updated_at BEFORE UPDATE ON site_content
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ترقيع أمني: تقييد الكتابة على site_content وstorage.objects بصفة مدير حقيقية
--
-- المشكلة: السياسات القديمة (supabase_setup.sql وfix_admin.sql) تمنح الكتابة
-- لكل auth.role() = 'authenticated'، وهذا الدور يحمله أي مستخدم مسجّل دخوله،
-- بل وأي مستخدم "تسجيل مجهول" (Anonymous Sign-in) إن كان مفعّلاً في المشروع —
-- فتوثيق Supabase صريح أن المستخدم المجهول يحمل دور authenticated أيضاً
-- (https://supabase.com/docs/guides/auth/auth-anonymous). الشرط لا يميّز
-- زائراً سجّل نفسه عن "المدير" الذي تفترضه التعليقات والواجهة.
--
-- الحل: صفة مدير لا يستطيع أي مستخدم تعيينها بنفسه، توضع في
-- app_metadata.kaziet_admin=true من طرف الخادم فقط (لا يمكن لـ updateUser
-- من العميل تعديل app_metadata، بخلاف user_metadata) — راجع:
-- https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac
--
-- **لا تُشغّل هذا الملف قبل تعيين مدير حقيقي واحد على الأقل بصفة
-- kaziet_admin=true في app_metadata.** التعليمات الكاملة وخطوات الاختبار
-- والتراجع في ADMIN_SETUP.md. تشغيله قبل ذلك يقفل الكتابة على الجميع دون
-- استثناء (الحارس أدناه يمنع هذا ويوقف التنفيذ).
--
-- ملاحظة انحراف: فحص pg_policies يدوياً على القاعدة الحيّة (قراءة فقط)
-- كشف سياسة "Allow admin delete" (DELETE بشرط auth.role()='authenticated')
-- على site_content غير موجودة في أي ملف SQL متتبَّع هنا. أُسقطت أدناه
-- في القسم 1. راجع ADMIN_SETUP.md لتفاصيل هذا الانحراف وكيفية إعادة
-- فحصه على مشروعكم قبل الاعتماد على قائمة السياسات المتوقعة هنا.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE (raw_app_meta_data ->> 'kaziet_admin')::boolean IS TRUE
  ) THEN
    RAISE EXCEPTION
      'لا يوجد أي مستخدم بصفة kaziet_admin=true في app_metadata. عيّن مديراً حقيقياً أولاً (راجع ADMIN_SETUP.md) قبل تشغيل هذا الملف، وإلا ستُقفل لوحة الإدارة على الجميع بلا استثناء.';
  END IF;
END $$;

-- دالة مساعدة: هل صاحب الجلسة الحالية مدير حقيقي؟
-- SECURITY INVOKER (الافتراضي) كافٍ: تقرأ فقط JWT الجلسة الحالية عبر auth.jwt().
CREATE OR REPLACE FUNCTION public.kaziet_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce((auth.jwt() -> 'app_metadata' ->> 'kaziet_admin')::boolean, false);
$$;

-- 1. site_content: إسقاط السياسات القديمة المتساهلة
-- "Allow admin delete" موجودة على القاعدة الحيّة فعلياً (رصدها فحص
-- pg_policies يدوياً) ولم تكن مذكورة في أي ملف SQL متتبَّع هنا — انحراف
-- بين القاعدة الحيّة والمستودع، لا خطأ في التاريخ المسجَّل. تُسقَط دون
-- بديل: لا تحتاج admin.html حذف صفوف site_content إطلاقاً (تُفرَّغ
-- القيم بدل الحذف، انظر app.js/admin.html)، فتبقى عملية DELETE على هذا
-- الجدول ممنوعة على الجميع بلا استثناء — بلا سياسة تسمح بها صراحة، RLS
-- يرفضها افتراضياً لكل الأدوار بما فيها المدير.
DROP POLICY IF EXISTS "Allow admin delete" ON site_content;
DROP POLICY IF EXISTS "Allow admin update" ON site_content;
DROP POLICY IF EXISTS "Allow admin insert" ON site_content;
DROP POLICY IF EXISTS "Admin write update" ON site_content;
DROP POLICY IF EXISTS "Admin write insert" ON site_content;

CREATE POLICY "Admin write update" ON site_content
  FOR UPDATE TO authenticated
  USING (public.kaziet_is_admin())
  WITH CHECK (public.kaziet_is_admin());

CREATE POLICY "Admin write insert" ON site_content
  FOR INSERT TO authenticated
  WITH CHECK (public.kaziet_is_admin());

-- 2. storage.objects (مستودع media فقط): نفس المبدأ
DROP POLICY IF EXISTS "Admin Image Upload" ON storage.objects;
DROP POLICY IF EXISTS "Admin Image Update" ON storage.objects;
DROP POLICY IF EXISTS "Admin Image Delete" ON storage.objects;

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

COMMIT;

-- القراءة العامة (Allow public read وPublic Image Access) لم تُمسّ عمداً:
-- سلوك الموقع يعتمد عليها ولا علاقة لها بثغرة الكتابة.

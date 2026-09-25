# تهيئة صفة المدير وتطبيق ترقيع الصلاحيات

هذا الملف يشرح كيف تسدّ الثغرة الموثّقة في PR الترقيع: السياسات القديمة كانت
تسمح لأي `auth.role() = 'authenticated'` (أي مستخدم مسجّل، وحتى مستخدم
"تسجيل مجهول" إن كان مفعّلاً) بالكتابة على `site_content` وصور `storage.objects`،
بينما المفترض أن يملك هذا الحق المدير وحده.

الحل: صفة `app_metadata.kaziet_admin = true` لا يستطيع أي مستخدم تعيينها
بنفسه (لا عبر `updateUser` من العميل، ولا من أي مكان غير SQL Editor بصلاحية
service role/postgres في لوحة Supabase).

## 1. تعيين المدير الحقيقي (قبل تشغيل ملف الترقيع)

1. أنشئ حساب المدير إن لم يكن موجوداً (Authentication → Users → Add user)، أو استخدم حساباً موجوداً بالفعل يسجّل به المدير الدخول من `admin.html`.
2. في Supabase ← **SQL Editor**، نفّذ (استبدل البريد ببريد المدير الفعلي):

```sql
UPDATE auth.users
SET raw_app_meta_data =
  coalesce(raw_app_meta_data, '{}'::jsonb) || '{"kaziet_admin": true}'::jsonb
WHERE email = 'admin@example.com';
```

3. تحقّق:

```sql
SELECT email, raw_app_meta_data ->> 'kaziet_admin' AS is_admin
FROM auth.users
WHERE email = 'admin@example.com';
```

يجب أن يعيد `true`.

## 2. تطبيق ملف الترقيع

بعد التأكد من وجود مدير واحد على الأقل بصفة `kaziet_admin=true`:

- **مشروع قائم بالفعل (السياسات القديمة مُطبَّقة):** شغّل
  `migrations/2026-09-25_restrict_admin_write_access.sql` في SQL Editor.
  الملف يحتوي حارساً يوقف التنفيذ برسالة عربية إن لم يجد أي مدير مُعيَّن،
  فلن يقفل الصلاحيات على الجميع بالخطأ.
- **مشروع جديد من الصفر:** `supabase_setup.sql` أصبح يحتوي السياسات الآمنة
  مباشرة، فلا حاجة لملف الترقيع بعده. شغّله ثم عيّن المدير كما في الخطوة 1.
- `fix_admin.sql` لم يعد يفتح أي صلاحية؛ يبقى فقط لإصلاحات غير أمنية
  (صف `hero_image` الافتراضي ومُشغّل `updated_at`).

## 3. تحديث JWT بعد التعيين

`app_metadata` يُقرأ من الـ JWT الحالي للجلسة، لا من قاعدة البيانات مباشرة
في كل طلب. إن كان المدير مسجّلاً دخوله وقت تنفيذ الخطوة 1، يجب أن يُصدَر له
JWT جديد يحمل الصفة:

- الأبسط: يسجّل المدير **خروجاً ثم دخولاً** من جديد في `admin.html`.
- أو يستدعي العميل `client.auth.refreshSession()` إن كان مسجّلاً بالفعل ولا يريد تسجيل الخروج.

بدون هذه الخطوة، محاولات الكتابة سترفضها قاعدة البيانات حتى لو كانت صفة
`kaziet_admin` مضبوطة فعلاً في `auth.users`، لأن الـ JWT القديم في الجلسة
لا يحملها بعد.

## 4. خطة الاختبار (بعد التطبيق)

نفّذها من محرّر SQL أو من التطبيق مباشرة، بلا نشر أي مفتاح أو قيمة هوية:

| الحالة | العملية | النتيجة المتوقعة |
|---|---|---|
| مجهول (anon key، بلا جلسة) | قراءة `site_content` | تنجح (قراءة عامة مقصودة) |
| مجهول (anon key، بلا جلسة) | تحديث/إدراج في `site_content` أو رفع صورة | **تُرفض** (لا يوجد دور authenticated أصلاً) |
| مستخدم عادي مسجّل دخوله (بلا `kaziet_admin`) | تحديث/إدراج في `site_content` | **تُرفض** — هذا هو الفرق الجوهري عن السلوك القديم |
| مستخدم عادي مسجّل دخوله (بلا `kaziet_admin`) | رفع صورة إلى `media` | **تُرفض** |
| المدير الحقيقي (بعد تحديث الجلسة) | تحديث حالة الوقود، رفع صورة، حذف الصورة | تنجح جميعها من `admin.html` كما في السابق |

لاختبار "مستخدم عادي": أنشئ حساباً تجريبياً بلا صفة `kaziet_admin`، سجّل
دخوله من `admin.html`، وحاول تعديل حالة الوقود — يجب أن يظهر خطأ رفض من
قاعدة البيانات وليس نجاحاً صامتاً.

**ما لا يمكن اختباره من الكود وحده (يحتاج قاعدة Supabase حيّة):**
- هل مشروعكم الحي يفعّل "تسجيل مجهول" (Anonymous Sign-ins) فعلاً؟ لم نتحقق من هذا الإعداد ولا من حالة السياسات المطبَّقة فعلياً على القاعدة الحيّة — هذا الترقيع يسدّ الثغرة بصرف النظر عن الجواب.
- تنفيذ السياسات الفعلي (`EXPLAIN`، سلوك RLS الحقيقي) يحتاج اتصالاً بقاعدة حيّة؛ لم نطبّق أي SQL على الإنتاج ضمن هذه المهمة.
- لا خط أنابيب CI أو اختبارات آلية في هذا المستودع (مجرّد صفحات ثابتة)؛ التحقق الوحيد المتاح كان فحص بنية SQL يدوياً (راجع قسم الفحص أدناه).

## 5. التراجع (Rollback)

إن تعطّلت لوحة الإدارة بعد التطبيق (مثلاً نسيان الخطوة 3):

1. تأكد أولاً أن سبب الرفض هو JWT قديم لا صفة ناقصة فعلاً (كرر فحص الخطوة 1.3، ثم سجّل خروجاً ودخولاً).
2. إن أردت التراجع الكامل مؤقتاً عن الترقيع (غير مستحسن، يعيد فتح الثغرة):

```sql
BEGIN;
DROP POLICY IF EXISTS "Admin write update" ON site_content;
DROP POLICY IF EXISTS "Admin write insert" ON site_content;
CREATE POLICY "Allow admin update" ON site_content FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Allow admin insert" ON site_content FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admin Image Upload" ON storage.objects;
DROP POLICY IF EXISTS "Admin Image Update" ON storage.objects;
DROP POLICY IF EXISTS "Admin Image Delete" ON storage.objects;
CREATE POLICY "Admin Image Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'media' AND auth.role() = 'authenticated');
CREATE POLICY "Admin Image Update" ON storage.objects FOR UPDATE USING (bucket_id = 'media' AND auth.role() = 'authenticated');
CREATE POLICY "Admin Image Delete" ON storage.objects FOR DELETE USING (bucket_id = 'media' AND auth.role() = 'authenticated');
COMMIT;
```

3. الأصح دوماً: أبقِ الترقيع مطبَّقاً وأصلح تعيين `kaziet_admin` بدل التراجع عنه.

/**
 * لوحة المدير داخل الصفحة الرئيسية.
 * الإخفاء هنا راحة للزائر لا حماية: الحماية الفعلية سياسات RLS في Supabase
 * (راجع ADMIN_SETUP.md)، فمن ليس لحسابه app_metadata.kaziet_admin يُرفض كل ما يكتبه.
 */
document.addEventListener('DOMContentLoaded', () => {
    const client = window.KAZIET_CLIENT;
    const $ = (id) => document.getElementById(id);

    const modal = $('admin-modal');
    const lockBtn = $('admin-lock');
    const headerBtn = $('admin-open');
    if (!modal || !lockBtn) return;

    const views = { login: $('admin-login'), panel: $('admin-panel') };
    const msg = $('admin-msg');
    const email = $('admin-email');
    const pw = $('admin-pw');
    const btnLogin = $('admin-btn-login');
    const btnLogout = $('admin-btn-logout');
    const btnFuel = $('admin-btn-fuel');
    const fuelOpts = modal.querySelectorAll('.admin-opt');
    const fileInput = $('admin-file');
    const preview = $('admin-preview');
    const btnUpload = $('admin-btn-upload');
    const btnRevert = $('admin-btn-revert');

    let fuelState = { gasoline: 'available', diesel: 'available' };
    let opener = null;
    let msgTimer = null;

    const isAdmin = (session) => session?.user?.app_metadata?.kaziet_admin === true;

    function showMsg(text, type = 'ok') {
        clearTimeout(msgTimer);
        msg.textContent = text;
        msg.className = 'admin-msg ' + type;
        if (text) msgTimer = setTimeout(() => { msg.textContent = ''; }, 6000);
    }

    function show(view) {
        views.login.hidden = view !== 'login';
        views.panel.hidden = view !== 'panel';
    }

    function openModal(trigger) {
        opener = trigger || document.activeElement;
        modal.hidden = false;
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        modal.hidden = true;
        document.body.style.overflow = '';
        showMsg('');
        pw.value = '';
        if (opener && typeof opener.focus === 'function') opener.focus();
    }

    function updateButtons() {
        fuelOpts.forEach((b) => {
            const on = fuelState[b.dataset.fuel] === b.dataset.value;
            b.classList.toggle('active', on);
            b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
    }

    // يُكتب الصف بالتحديث أولاً لأنه يكفيه إذن UPDATE، ويُدرج إن لم يوجد.
    async function saveRow(id, value) {
        const row = { value, updated_at: new Date().toISOString() };
        const upd = await client.from('site_content').update(row).eq('id', id).select('id');
        if (upd.error) return upd.error.message;
        if (upd.data && upd.data.length) return null;
        const ins = await client.from('site_content').insert({ id, ...row }).select('id');
        if (ins.error) return 'رفضت قاعدة البيانات الحفظ (' + ins.error.message + ')';
        if (!ins.data || !ins.data.length) return 'لم يُحفظ شيء';
        return null;
    }

    async function loadData() {
        const { data, error } = await client.from('site_content').select('*');
        if (error) { showMsg('تعذّرت قراءة الحالة الحالية: ' + error.message, 'err'); return; }
        (data || []).forEach((row) => {
            if (row.id === 'fuel_status' && row.value) {
                fuelState = { gasoline: row.value.gasoline, diesel: row.value.diesel };
                updateButtons();
            }
            if (row.id === 'hero_image') {
                btnRevert.hidden = !(row.value && row.value.url);
            }
        });
    }

    async function enter(trigger) {
        openModal(trigger);
        const { data: { session } } = await client.auth.getSession();
        if (isAdmin(session)) {
            show('panel');
            await loadData();
            btnFuel.focus();
        } else {
            show('login');
            email.focus();
        }
    }

    async function refreshHeaderButton() {
        const { data: { session } } = await client.auth.getSession();
        if (headerBtn) headerBtn.hidden = !isAdmin(session);
    }

    // ---- الدخول والخروج
    btnLogin.addEventListener('click', async () => {
        if (!email.value || !pw.value) { showMsg('أدخل البريد وكلمة السر', 'err'); return; }
        btnLogin.disabled = true;
        showMsg('جارِ الدخول...');
        const { data, error } = await client.auth.signInWithPassword({ email: email.value, password: pw.value });
        if (error) {
            showMsg('بيانات الدخول غير صحيحة', 'err');
        } else if (!isAdmin(data.session)) {
            await client.auth.signOut();
            showMsg('هذا الحساب لا يملك صلاحية الإدارة', 'err');
        } else {
            showMsg('');
            pw.value = '';
            show('panel');
            await loadData();
            await refreshHeaderButton();
            btnFuel.focus();
        }
        btnLogin.disabled = false;
    });
    pw.addEventListener('keydown', (e) => { if (e.key === 'Enter') btnLogin.click(); });

    btnLogout.addEventListener('click', async () => {
        await client.auth.signOut();
        await refreshHeaderButton();
        closeModal();
    });

    // ---- حالة الوقود
    fuelOpts.forEach((b) => b.addEventListener('click', () => {
        fuelState[b.dataset.fuel] = b.dataset.value;
        updateButtons();
    }));

    btnFuel.addEventListener('click', async () => {
        btnFuel.disabled = true;
        showMsg('جارِ النشر...');
        const err = await saveRow('fuel_status', fuelState);
        if (err) {
            showMsg('لم تُنشر الحالة: ' + err, 'err');
        } else {
            window.dispatchEvent(new CustomEvent('kaziet:fuel', { detail: { ...fuelState } }));
            showMsg('نُشرت الحالة، وهي تظهر الآن في الصفحة خلفك');
        }
        btnFuel.disabled = false;
    });

    // ---- صورة الواجهة
    fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];
        if (file) {
            preview.src = URL.createObjectURL(file);
            preview.hidden = false;
        }
    });

    btnUpload.addEventListener('click', async () => {
        const file = fileInput.files[0];
        if (!file) { showMsg('اختر صورة أولاً', 'err'); return; }
        btnUpload.disabled = true;
        showMsg('جارِ رفع الصورة...');
        const ext = file.name.split('.').pop();
        const fileName = `hero_${Date.now()}.${ext}`;
        const { error } = await client.storage.from('media').upload(fileName, file, { upsert: true });
        if (error) {
            showMsg('فشل الرفع: ' + error.message, 'err');
        } else {
            const { data: urlData } = client.storage.from('media').getPublicUrl(fileName);
            const err = await saveRow('hero_image', { url: urlData.publicUrl });
            if (err) {
                showMsg('رُفعت الصورة لكن الموقع لم يتغيّر: ' + err, 'err');
            } else {
                showMsg('تغيّرت صورة الواجهة');
                fileInput.value = '';
                preview.hidden = true;
                btnRevert.hidden = false;
                window.dispatchEvent(new Event('kaziet:reload'));
            }
        }
        btnUpload.disabled = false;
    });

    btnRevert.addEventListener('click', async () => {
        if (!confirm('حذف الصورة والعودة إلى فيديو الخلفية الأصلي؟')) return;
        btnRevert.disabled = true;
        showMsg('جارِ الحذف...');
        const err = await saveRow('hero_image', { url: null });
        if (err) {
            showMsg('لم تُحذف الصورة: ' + err, 'err');
        } else {
            showMsg('عاد الموقع إلى فيديو الخلفية');
            btnRevert.hidden = true;
            window.dispatchEvent(new Event('kaziet:reload'));
        }
        btnRevert.disabled = false;
    });

    // ---- فتح وإغلاق النافذة
    const unavailable = () => {
        openModal(lockBtn);
        show('login');
        showMsg('تعذّر الاتصال بالخدمة. تحقق من الإنترنت وأعد تحميل الصفحة', 'err');
    };
    const onOpen = (e) => { client ? enter(e.currentTarget) : unavailable(); };
    lockBtn.addEventListener('click', onOpen);
    if (headerBtn) headerBtn.addEventListener('click', onOpen);

    $('admin-close').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    document.addEventListener('keydown', (e) => {
        if (modal.hidden) return;
        if (e.key === 'Escape') { closeModal(); return; }
        if (e.key === 'Tab') {
            const items = [...modal.querySelectorAll('button, input, a[href]')]
                .filter((el) => !el.disabled && el.offsetParent !== null);
            if (!items.length) return;
            const first = items[0];
            const last = items[items.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
    });

    if (client) {
        refreshHeaderButton();
        client.auth.onAuthStateChange(() => { refreshHeaderButton(); });
    }
});

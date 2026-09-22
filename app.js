/**
 * كازية عبد الحليم للمحروقات — جبلة
 * نظام إدارة الحالة الحية والتفاعل البرمجي
 */

document.addEventListener('DOMContentLoaded', () => {
    // ------------------------------------------------------------
    // 1. نظام جلب البيانات الحية (حالة الوقود + واجهة الموقع) من Supabase
    // ------------------------------------------------------------
    const supabaseUrl = window.KAZIET_CONFIG?.supabaseUrl;
    const supabaseKey = window.KAZIET_CONFIG?.supabaseKey;
    let supabaseClient = null;
    
    if (supabaseUrl && supabaseKey && window.supabase) {
        supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
    }

    const STALE_AFTER_HOURS = 12;   // بعدها تُعرض الحالة "غير مؤكد"
    const POLL_MS = 120000;         // إعادة الجلب كل دقيقتين

    const BADGE_TEXT = {
        gasoline: { available: 'متوفر للسيارات', unavailable: 'غير متوفر حالياً' },
        diesel:   { available: 'متوفر للتعبئة',  unavailable: 'نفد مؤقتاً' }
    };
    const NOTE_TEXT = {
        unavailable: 'نُعلن هنا فور توفره',
        unknown: 'لم تُحدَّث الحالة مؤخراً، تأكد بالمراسلة قبل الحضور'
    };

    const fuels = {};
    ['gasoline', 'diesel'].forEach(key => {
        const el = document.getElementById(key + '-widget');
        if (el) {
            const cond = el.querySelector('.fuel-condition');
            if (!cond.dataset.default) cond.dataset.default = cond.textContent;
            fuels[key] = { el, cond, badge: el.querySelector('.fuel-status-badge'), defaultNote: cond.dataset.default };
        }
    });

    const timestampDisplay = document.getElementById('status-timestamp');
    const refreshBtn = document.getElementById('btn-refresh-status');

    let status = null;   // { gasoline, diesel, updatedAt } بعد أول جلب ناجح
    let loaded = false;

    function arUnit(n, one, two, few, many) {
        if (n === 1) return `${one}`;
        if (n === 2) return `${two}`;
        return n <= 10 ? `${n} ${few}` : `${n} ${many}`;
    }

    function relativeTime(ts) {
        const minutes = Math.max(0, Math.floor((Date.now() - ts) / 60000));
        if (minutes < 1) return 'الآن';
        if (minutes < 60) return 'منذ ' + arUnit(minutes, 'دقيقة', 'دقيقتين', 'دقائق', 'دقيقة');
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return 'منذ ' + arUnit(hours, 'ساعة', 'ساعتين', 'ساعات', 'ساعة');
        const days = Math.floor(hours / 24);
        return 'منذ ' + arUnit(days, 'يوم', 'يومين', 'أيام', 'يوماً');
    }

    function isFresh() {
        return !!(status && status.updatedAt &&
            (Date.now() - status.updatedAt) < STALE_AFTER_HOURS * 3600000);
    }

    function render() {
        const fresh = isFresh();
        Object.keys(fuels).forEach(key => {
            const f = fuels[key];
            const value = fresh ? status[key] : 'unknown';
            const state = (value === 'available' || value === 'unavailable') ? value : 'unknown';

            f.el.classList.toggle('is-available', state === 'available');
            f.el.classList.toggle('is-unavailable', state === 'unavailable');
            f.el.classList.toggle('is-unknown', state === 'unknown');

            if (f.badge) {
                f.badge.textContent = '';
                const dot = document.createElement('span');
                dot.className = 'fuel-status-dot';
                const label = document.createElement('span');
                label.textContent = state === 'unknown'
                    ? (loaded ? 'غير مؤكد' : 'جارٍ التحقق…')
                    : BADGE_TEXT[key][state];
                f.badge.append(dot, label);
            }

            if (f.cond) {
                f.cond.textContent = state === 'available' ? f.defaultNote : NOTE_TEXT[state];
            }
        });

        if (timestampDisplay) {
            timestampDisplay.textContent = (status && status.updatedAt)
                ? `آخر تحديث: ${relativeTime(status.updatedAt)}`
                : (loaded ? 'آخر تحديث: غير معروف' : 'جارٍ التحقق…');
        }
    }

    async function loadSiteData() {
        if (!supabaseClient) {
            loaded = true;
            render();
            return;
        }

        try {
            const { data, error } = await supabaseClient.from('site_content').select('*');
            if (error) throw error;
            
            let hasHeroImage = false;

            data.forEach(row => {
                // تحديث حالة الوقود
                if (row.id === 'fuel_status' && row.value) {
                    status = {
                        gasoline: row.value.gasoline,
                        diesel: row.value.diesel,
                        updatedAt: new Date(row.updated_at).getTime()
                    };
                }
                
                // تحديث صورة الخلفية الرئيسية إذا تم رفع صورة من الأدمن
                if (row.id === 'hero_image' && row.value && row.value.url) {
                    hasHeroImage = true;
                    const heroBg = document.querySelector('.hero-video-backdrop');
                    const heroVideo = document.getElementById('hero-main-video');
                    if (heroBg) {
                        heroBg.style.backgroundImage = `url('${row.value.url}')`;
                        heroBg.style.backgroundSize = 'cover';
                        heroBg.style.backgroundPosition = 'center';
                        heroBg.style.backgroundAttachment = 'scroll';
                    }
                    if (heroVideo) {
                        heroVideo.style.display = 'none'; // إخفاء الفيديو
                        const btnToggle = document.getElementById('btn-hero-video-toggle');
                        const btnMute = document.getElementById('btn-hero-video-mute');
                        if (btnToggle) btnToggle.style.display = 'none';
                        if (btnMute) btnMute.style.display = 'none';
                    }
                }
            });

            // العودة للفيديو إذا تم حذف الصورة من اللوحة
            if (!hasHeroImage) {
                const heroBg = document.querySelector('.hero-video-backdrop');
                const heroVideo = document.getElementById('hero-main-video');
                if (heroBg) {
                    heroBg.style.backgroundImage = 'none';
                }
                if (heroVideo) {
                    heroVideo.style.display = 'block';
                    const btnToggle = document.getElementById('btn-hero-video-toggle');
                    const btnMute = document.getElementById('btn-hero-video-mute');
                    if (btnToggle) btnToggle.style.display = 'inline-flex';
                    if (btnMute) btnMute.style.display = 'inline-flex';
                }
            }

        } catch (err) {
            console.error('Failed to load data from Supabase:', err);
        }
        
        loaded = true;
        render();
    }

    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            const icon = refreshBtn.querySelector('svg');
            icon.classList.add('spinning');
            await loadSiteData();
            icon.classList.remove('spinning');
        });
    }

    render();
    loadSiteData();
    setInterval(loadSiteData, POLL_MS);
    setInterval(render, 60000);

    // ------------------------------------------------------------
    // 2. معاينة الصور بنافذة منبثقة (Lightbox Modal)
    // ------------------------------------------------------------
    const lightboxModal = document.getElementById('lightbox-modal');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxCaption = document.getElementById('lightbox-caption');
    const lightboxClose = document.getElementById('lightbox-close');

    document.querySelectorAll('.gallery-item').forEach(item => {
        item.addEventListener('click', () => {
            const img = item.querySelector('img');
            const title = item.querySelector('.gallery-title')?.textContent || '';
            lightboxImg.src = img.src;
            lightboxCaption.textContent = title;
            lightboxModal.classList.add('is-active');
        });
    });

    lightboxClose.addEventListener('click', () => {
        lightboxModal.classList.remove('is-active');
    });

    lightboxModal.addEventListener('click', (e) => {
        if (e.target === lightboxModal) {
            lightboxModal.classList.remove('is-active');
        }
    });

    // إغلاق عبر زر ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && lightboxModal.classList.contains('is-active')) {
            lightboxModal.classList.remove('is-active');
        }
    });

    // ------------------------------------------------------------
    // 3. التحكم بمشغل الفيديو السينمائي في واجهة الموقع (Hero Video)
    // ------------------------------------------------------------
    const heroVideo = document.getElementById('hero-main-video');
    const btnHeroToggle = document.getElementById('btn-hero-video-toggle');
    const btnHeroMute = document.getElementById('btn-hero-video-mute');
    const heroIconPlay = document.getElementById('hero-icon-play');
    const heroIconPause = document.getElementById('hero-icon-pause');
    const heroIconSoundOn = document.getElementById('hero-icon-sound-on');
    const heroIconSoundOff = document.getElementById('hero-icon-sound-off');

    if (heroVideo && btnHeroToggle && btnHeroMute) {
        const toggleTextSpan = btnHeroToggle.querySelector('span');
        const muteTextSpan = btnHeroMute.querySelector('span');

        btnHeroToggle.addEventListener('click', () => {
            if (heroVideo.paused) {
                heroVideo.play();
                heroIconPause.style.display = 'block';
                heroIconPlay.style.display = 'none';
                btnHeroToggle.setAttribute('aria-label', 'إيقاف مؤقت للفيديو');
                if (toggleTextSpan) toggleTextSpan.textContent = 'إيقاف مؤقت';
            } else {
                heroVideo.pause();
                heroIconPause.style.display = 'none';
                heroIconPlay.style.display = 'block';
                btnHeroToggle.setAttribute('aria-label', 'تشغيل الفيديو');
                if (toggleTextSpan) toggleTextSpan.textContent = 'تشغيل';
            }
        });

        btnHeroMute.addEventListener('click', () => {
            heroVideo.muted = !heroVideo.muted;
            if (heroVideo.muted) {
                heroIconSoundOff.style.display = 'block';
                heroIconSoundOn.style.display = 'none';
                btnHeroMute.setAttribute('aria-label', 'تشغيل الصوت');
                if (muteTextSpan) muteTextSpan.textContent = 'تشغيل الصوت';
            } else {
                heroIconSoundOff.style.display = 'none';
                heroIconSoundOn.style.display = 'block';
                btnHeroMute.setAttribute('aria-label', 'كتم الصوت');
                if (muteTextSpan) muteTextSpan.textContent = 'كتم الصوت';
            }
        });
    }

    // ------------------------------------------------------------
    // 4. نظام الحركات التفاعلية (GSAP Animations)
    // ------------------------------------------------------------
    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
        gsap.registerPlugin(ScrollTrigger);

        // أ. تتابع التحميل (Page Load Sequence)
        const tlLoad = gsap.timeline();
        tlLoad.from('.site-header', { y: -30, opacity: 0, duration: 1, ease: 'power3.out' })
              .from('.hero-title', { y: 20, opacity: 0, duration: 0.8, ease: 'power3.out' }, '-=0.6')
              .from('.hero-description', { y: 20, opacity: 0, duration: 0.8, ease: 'power3.out' }, '-=0.6')
              .from('.hero-chip', { y: 20, opacity: 0, duration: 0.6, stagger: 0.1, ease: 'back.out(1.7)' }, '-=0.4')
              .from('.hero-actions-btns a', { scale: 0.9, opacity: 0, duration: 0.5, stagger: 0.1, ease: 'back.out(1.5)' }, '-=0.2');

        // ب. أنيميشن التمرير (Scroll-triggered)
        
        // لوحة الوقود
        gsap.from('.fuel-dashboard-card', {
            scrollTrigger: {
                trigger: '.fuel-dashboard-section',
                start: 'top 85%',
                toggleActions: 'play none none reverse'
            },
            y: 40,
            opacity: 0,
            duration: 0.8,
            ease: 'power3.out'
        });

        // كروت الخدمات
        gsap.from('.service-card', {
            scrollTrigger: {
                trigger: '.services-grid',
                start: 'top 80%',
                toggleActions: 'play none none reverse'
            },
            y: 40,
            opacity: 0,
            duration: 0.6,
            stagger: 0.15,
            ease: 'power2.out'
        });

        // قسم الجودة
        gsap.from('.quality-checklist li', {
            scrollTrigger: {
                trigger: '.feature-content',
                start: 'top 80%',
                toggleActions: 'play none none reverse'
            },
            x: 30, // حركة من اليمين لليسار (متوافق مع RTL)
            opacity: 0,
            duration: 0.5,
            stagger: 0.15,
            ease: 'power2.out'
        });

        gsap.from('.feature-image-box', {
            scrollTrigger: {
                trigger: '.quality-feature-section',
                start: 'top 75%',
                toggleActions: 'play none none reverse'
            },
            scale: 0.95,
            opacity: 0,
            duration: 1,
            ease: 'power3.out'
        });

        // عراقة الطريق
        gsap.from('.heritage-card', {
            scrollTrigger: {
                trigger: '.heritage-cards-grid',
                start: 'top 80%',
                toggleActions: 'play none none reverse'
            },
            y: 40,
            opacity: 0,
            duration: 0.8,
            stagger: 0.2,
            ease: 'power3.out'
        });

        // معرض الصور
        gsap.from('.gallery-item', {
            scrollTrigger: {
                trigger: '.gallery-grid',
                start: 'top 85%',
                toggleActions: 'play none none reverse'
            },
            scale: 0.95,
            opacity: 0,
            duration: 0.6,
            stagger: 0.1,
            ease: 'back.out(1.2)'
        });
        
        // تأثير Parallax للفيديو في الخلفية
        gsap.to('.hero-video-backdrop video', {
            yPercent: 15,
            ease: "none",
            scrollTrigger: {
                trigger: ".hero-cinematic-section",
                start: "top top",
                end: "bottom top",
                scrub: true
            } 
        });
    }
});

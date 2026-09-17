/**
 * كازية عبد الحليم للمحروقات — جبلة
 * نظام إدارة الحالة الحية والتفاعل البرمجي
 */

document.addEventListener('DOMContentLoaded', () => {
    // ------------------------------------------------------------
    // 1. إدارة حالة الوقود الحية (Fuel Availability State)
    // ------------------------------------------------------------
    const defaultState = {
        gasoline: {
            available: true,
            title: 'بنزين ممتاز',
            details: 'مضخات رقمية عالية الدقة'
        },
        diesel: {
            available: true,
            title: 'مازوت ممتاز',
            details: 'تفريغ وتعبئة سريعة للسيارات والشاحنات'
        },
        lastUpdatedMinutes: 12
    };

    // الحالة الرسمية المعتمدة لمحطة عبد الحليم
    let fuelState = defaultState;
    fuelState.gasoline.available = true;
    fuelState.diesel.available = true;
    localStorage.setItem('abdulhalim_fuel_state', JSON.stringify(fuelState));

    const gasolineWidget = document.getElementById('gasoline-widget');
    const dieselWidget = document.getElementById('diesel-widget');
    const gasolineToggle = document.getElementById('gasoline-toggle');
    const dieselToggle = document.getElementById('diesel-toggle');
    const timestampDisplay = document.getElementById('status-timestamp');
    const refreshBtn = document.getElementById('btn-refresh-status');

    function updateUI() {
        // تحديث البنزين
        if (fuelState.gasoline.available) {
            gasolineWidget.classList.add('is-available');
            gasolineWidget.classList.remove('is-unavailable');
            gasolineWidget.querySelector('.fuel-status-badge').innerHTML = '<span class="fuel-status-dot"></span> متوفر للسيارات';
            if (gasolineToggle) gasolineToggle.checked = true;
        } else {
            gasolineWidget.classList.remove('is-available');
            gasolineWidget.classList.add('is-unavailable');
            gasolineWidget.querySelector('.fuel-status-badge').innerHTML = '<span class="fuel-status-dot"></span> غير متوفر حالياً';
            if (gasolineToggle) gasolineToggle.checked = false;
        }

        // تحديث المازوت
        if (fuelState.diesel.available) {
            dieselWidget.classList.add('is-available');
            dieselWidget.classList.remove('is-unavailable');
            dieselWidget.querySelector('.fuel-status-badge').innerHTML = '<span class="fuel-status-dot"></span> متوفر للتعبئة';
            if (dieselToggle) dieselToggle.checked = true;
        } else {
            dieselWidget.classList.remove('is-available');
            dieselWidget.classList.add('is-unavailable');
            dieselWidget.querySelector('.fuel-status-badge').innerHTML = '<span class="fuel-status-dot"></span> نفد مؤقتاً';
            if (dieselToggle) dieselToggle.checked = false;
        }

        // تحديث الطابع الزمني
        timestampDisplay.textContent = `آخر تحديث: منذ ${fuelState.lastUpdatedMinutes} دقيقة`;
        
        // حفظ في الذاكرة المحلية
        localStorage.setItem('abdulhalim_fuel_state', JSON.stringify(fuelState));
    }

    // ربط مفاتيح التبديل إن وُجدت (للاستخدام الإداري المستقبلي)
    if (gasolineToggle) {
        gasolineToggle.addEventListener('change', (e) => {
            fuelState.gasoline.available = e.target.checked;
            fuelState.lastUpdatedMinutes = 1;
            updateUI();
        });
    }

    if (dieselToggle) {
        dieselToggle.addEventListener('change', (e) => {
            fuelState.diesel.available = e.target.checked;
            fuelState.lastUpdatedMinutes = 1;
            updateUI();
        });
    }

    // زر التحديث اليدوي
    refreshBtn.addEventListener('click', () => {
        const icon = refreshBtn.querySelector('svg');
        icon.classList.add('spinning');
        setTimeout(() => {
            icon.classList.remove('spinning');
            fuelState.lastUpdatedMinutes = Math.floor(Math.random() * 5) + 1;
            updateUI();
        }, 600);
    });

    // تشغيل التحديث الأولي
    updateUI();

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
});

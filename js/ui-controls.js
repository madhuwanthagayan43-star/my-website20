window.currentSheetState = 'hidden';
let startY = 0;
let currentY = 0;

window.setBottomSheetState = (state) => {
    window.currentSheetState = state;
    const sheet = document.getElementById('bottomSheet');
    const icon = document.getElementById('sheetToggleIcon');
    
    // Bottom sheet එක normal හෝ full තත්ත්වයට පත්වන විට open වී ඇති Popup එක close කිරීම
    if ((state === 'normal' || state === 'full') && window.map) {
        window.map.closePopup();
    }
    
    if (state === 'hidden') {
        sheet.classList.add('sheet-hidden');
        sheet.classList.remove('sheet-normal', 'sheet-full');
        // Hidden තත්ත්වයේදී උඩට ඊතලය
        if (icon) icon.className = 'fa-solid fa-chevron-up text-xs';
    } else if (state === 'normal') {
        sheet.classList.remove('sheet-hidden', 'sheet-full');
        sheet.classList.add('sheet-normal');
        // Normal තත්ත්වයේදී පහළට ඊතලය
        if (icon) icon.className = 'fa-solid fa-chevron-down text-xs';
    } else if (state === 'full') {
        sheet.classList.remove('sheet-hidden', 'sheet-normal');
        sheet.classList.add('sheet-full');
        // Full-screen තත්ත්වයේදී කතිරය (Close icon)
        if (icon) icon.className = 'fa-solid fa-xmark text-lg';
    }
    
    if (typeof window.updateMapPadding === 'function') {
        window.updateMapPadding();
    }
};



window.cycleBottomSheetState = () => {
    if (window.currentSheetState === 'normal') {
        // Normal තත්ත්වයේදී එබූ විට Hidden වේ
        window.setBottomSheetState('hidden');
    } else if (window.currentSheetState === 'hidden') {
        // Hidden තත්ත්වයේදී එබූ විට Normal වේ
        window.setBottomSheetState('normal');
    } else if (window.currentSheetState === 'full') {
        // Full-screen තත්ත්වයේදී එබූ විට Hidden වේ
        window.setBottomSheetState('hidden');
    }
};


window.setSheetState = (state) => window.setBottomSheetState(state);

window.initSwipeGestures = () => {
    const dragHandle = document.getElementById('dragHandle');
    let touchStartTime = 0;

    dragHandle.addEventListener('touchstart', (e) => { 
        startY = e.touches[0].clientY; 
        touchStartTime = Date.now();
    }, { passive: true });

    dragHandle.addEventListener('touchmove', (e) => { 
        currentY = e.touches[0].clientY; 
    }, { passive: true });

    dragHandle.addEventListener('touchend', () => {
        const diff = startY - currentY;
        const duration = Date.now() - touchStartTime;

        if (currentY !== 0 && Math.abs(diff) > 40 && duration > 50) {
            if (diff > 0) {
                if (window.currentSheetState === 'hidden') window.setBottomSheetState('normal');
                else if (window.currentSheetState === 'normal') window.setBottomSheetState('full'); // 'fullscreen' නෙවෙයි 'full'
            } else {
                if (window.currentSheetState === 'full') window.setBottomSheetState('normal'); // 'fullscreen' නෙවෙයි 'full'
                else if (window.currentSheetState === 'normal') window.setBottomSheetState('hidden');
            }
        }
        startY = 0; currentY = 0; touchStartTime = 0;
    });
};



window.checkUserLogin = () => {
    if (!window.currentUserName) document.getElementById('nameModal').classList.remove('hidden');
    else { document.getElementById('nameModal').classList.add('hidden'); window.updateUserDisplay(); }
};

window.saveUserName = (e) => {
    e.preventDefault();
    const val = document.getElementById('userNameInput').value.trim();
    if (!val) return;
    window.currentUserName = val;
    localStorage.setItem('elephantWatchUserName', window.currentUserName);
    
    // 1. දැනටමත් userId එකක් localStorage එකේ තිබේදැයි පරීක්ෂා කිරීම
    let uniqueUserId = localStorage.getItem('elephantWatchUserId');
    // 2. userId එකක් නොමැති නම් අලුතින් එකක් ජනනය කර සේව් කිරීම
    if (!uniqueUserId) {
        uniqueUserId = crypto.randomUUID();
        localStorage.setItem('elephantWatchUserId', uniqueUserId);
    }
    //alert("User ID: " + uniqueUserId);

    document.getElementById('nameModal').classList.add('hidden');
    window.updateUserDisplay();
    window.showToast(`ආයුබෝවන් ${window.currentUserName}!`);
};

window.openNameChangeModal = () => {
    document.getElementById('userNameInput').value = window.currentUserName;
    document.getElementById('nameModal').classList.remove('hidden');
};

window.updateUserDisplay = () => {
    const displayEl = document.getElementById('displayUserName');
    if (displayEl) displayEl.innerText = window.currentUserName || 'නම එක්කරන්න';
};

window.openLightbox = (src) => {
    if (!src) return;
    document.getElementById('lightboxImage').src = src;
    document.getElementById('lightboxModal').classList.remove('hidden');
};

window.closeLightbox = () => {
    document.getElementById('lightboxModal').classList.add('hidden');
    document.getElementById('lightboxImage').src = '';
};

window.toggleModalFullscreen = () => {
    const container = document.getElementById('reportModalContainer');
    const icon = document.getElementById('fullscreenIcon');
    const header = document.getElementById('mainHeader');

    if (container.classList.contains('max-h-[calc(100dvh-20px)]')) {
        container.classList.remove('max-h-[calc(100dvh-20px)]', 'max-w-lg', 'rounded-t-[32px]', 'sm:rounded-[32px]');
        container.classList.add('h-full', 'w-full', 'max-w-none', 'rounded-none');
        icon.classList.replace('fa-expand', 'fa-compress');
        header.classList.add('header-hidden');
    } else {
        container.classList.add('max-h-[calc(100dvh-20px)]', 'max-w-lg', 'rounded-t-[32px]', 'sm:rounded-[32px]');
        container.classList.remove('h-full', 'w-full', 'max-w-none', 'rounded-none');
        icon.classList.replace('fa-compress', 'fa-expand');
    }
};

window.handleModalClick = (e) => {
    const container = document.getElementById('reportModalContainer');
    if (container.classList.contains('max-h-[calc(100dvh-20px)]')) window.toggleModalFullscreen();
};

window.openImageSourceModal = () => { document.getElementById('imageSourceModal').classList.remove('hidden'); };
window.openCamera = () => { window.closeModal('imageSourceModal'); document.getElementById('cameraInput').click(); };
window.openGallery = () => { window.closeModal('imageSourceModal'); document.getElementById('galleryInput').click(); };

window.closeModal = (id) => {
    document.getElementById(id).classList.add('hidden');
    if (id === 'reportModal') {
        document.getElementById('mainHeader').classList.remove('header-hidden');
        if (window.tempMarker) { window.map.removeLayer(window.tempMarker); window.tempMarker = null; }
    }
};

window.showToast = (msg, type = 'success') => {
    const toast = document.createElement('div');
    const style = type === 'success' ? 'bg-gray-900 text-white border-green-500' : 'bg-red-600 text-white border-white';
    const icon = type === 'success' ? 'fa-circle-check text-green-400' : 'fa-triangle-exclamation text-white';
    
    toast.className = `${style} px-5 py-3 rounded-2xl shadow-2xl text-sm font-bold transform transition-all duration-300 -translate-y-10 opacity-0 flex items-center gap-3 border-l-4 pointer-events-auto`;
    toast.innerHTML = `<i class="fa-solid ${icon} text-xl"></i> <span>${msg}</span>`;
    
    document.getElementById('toastArea').appendChild(toast);
    requestAnimationFrame(() => toast.classList.remove('-translate-y-10', 'opacity-0'));
    setTimeout(() => {
        toast.classList.add('-translate-y-10', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
};

window.playAlertSiren = () => {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sawtooth';
        const now = ctx.currentTime;
        osc.frequency.setValueAtTime(700, now);
        osc.frequency.linearRampToValueAtTime(1100, now + 0.4);
        osc.frequency.linearRampToValueAtTime(700, now + 0.8);
        osc.frequency.linearRampToValueAtTime(1100, now + 1.2);
        osc.frequency.linearRampToValueAtTime(700, now + 1.6);
        
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.5, now + 0.1);
        gain.gain.linearRampToValueAtTime(0.5, now + 1.8);
        gain.gain.linearRampToValueAtTime(0, now + 2.0);
        
        osc.start(now); osc.stop(now + 2.0);
    } catch (e) { console.log("Audio error:", e); }
};

window.triggerVisualAlert = (data) => {
    const banner = document.getElementById('alertBanner');
    document.getElementById('alertMessage').innerText = `${data.location} හි අලි ${data.count}ක් දැක ඇත! (${data.userName || 'අනනාමික'})`;
    banner.classList.remove('hidden');
    setTimeout(() => banner.classList.remove('-translate-y-4', 'opacity-0'), 10);
    setTimeout(window.hideAlert, 15000);
};

window.hideAlert = () => {
    const banner = document.getElementById('alertBanner');
    banner.classList.add('-translate-y-4', 'opacity-0');
    setTimeout(() => banner.classList.add('hidden'), 500);
};


document.addEventListener('DOMContentLoaded', () => {
    // Swipe gestures සක්‍රීය කිරීම
    //window.initSwipeGestures();

    const toggleBtn = document.getElementById('sheetToggleIcon');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            window.cycleBottomSheetState();
        });
    }
});


// Floating Red Button එක Screen එක පුරා Drag කිරීමට හැකි කිරීම
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('btnReportCurrent');
    if (!btn) return;

    let isDragging = false;
    let startX = 0, startY = 0;
    let initialLeft = 0, initialTop = 0;

    // Mobile Touch Events
    btn.addEventListener('touchstart', (e) => {
        isDragging = false;
        const touch = e.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
        
        const rect = btn.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;
    }, { passive: true });

    btn.addEventListener('touchmove', (e) => {
        const touch = e.touches[0];
        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;

        // පරිශීලකයා Miter 5කට වඩා ඇද්දොත් Drag වීමක් ලෙස සලකයි
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
            isDragging = true;
            btn.style.position = 'fixed';
            btn.style.left = `${initialLeft + dx}px`;
            btn.style.top = `${initialTop + dy}px`;
            btn.style.bottom = 'auto';
            btn.style.right = 'auto';
        }
    }, { passive: true });

    // Drag කිරීමේදී Click Event එක පත්තුවීම වැළැක්වීම
    btn.addEventListener('click', (e) => {
        if (isDragging) {
            e.stopImmediatePropagation();
            e.preventDefault();
            isDragging = false;
        }
    }, true);
});

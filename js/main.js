tailwind.config = {
    theme: {
        extend: {
            fontFamily: { sans: ['"Noto Sans Sinhala"', 'sans-serif'] },
            colors: { brand: { 500: '#22c55e', 600: '#16a34a', 700: '#15803d' } }
        }
    }
};

window.currentUser = { uid: "web-user" };
window.currentUserName = localStorage.getItem('elephantWatchUserName') || '';
window.reportsData = [];
window.targetDeleteId = null;
window.activeFullscreenReportId = null;
//window.EXPIRE_TIME_MS = 30 * 60 * 1000;
window.EXPIRE_TIME_MS = 2 * 24 * 60 * 60 * 1000;


window.addEventListener('DOMContentLoaded', () => {
    window.checkUserLogin();
    window.initializeMap();
    window.connectFirebase();
    window.initSwipeGestures();
    
    // වෙබ් අඩවිය ලෝඩ් වන විට Bottom Sheet එක Hidden කිරීම
    window.setBottomSheetState('hidden');
});


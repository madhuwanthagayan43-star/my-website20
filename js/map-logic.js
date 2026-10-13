window.map = null;
window.userMarker = null;
window.tempMarker = null;
window.mapMarkers = {};

let activeProximityReportId = null;
let sirenPlayCount = 0;          // දැනට සවුන්ඩ් එක ප්ලේ වී ඇති වාර ගණන
const MAX_SIREN_PLAYS = 5;       // ඔබට අවශ්‍ය නම් මෙහි වාර ගණන වෙනස් කරගත හැක
let hasAutoOpenedSheet = false; 

window.initializeMap = () => {
 
    window.map = L.map('map', { zoomControl: false }).setView([7.8731, 80.7718], 7);
    L.control.zoom({ position: 'bottomright' }).addTo(window.map);

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19, attribution: 'Esri'
    }).addTo(window.map);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd', maxZoom: 19, pane: 'shadowPane'
    }).addTo(window.map);

    // සිතියම Zoom In හෝ Zoom Out කරන විට විවෘතව ඇති Popup එක වැසීම සඳහා
    window.map.on('zoomstart', () => {
        if (window.map) {
            window.map.closePopup();
        }
    });

    window.map.on('click', (e) => {
        if (window.tempMarker) window.map.removeLayer(window.tempMarker);
        const icon = L.divIcon({
            className: '', 
            html: `<div class="temp-marker" style="background:#22c55e; color:white; width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 10px rgba(0,0,0,0.4); border:3px solid white;"><i class="fa-solid fa-elephant text-xl"></i></div>`,
            iconSize: [30, 30], 
            iconAnchor: [15, 15]
        });
        window.tempMarker = L.marker(e.latlng, { icon, zIndexOffset: 2000 }).addTo(window.map);
        window.map.flyTo(e.latlng, 15, { duration: 0.5 });
        setTimeout(() => window.openReportModal(null, e.latlng.lat, e.latlng.lng), 400);
    });

    window.map.on('popupopen', () => window.setBottomSheetState('hidden'));

    if ("geolocation" in navigator) {
        navigator.geolocation.watchPosition(
            pos => {
                const { latitude, longitude } = pos.coords;
                const newLatLng = [latitude, longitude];
                
                // තමන්ගේ බ්‍රව්සරයට පමණක් අදාළව userMarker එක සකස් කිරීම
                if (!window.userMarker) {
                     const userIcon = L.divIcon({
                        className: '',
                        html: `<img src="img/blue-anim.gif" style="width: 70px; height: 70px;">`,
                        iconSize: [70, 70],
                        iconAnchor: [35, 70]
                    });
                    window.userMarker = L.marker(newLatLng, { icon: userIcon, zIndexOffset: 1000 }).addTo(window.map);
                } else {
                    // එකවර පැනීම වෙනුවට Smooth ව ගමන් කිරීමට මෙය යොදන්න
                    transitionMarkerSmoothly(window.userMarker, { lat: latitude, lng: longitude }, 800);
                }
    
                const statusDot = document.querySelector('.live-status-dot');
                if (statusDot) {
                    statusDot.classList.remove('bg-red-500', 'bg-amber-500');
                    statusDot.classList.add('bg-green-500');
                }
    
                // තමන්ගේ වත්මන් ස්ථානය පදනම් කරගෙන පමණක් දත්ත පෙළගැස්වීම සහ UI යාවත්කාලීන කිරීම
                if (window.reportsData && window.reportsData.length > 0) {
                    const userLoc = { lat: latitude, lng: longitude };
                    window.reportsData = window.sortReports(window.reportsData, userLoc);
                    window.refreshDataUI();

                    const closestReport = window.reportsData[0]; 
                    const distKm = calculateDistance(latitude, longitude, closestReport.lat, closestReport.lng);
                    const distMeters = distKm * 1000;
                    const THRESHOLD_METERS = 500; 
            
                    if (distMeters <= THRESHOLD_METERS) {
                        if (activeProximityReportId !== closestReport.id) {
                            activeProximityReportId = closestReport.id;
                            sirenPlayCount = 0; 
            
                            if (!hasAutoOpenedSheet) {
                                window.setBottomSheetState('normal');
                                hasAutoOpenedSheet = true; 
                            }
            
                            if (typeof window.playAlertSiren === 'function' && sirenPlayCount < MAX_SIREN_PLAYS) {
                                window.playAlertSiren();
                                sirenPlayCount++;
                            }
            
                            if (window.activeSirenInterval) {
                                clearInterval(window.activeSirenInterval);
                            }
                            window.activeSirenInterval = setInterval(() => {
                                if (sirenPlayCount < MAX_SIREN_PLAYS) {
                                    if (typeof window.playAlertSiren === 'function') {
                                        window.playAlertSiren();
                                    }
                                    sirenPlayCount++;
                                } else {
                                    clearInterval(window.activeSirenInterval);
                                    window.activeSirenInterval = null;
                                }
                            }, 2500); 
            
                            if (typeof window.triggerVisualAlert === 'function') {
                                window.triggerVisualAlert(closestReport);
                            }
                        }
                    } else {
                        if (activeProximityReportId) {
                            activeProximityReportId = null;
                            sirenPlayCount = 0;
                            if (window.activeSirenInterval) {
                                clearInterval(window.activeSirenInterval);
                                window.activeSirenInterval = null;
                            }
                            if (typeof window.hideAlert === 'function') {
                                window.hideAlert();
                            }
                        }
                    }
                }
            },
            err => {
                console.warn("Location error:", err);
                const statusDot = document.querySelector('.live-status-dot');
                if (statusDot) {
                    statusDot.classList.remove('bg-green-500', 'bg-amber-500');
                    statusDot.classList.add('bg-red-500');
                }
            },
            { 
                enableHighAccuracy: true, 
                maximumAge: 1000, 
                timeout: 5000         
            }
        );
    }
    
    document.getElementById('btnCenterMap').addEventListener('click', () => {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                pos => {
                    const { latitude, longitude } = pos.coords;
                    const newLatLng = [latitude, longitude];

                    if (!window.userMarker) {
                        const userIcon = L.divIcon({
                            className: '',
                            html: `<img src="img/blue-anim.gif" style="width: 70px; height: 70px;">`,
                            iconSize: [70, 70],
                            iconAnchor: [35, 70]
                        });
                        window.userMarker = L.marker(newLatLng, { icon: userIcon, zIndexOffset: 1000 }).addTo(window.map);
                    } else {
                        transitionMarkerSmoothly(window.userMarker, { lat: latitude, lng: longitude }, 800);
                    }
                    window.map.flyTo(newLatLng, 16);
    
                    const statusDot = document.querySelector('.live-status-dot');
                    if (statusDot) {
                        statusDot.classList.remove('bg-red-500', 'bg-amber-500');
                        statusDot.classList.add('bg-green-500');
                    }
    
                    if (window.reportsData && window.reportsData.length > 0) {
                        const userLoc = { lat: latitude, lng: longitude };
                        window.reportsData = window.sortReports(window.reportsData, userLoc);
                        window.refreshDataUI();
                    }
                },
                err => {
                    window.showToast("Location Permission ලබා දී GPS On කරන්න.", "error");
                },
                { 
                    enableHighAccuracy: true, 
                    maximumAge: 1000, 
                    timeout: 5000 
                }
            );
        } else {
            window.showToast("ඔබගේ උපාංගය Geolocation සහය නොදක්වයි.", "error");
        }
    });


    document.getElementById('btnReportCurrent').addEventListener('click', () => {
        if (window.userMarker) {
            const pos = window.userMarker.getLatLng();
            window.openReportModal(null, pos.lat, pos.lng);
        } else {
            window.showToast("පළමුව සිතියමේ ස්ථානයක් Click කරන්න.", "error");
        }
    });
};

window.flyAndOpen = (id, lat, lng) => {
    window.map.flyTo([lat, lng], 17, { duration: 1 });
    setTimeout(() => { if (window.mapMarkers[id]) window.mapMarkers[id].openPopup(); }, 1100);
};


// ලොකේෂන් ලක්ෂ්‍ය දෙකක් අතර Smooth ව Marker එක ගෙනයාම සඳහා Animation ශ්‍රිතය
function transitionMarkerSmoothly(marker, targetLatLng, duration = 1000) {
    if (!marker) return;
    const startLatLng = marker.getLatLng();
    const startTime = performance.now();

    function animate(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Linear Interpolation මඟින් අදාළ අතරමැදි අක්ෂාංශ සහ දේශාංශ ගණනය කිරීම
        const currentLat = startLatLng.lat + (targetLatLng.lat - startLatLng.lat) * progress;
        const currentLng = startLatLng.lng + (targetLatLng.lng - startLatLng.lng) * progress;

        marker.setLatLng([currentLat, currentLng]);

        if (progress < 1) {
            requestAnimationFrame(animate);
        }
    }
    requestAnimationFrame(animate);
}

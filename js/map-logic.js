window.map = null;
window.userMarker = null;
window.tempMarker = null;
window.mapMarkers = {};

let activeProximityReportId = null;
let sirenPlayCount = 0;          // දැනට සවුන්ඩ් එක ප්ලේ වී ඇති වාර ගණන
const MAX_SIREN_PLAYS = 5;       // ඔබට අවශ්‍ය නම් මෙහි වාර ගණන වෙනස් කරගත හැක (උදා: 3 වතාවක්)
let hasAutoOpenedSheet = false; // 

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

    // map-logic.js තුළ geolocation watchPosition කොටස මෙලෙස සකසන්න:

    if ("geolocation" in navigator) {
        navigator.geolocation.watchPosition(
            pos => {
                const { latitude, longitude } = pos.coords;
                if (!window.userMarker) {
                     const userIcon = L.divIcon({
                        className: '',
                        html: `<img src="img/blue-anim.gif" style="width: 70px; height: 70px;">`,
                        iconSize: [70, 70],
                        iconAnchor: [35, 70]
                    });
                    window.userMarker = L.marker([latitude, longitude], { icon: userIcon, zIndexOffset: 1000 }).addTo(window.map);
                    //window.map.setView([latitude, longitude], 15);
                } else {
                    window.userMarker.setLatLng([latitude, longitude]);
                }
    
                const statusDot = document.querySelector('.live-status-dot');
                if (statusDot) {
                    statusDot.classList.remove('bg-red-500', 'bg-amber-500');
                    statusDot.classList.add('bg-green-500');
                }
    
                // Proximity සහ ඇලට් පරීක්ෂාව
                if (window.reportsData && window.reportsData.length > 0) {
                    const closestReport = window.reportsData[0]; 
                    const distKm = calculateDistance(latitude, longitude, closestReport.lat, closestReport.lng);
                    const distMeters = distKm * 1000;
                    const THRESHOLD_METERS = 500; 
            
                    if (distMeters <= THRESHOLD_METERS) {
                        if (activeProximityReportId !== closestReport.id) {
                            activeProximityReportId = closestReport.id;
                            sirenPlayCount = 0; // නව ප්‍රොක්සිමිටි පොයින්ට් එකක් සඳහා කවුන්ට් එක බිංදු වේ
            
                                // වෙබ් පිටුව පළමුවරට ලෝඩ් වී ඇති අවස්ථාවක, ප්‍රොක්සිමිටි ඇලට් එකක් ලැබුණු විට පමණක් Bottom Sheet එක Normal කිරීම
                            if (!hasAutoOpenedSheet) {
                                window.setBottomSheetState('normal');
                                hasAutoOpenedSheet = true; // මින්පසු නැවත ස්වයංක්‍රීයව විවෘත වීම වැළැක්වේ
                            }
            
                            // 1. පළමු වරට සවුන්ඩ් එක වාදනය කිරීම
                            if (typeof window.playAlertSiren === 'function' && sirenPlayCount < MAX_SIREN_PLAYS) {
                                window.playAlertSiren();
                                sirenPlayCount++;
                            }
            
                            // 2. නියමිත වාර ගණන (උදා: 3 වතාවක්) පමණක් සවුන්ඩ් එක ප්ලේ වීම පාලනය කිරීම
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
                                    // නියමිත වාර ගණන සම්පූර්ණ වූ පසු ඉන්ටර්වල් එක නැවැත්වීම
                                    clearInterval(window.activeSirenInterval);
                                    window.activeSirenInterval = null;
                                }
                            }, 2500); 
            
                            // 3. අනතුරු ඇඟවීමේ බැනරය පෙන්වීම (පරිශීලකයා මැනුවලි ක්ලෝස් කරන තුරු හෝ සීමාවෙන් පිටවන තුරු පවතී)
                            if (typeof window.triggerVisualAlert === 'function') {
                                window.triggerVisualAlert(closestReport);
                            }
                        }
                    } else {
                        // සීමාවෙන් පිටතට ගිය විට
                        if (activeProximityReportId) {
                            activeProximityReportId = null;
                            sirenPlayCount = 0;
                            
                            // ශබ්දය වහාම නැවැත්වීම
                            if (window.activeSirenInterval) {
                                clearInterval(window.activeSirenInterval);
                                window.activeSirenInterval = null;
                            }
            
                            // ස්වයංක්‍රීයව බැනරය ඉවත් කිරීම
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
            { enableHighAccuracy: true }
        );
    }
    


    document.getElementById('btnCenterMap').addEventListener('click', () => {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                pos => {
                    const { latitude, longitude } = pos.coords;
                    if (!window.userMarker) {
                        const userIcon = L.divIcon({
                            className: '',
                            html: `<img src="img/blue-anim.gif" style="width: 70px; height: 70px;">`,
                            iconSize: [70, 70],
                            iconAnchor: [35, 70]
                        });
                        window.userMarker = L.marker([latitude, longitude], { icon: userIcon, zIndexOffset: 1000 }).addTo(window.map);
                    } else {
                        window.userMarker.setLatLng([latitude, longitude]);
                    }
                    window.map.flyTo([latitude, longitude], 16);
    
                    // ලොකේෂන් ඔන් වූ වහාම සජීවී ඩොට් එක කොළ පාට කිරීම
                    const statusDot = document.querySelector('.live-status-dot');
                    if (statusDot) {
                        statusDot.classList.remove('bg-red-500', 'bg-amber-500');
                        statusDot.classList.add('bg-green-500');
                    }
    
                    // දත්ත යාවත්කාලීන කර දුර ගණනය කිරීම සහ ඇලට් පරීක්ෂාව ක්‍රියාත්මක කිරීම
                    if (window.reportsData && window.reportsData.length > 0) {
                        window.refreshDataUI();
                    }
                },
                err => {
                    window.showToast("Location Permission ලබා දී GPS On කරන්න.", "error");
                },
                { enableHighAccuracy: true }
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

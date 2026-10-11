import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getFirestore, collection, doc, onSnapshot, deleteDoc, query } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCQiW0rOeuWwp3-h4ip37PcsUT-HoIhXg4",
    authDomain: "elipent-4e589.firebaseapp.com",
    projectId: "elipent-4e589",
    storageBucket: "elipent-4e589.firebasestorage.app",
    messagingSenderId: "363464948428",
    appId: "1:363464948428:web:e23f81df54b13003eee069",
    measurementId: "G-8D4RDL6G4F"
};

window.app = null;
window.db = null;

window.connectFirebase = async () => {
    try {
        window.app = initializeApp(firebaseConfig);
        window.db = getFirestore(window.app);

        const reportsRef = collection(window.db, 'reports');
        let isFirstLoad = true;

        onSnapshot(query(reportsRef), (snapshot) => {
            let temp = [];
            const currentTime = Date.now();

            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                const reportId = docSnap.id;

                // කාල සීමාව ඉක්ම ගොස් ඇත්නම් Firebase එකෙන් සම්පූර්ණයෙන්ම මකා දැමීම
                if (data.timestamp && (currentTime - data.timestamp >= window.EXPIRE_TIME_MS)) {
                    deleteDoc(doc(window.db, 'reports', reportId)).catch(err => console.error("Error deleting expired report:", err));
                } else if (!data.timestamp || (currentTime - data.timestamp < window.EXPIRE_TIME_MS)) {
                    temp.push({ id: reportId, ...data });
                }
            });

            const userLoc = window.userMarker ? window.userMarker.getLatLng() : null;
            window.reportsData = window.sortReports(temp, userLoc);

            // මුල් වරට දත්ත ලෝඩ් වන අවස්ථාව සඳහා පමණක් පරීක්ෂාව
            if (isFirstLoad) {
                isFirstLoad = false;
                
                // පරිශීලකයාගේ ලොකේෂන් එක ලබා ගැනීමට උත්සාහ කිරීම
                if ("geolocation" in navigator) {
                    navigator.geolocation.getCurrentPosition(
                        pos => {
                            const { latitude, longitude } = pos.coords;
                            
                            // ළඟම ඇති වාර්තාව පරීක්ෂා කිරීම (මීටර් 500 ඇතුළත)
                            if (window.reportsData.length > 0) {
                                const closestReport = window.reportsData[0];
                                const distKm = calculateDistance(latitude, longitude, closestReport.lat, closestReport.lng);
                                const distMeters = distKm * 1000;
                                const THRESHOLD_METERS = 500;

                                if (distMeters <= THRESHOLD_METERS) {
                                    // මීටර් 500 ඇතුළත නම් පමණක් යූසර් වෙත සූම් වීම
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
                                    window.map.setView([latitude, longitude], 15);
                                }
                            }
                        },
                        err => {
                            console.log("Initial location fetch skipped or denied.");
                        },
                        { enableHighAccuracy: true, timeout: 5000 }
                    );
                }
            }

            window.refreshDataUI();
        }, (error) => window.showToast("දත්ත ලබා ගැනීමේ දෝෂයකි.", "error"));
    } catch (err) { window.showToast("පද්ධති දෝෂයකි.", "error"); }
};

document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
    if (!window.targetDeleteId || !window.db) return;
    try {
        await deleteDoc(doc(window.db, 'reports', window.targetDeleteId));
        window.showToast("වාර්තාව සාර්ථකව මකා දමන ලදී.");
        window.closeModal('deleteModal');
    } catch (err) { window.showToast("මකා දැමීම අසාර්ථකයි.", "error"); }
});

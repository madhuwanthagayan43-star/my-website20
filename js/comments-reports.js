import { doc, updateDoc, collection, addDoc } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

window.formatDateTime12H = (timestamp) => {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const date = d.getDate().toString().padStart(2, '0');
    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${year}/${month}/${date} ${hours.toString().padStart(2, '0')}:${minutes} ${ampm}`;
};

window.getTimeMeta = (timestamp) => {
    const now = Date.now();
    const elapsedMs = Math.max(0, now - timestamp);
    const remainingMs = Math.max(0, window.EXPIRE_TIME_MS - elapsedMs);
    const elapsedMin = Math.floor(elapsedMs / 60000);
    const remainingMin = Math.floor(remainingMs / 60000);
    const remainingSec = Math.floor((remainingMs % 60000) / 1000);
    return {
        isExpired: remainingMs <= 0,
        elapsedMin,
        remainingMin,
        remainingSec,
        countdownFormatted: `${remainingMin}:${remainingSec.toString().padStart(2, '0')}`
    };
};

window.getRiskTheme = (level) => {
    if(level === 'high') return { color: '#ef4444', class: 'bg-red-50 border-red-200 text-red-700', label: 'ඉහළ අවදානම්', icon: 'fa-radiation' };
    if(level === 'medium') return { color: '#f97316', class: 'bg-orange-50 border-orange-200 text-orange-700', label: 'මධ්‍යම අවදානම්', icon: 'fa-circle-exclamation' };
    return { color: '#22c55e', class: 'bg-green-50 border-green-200 text-green-700', label: 'අඩු අවදානම්', icon: 'fa-shield-halved' };
};

function renderEmptyState(msg = "මෑත කාලීන වාර්තා නොමැත.") {
    document.getElementById('reportsListContainer').innerHTML = `
        <div class="flex flex-col items-center justify-center h-full text-gray-400 py-10">
            <i class="fa-solid fa-folder-open text-5xl mb-4 opacity-40"></i>
            <span class="text-sm font-bold text-gray-500">${msg}</span>
        </div>`;
}

function buildCommentsSectionHTML(item, isFullscreen = false) {
    const comments = item.comments || [];
    const sortedComments = [...comments].sort((a, b) => b.timestamp - a.timestamp);
    const inputId = `${isFullscreen ? 'fs' : 'popup'}-comment-input-${item.id}`;
    
    let commentsListHTML = sortedComments.length > 0 ? `
        <div class="space-y-2 max-h-36 overflow-y-auto custom-scroll pr-1 mt-2 border-t border-gray-100 pt-2">
            ${sortedComments.map(c => {
                const isOwner = c.userId === localStorage.getItem('elephantWatchUserId');
                const safeText = (c.text || '').replace(/"/g, '&quot;').replace(/'/g, "\\'");
                
                return `
                    <div class="bg-gray-50 p-2 rounded-xl border border-gray-200 text-xs text-gray-800 space-y-1">
                        <div class="flex items-center justify-between">
                            <span class="font-bold text-green-700 flex items-center gap-1 text-[11px]"><i class="fa-solid fa-user-circle text-gray-400"></i> ${c.userName || 'අනනාමික'}</span>
                            <span class="text-[9px] text-gray-400 font-medium">${window.formatDateTime12H(c.timestamp)}</span>
                        </div>
                        <p class="text-gray-700 leading-snug m-0 text-[11px] font-medium break-words">${safeText}</p>
                        ${isOwner ? `
                        <div class="flex justify-end gap-2 pt-1 border-t border-gray-100 text-[10px]">
                            <button onclick="event.stopPropagation(); editComment('${item.id}', '${c.id}', '${safeText}')" class="text-blue-600 font-bold"><i class="fa-solid fa-pen text-[9px]"></i> වෙනස්</button>
                            <button onclick="event.stopPropagation(); deleteComment('${item.id}', '${c.id}')" class="text-red-500 font-bold"><i class="fa-solid fa-trash text-[9px]"></i> මකන්න</button>
                        </div>` : ''}
                    </div>`;
            }).join('')}
        </div>` : '';

    return `
        <div class="bg-gray-50/90 p-2.5 rounded-xl border border-gray-200 mt-2 space-y-2" onclick="event.stopPropagation()">
            <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-gray-700"><i class="fa-solid fa-comments text-green-600"></i> අදහස් දැක්වීම්</span>
                <span class="text-[10px] font-bold bg-green-100 text-green-800 px-2 py-0.5 rounded-full">${comments.length}</span>
            </div>
            <div class="flex gap-1.5 items-center">
                <input type="text" id="${inputId}" placeholder="අදහසක් එක් කරන්න..." class="flex-1 px-3 py-1.5 rounded-lg border border-gray-300 text-xs bg-white font-medium" onkeydown="if(event.key==='Enter'){ event.stopPropagation(); addComment('${item.id}', '${inputId}'); }" onclick="event.stopPropagation();">
                <button onclick="event.stopPropagation(); addComment('${item.id}', '${inputId}')" class="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold"><i class="fa-solid fa-paper-plane text-[10px]"></i></button>
            </div>
            ${commentsListHTML}
        </div>`;
}

window.addComment = async (reportId, inputId) => {
    if (!window.currentUserName) { window.openNameChangeModal(); window.showToast("කරුණාකර ප්‍රථමයෙන් ඔබගේ නම ඇතුළත් කරන්න.", "error"); return; }
    const inputEl = document.getElementById(inputId);
    if (!inputEl || !inputEl.value.trim()) return;
    const report = window.reportsData.find(r => r.id === reportId);
    if (!report) return;

    const newComment = { 
    id: 'c_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7), 
    text: inputEl.value.trim(), 
    userName: window.currentUserName || 'අනනාමික', 
    userId: localStorage.getItem('elephantWatchUserId'), 
    timestamp: Date.now() 
    };

    try {
        await updateDoc(doc(window.db, 'reports', reportId), { comments: [...(report.comments || []), newComment] });
        inputEl.value = '';
        window.showToast("අදහස සාර්ථකව එක් කෙරිණි!");
    } catch (err) { window.showToast("අදහස එක් කිරීම අසාර්ථකයි.", "error"); }
};

window.editComment = async (reportId, commentId, currentText) => {
    const report = window.reportsData.find(r => r.id === reportId);
    if (!report) return;
    const newText = prompt("ඔබගේ අදහස වෙනස් කරන්න:", currentText);
    if (newText === null || !newText.trim()) return;
    const updatedComments = (report.comments || []).map(c => c.id === commentId ? { ...c, text: newText.trim(), timestamp: Date.now() } : c);
    try {
        await updateDoc(doc(window.db, 'reports', reportId), { comments: updatedComments });
        window.showToast("අදහස වෙනස් කරන ලදී.");
    } catch (err) { window.showToast("වෙනස් කිරීම අසාර්ථකයි.", "error"); }
};

window.deleteComment = async (reportId, commentId) => {
    if (!confirm("මෙම අදහස මකා දැමීමට ඔබට විශ්වාසද?")) return;
    const report = window.reportsData.find(r => r.id === reportId);
    if (!report) return;
    try {
        await updateDoc(doc(window.db, 'reports', reportId), { comments: (report.comments || []).filter(c => c.id !== commentId) });
        window.showToast("අදහස මකා දමන ලදී.");
    } catch (err) { window.showToast("මකා දැමීම අසාර්ථකයි.", "error"); }
};


function renderFullscreenModalContent(item) {
    const fullModalBody = document.getElementById('fullscreen-modal-body');
    if (!fullModalBody) return;
    const theme = window.getRiskTheme(item.risk);
    const dt12H = window.formatDateTime12H(item.timestamp);
    const timeMeta = window.getTimeMeta(item.timestamp);
    const reporterName = item.userName || 'අනනාමික';
    const safeJson = encodeURIComponent(JSON.stringify(item));
    const commentsHtml = buildCommentsSectionHTML(item, true);

    // Location ON ද සහ දුර ගණනය කිරීම
    const userLoc = window.userMarker ? { lat: window.userMarker.getLatLng().lat, lng: window.userMarker.getLatLng().lng } : null;
    const isLocationOn = !!userLoc;
    let distText = '';
    if (isLocationOn) {
        const distKm = calculateDistance(userLoc.lat, userLoc.lng, item.lat, item.lng);
        distText = `${distKm < 1 ? Math.round(distKm * 1000) + 'm' : distKm.toFixed(1) + 'km'}`;
    }

    fullModalBody.innerHTML = `
        <div class="space-y-4 pb-8">
            <div class="flex items-center justify-between gap-1 pb-3 border-b border-gray-100">
                <div class="flex items-center gap-2">
                    <span class="text-sm font-bold px-3 py-1.5 rounded-lg border ${theme.class}"><i class="fa-solid ${theme.icon} mr-1.5"></i>${theme.label}</span>
                    ${isLocationOn ? `<span class="text-xs font-bold text-amber-800 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200"><i class="fa-solid fa-location-arrow mr-1"></i>${distText}</span>` : ''}
                </div>
                <span class="text-sm font-bold text-red-600 bg-red-50 px-3 py-1.5 rounded-full border border-red-100 flex items-center gap-1.5"><i class="fa-solid fa-stopwatch animate-pulse"></i><span id="cd-full-${item.id}">${timeMeta.countdownFormatted}</span></span>
            </div>
            <div class="bg-gray-50/90 p-4 rounded-xl border border-gray-200 space-y-2.5">
                <div class="text-sm text-gray-800 flex items-center justify-between"><span class="text-gray-500 font-medium"><i class="fa-solid fa-user-check text-green-600 mr-1.5"></i> වාර්තාකරු:</span><b class="text-green-800 text-base font-bold">${reporterName}</b></div>
                <div class="text-sm text-gray-700 flex items-center justify-between pt-2 border-t border-gray-200/60"><span class="text-gray-500 font-medium"><i class="fa-regular fa-clock text-blue-600 mr-1.5"></i> දිනය/වේලාව:</span><b class="text-gray-900 font-bold bg-white px-2.5 py-1 rounded-lg border border-gray-200 text-xs whitespace-nowrap">${dt12H}</b></div>
            </div>
            <div class="bg-amber-50/80 rounded-xl p-4 border border-amber-200 space-y-2.5">
                <div><span class="text-xs text-amber-900 font-bold uppercase block mb-1.5"><i class="fa-solid fa-map-pin mr-1.5"></i> ස්ථානයේ විස්තරය</span><p class="text-base font-bold text-gray-900 m-0 leading-tight break-words">${item.location}</p></div>
                <div class="flex justify-between items-center text-sm text-gray-800 pt-2.5 border-t border-amber-200/60 font-medium"><span><span class="mr-1">🐘</span> අලි ගණන:</span> <b class="text-lg font-bold text-amber-900 bg-white px-3 py-0.5 rounded-lg border border-amber-200">${item.count}</b></div>


                ${item.direction ? `<div class="flex justify-between items-start text-sm text-gray-800 pt-2.5 border-t border-amber-200/60 font-medium"><span><i class="fa-solid fa-compass text-amber-700 w-5"></i> දිශාව:</span> <b class="text-base break-words max-w-[60%] text-right">${item.direction}</b></div>` : ''}
                <div class="flex justify-between items-center text-xs text-gray-700 pt-1 border-t border-amber-200/60 font-medium">
                    <span><i class="fa-solid fa-crosshairs text-amber-700 w-4"></i> අක්ෂාංශ / දේශාංශ:</span>
                    <b class="font-mono text-gray-900 bg-white px-2 py-0.5 rounded border border-amber-200 text-xs">${item.lat.toFixed(5)}, ${item.lng.toFixed(5)}</b>
                </div>
            </div>
            ${item.imgData ? `<div class="mt-3 rounded-xl overflow-hidden shadow-sm cursor-pointer" onclick="event.stopPropagation(); openLightbox('${item.imgData}')"><img src="${item.imgData}" class="w-full h-48 sm:h-64 object-cover"></div>` : ''}
            ${commentsHtml}
            <div class="text-xs text-amber-900 bg-amber-100/80 p-3.5 rounded-xl border border-amber-200 text-center font-bold mt-2"><i class="fa-solid fa-clock-rotate-left mr-1.5"></i> මේ නිවේදනය එක්කර <b>${timeMeta.elapsedMin} min</b> ගතවී ඇත. තව <b>${timeMeta.remainingMin} min</b> වලින් සිතියමෙන් මැකී යයි.</div>
            <div class="flex gap-3 pt-3">
                <button onclick="triggerEdit('${safeJson}')" class="flex-1 bg-blue-50 text-blue-600 text-sm py-3.5 rounded-xl font-bold border border-blue-200"><i class="fa-solid fa-pen mr-1.5"></i> වෙනස් කරන්න</button>
                <button onclick="triggerDelete('${item.id}')" class="flex-1 bg-red-50 text-red-600 text-sm py-3.5 rounded-xl font-bold border border-red-200"><i class="fa-solid fa-trash mr-1.5"></i> මකන්න</button>
            </div>
        </div>`;
}


window.openFullscreenModal = (reportId) => {
    window.activeFullscreenReportId = reportId;
    const item = window.reportsData.find(r => r.id === reportId);
    if (!item) return;
    renderFullscreenModalContent(item);
    document.getElementById('fullscreen-modal').classList.add('flex');
    document.getElementById('fullscreen-modal').classList.remove('hidden');
    if (window.map) window.map.closePopup();
};

window.closeFullscreenModal = () => {
    window.activeFullscreenReportId = null;
    document.getElementById('fullscreen-modal').classList.remove('flex');
    document.getElementById('fullscreen-modal').classList.add('hidden');
};

window.refreshDataUI = () => {

    const userLoc = window.userMarker ? { lat: window.userMarker.getLatLng().lat, lng: window.userMarker.getLatLng().lng } : null;
    const isLocationOn = !!userLoc;

    window.reportsData = window.sortReports(window.reportsData, userLoc);
    
    document.getElementById('reportCountBadge').innerText = window.reportsData.length;
    const activeIds = window.reportsData.map(r => r.id);
    Object.keys(window.mapMarkers).forEach(id => {
        if (!activeIds.includes(id)) { window.map.removeLayer(window.mapMarkers[id]); delete window.mapMarkers[id]; }
    });

    if (window.activeFullscreenReportId) {
        const activeReport = window.reportsData.find(r => r.id === window.activeFullscreenReportId);
        if (activeReport) renderFullscreenModalContent(activeReport);
        else window.closeFullscreenModal();
    }

    if (window.reportsData.length === 0) renderEmptyState();
    else {
        let html = '';
        window.reportsData.forEach(item => {
            const theme = window.getRiskTheme(item.risk);
            const dt12H = window.formatDateTime12H(item.timestamp);
            const timeMeta = window.getTimeMeta(item.timestamp);
            const safeJson = encodeURIComponent(JSON.stringify(item));
            const reporterName = item.userName || 'අනනාමික';
            const popupCommentsHtml = buildCommentsSectionHTML(item, false);
            
            // Location ON නම් පමණක් දුර ගණනය කිරීම
            let distText = '';
            if (isLocationOn) {
                const distKm = calculateDistance(userLoc.lat, userLoc.lng, item.lat, item.lng);
                distText = `${distKm < 1 ? Math.round(distKm * 1000) + 'm' : distKm.toFixed(1) + 'km'}`;
            }
            
            // MAP POPUP HTML
            const popupHtml = `
                <div id="popup-inner-box-${item.id}" class="p-1.5 space-y-1">
                    <!-- Leaflet close (X) button එකට ඉඩ තැබීමට mr-6 (margin-right) යොදා ඇත -->
                    <div class="flex items-center justify-between gap-1 pb-2 border-b border-gray-100 mr-6">
                        <div class="flex items-center gap-1">
                            <span class="text-[8px] font-bold px-1 py-0.2 rounded-md border ${theme.class}"><i class="fa-solid ${theme.icon} mr-1"></i>${theme.label}</span>${isLocationOn ? `<span class="text-[9px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-200 ml-2"><i class="fa-solid fa-location-arrow mr-0.5 text-[8px]"></i>${distText}</span>` : ''}
                        </div>
                        <span class="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-100 flex items-center gap-1"><i class="fa-solid fa-stopwatch animate-pulse"></i><span id="cd-popup-${item.id}">${timeMeta.countdownFormatted}</span></span>
                    </div>


                    <div class="bg-gray-50/90 p-1.5 rounded-lg border border-gray-200 space-y-0.5 text-[10px]">
                        <div class="text-xs text-gray-800 flex items-center justify-between"><span class="text-gray-500 font-medium"><i class="fa-solid fa-user-check text-green-600 mr-1"></i> වාර්තාකරු:</span><b class="text-green-800 text-sm font-bold">${reporterName}</b></div>
                        <div class="text-[11px] text-gray-700 flex items-center justify-between pt-1 border-t border-gray-200/60"><span class="text-gray-500 font-medium"><i class="fa-regular fa-clock text-blue-600 mr-1"></i> දිනය/වේලාව:</span><b class="text-gray-900 font-bold bg-white px-1.5 py-0.5 rounded border border-gray-200 text-[10px] whitespace-nowrap">${dt12H}</b></div>
                    </div>
                    <div class="bg-amber-50/80 rounded-lg p-1.5 border border-amber-200 space-y-0.5 text-[10px]">
                        <div><span class="text-[10px] text-amber-900 font-bold uppercase block"><i class="fa-solid fa-map-pin mr-1"></i> ස්ථානයේ විස්තරය</span><p class="text-xs font-bold text-gray-900 m-0 leading-tight mt-0.5 break-words overflow-hidden">${item.location}</p></div>
                        <div class="flex justify-between items-center text-xs text-gray-800 pt-1.5 border-t border-amber-200/60 font-medium"><span><span class="mr-1">🐘</span> අලි ගණන:</span> <b class="text-sm font-bold text-amber-900">${item.count}</b></div>
                        ${item.direction ? `<div class="flex justify-between items-start text-xs text-gray-800 font-medium"><span><i class="fa-solid fa-compass text-amber-700 w-4"></i> දිශාව:</span> <b class="break-words max-w-[60%] text-right">${item.direction}</b></div>` : ''}
                        
                        <!-- Popup Coordinates Row -->
                        <div class="flex justify-between items-center text-[11px] text-gray-700 pt-1 border-t border-amber-200/60 font-medium">
                            <span><i class="fa-solid fa-crosshairs text-amber-700 w-4"></i> ඛණ්ඩාංක:</span>
                            <b class="font-mono text-gray-900 bg-white px-1.5 py-0.5 rounded border border-amber-200 text-[10px]">${item.lat.toFixed(5)}, ${item.lng.toFixed(5)}</b>
                        </div>
                    </div>
                    ${item.imgData ? `<div class="mt-2 rounded-xl overflow-hidden shadow-sm cursor-pointer" onclick="event.stopPropagation(); openLightbox('${item.imgData}')"><img src="${item.imgData}" class="w-full h-16 object-cover rounded-lg"></div>` : ''}
                    ${popupCommentsHtml}
                    <div id="note-popup-${item.id}" class="text-[10px] text-amber-900 bg-amber-100/80 p-2 rounded-xl border border-amber-200 text-center font-bold"><i class="fa-solid fa-clock-rotate-left mr-1"></i> මේ නිවේදනය එක්කර <b>${timeMeta.elapsedMin} min</b> ගතවී ඇත. තව <b>${timeMeta.remainingMin} min</b> වලින් සිතියමෙන් මැකී යයි.</div>
                    <div class="flex gap-2 pt-1">
                        <button onclick="event.stopPropagation(); triggerEdit('${safeJson}')" class="flex-1 bg-blue-50 text-blue-600 text-[10px] py-1 rounded-md font-bold">><i class="fa-solid fa-pen mr-1"></i> වෙනස්</button>
                        <button onclick="event.stopPropagation(); triggerDelete('${item.id}')" class="flex-1 bg-red-50 text-red-600 text-xs py-2 rounded-xl font-bold"><i class="fa-solid fa-trash mr-1"></i> මකන්න</button>
                    </div>
                </div>`;


            if (window.mapMarkers[item.id]) {
                window.mapMarkers[item.id].setLatLng([item.lat, item.lng]);
                window.mapMarkers[item.id].getPopup().setContent(popupHtml);
                if (window.mapMarkers[item.id].isPopupOpen()) window.mapMarkers[item.id].fire('popupopen');
            } else {
                const markerHtml = `
                    <div class="relative flex items-center justify-center w-12 h-12">
                        <img src="img/red-anim.gif" style="width: 120px; height: 120px;" alt="Elephant GIF">
                    </div>`;
                    
                const customIcon = L.divIcon({ className:'', html: markerHtml, iconSize: [120,120], iconAnchor: [60,60], popupAnchor: [0, -20] });
                const newMarker = L.marker([item.lat, item.lng], {icon: customIcon}).addTo(window.map).bindPopup(popupHtml, { autoPan: false, closeOnClick: false, autoClose: false });

                newMarker.on('popupopen', function() {
                    const innerBox = document.getElementById(`popup-inner-box-${item.id}`);
                    if (!innerBox) return;
                    
                    const commentBox = innerBox.querySelector('.custom-scroll');
                    if (commentBox) {
                        commentBox.addEventListener('touchstart', function(e) { e.stopPropagation(); }, { passive: true });
                        commentBox.addEventListener('touchmove', function(e) { e.stopPropagation(); }, { passive: true });
                    }

                    let startX = 0, startY = 0, isDragging = false, touchStartTime = 0;
                    innerBox.addEventListener('touchstart', function(event) { startX = event.touches[0].clientX; startY = event.touches[0].clientY; isDragging = false; touchStartTime = Date.now(); }, { passive: true });
                    innerBox.addEventListener('touchmove', function(event) { if (Math.abs(event.touches[0].clientX - startX) > 5 || Math.abs(event.touches[0].clientY - startY) > 5) { isDragging = true; window.map.dragging._draggable._onDown(event); } }, { passive: true });
                    innerBox.addEventListener('touchend', function(event) {
                        if (Date.now() - touchStartTime < 300 && !isDragging && !['INPUT', 'TEXTAREA', 'BUTTON'].includes(event.target.tagName) && !event.target.closest('button') && !event.target.closest('img')) {
                            window.openFullscreenModal(item.id);
                        }
                    });
                });
                window.mapMarkers[item.id] = newMarker;
            }

            const imgElement = item.imgData 
                ? `<img src="${item.imgData}" class="w-16 h-16 rounded-xl object-cover shadow-sm cursor-pointer" onclick="event.stopPropagation(); openLightbox('${item.imgData}')">` 
                : `<div class="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center border border-gray-200"><i class="fa-solid fa-image text-gray-300 text-xl"></i></div>`;
            
            // Thumbnail සහ පහළින් centered දුර ප්‍රමාණයේ badge එක
            const thumbContainer = `
                <div class="flex flex-col items-center w-16">
                    ${imgElement}
                    ${isLocationOn ? `<span class="mt-2 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 w-full text-center truncate"><i class="fa-solid fa-location-arrow mr-0.5 text-[9px]"></i>${distText}</span>` : ''}
                </div>`;

            const cCount = (item.comments || []).length;

            // RECENT REPORTS LIST ITEM (අක්ෂාංශ, දේශාංශ Risk Badge එකට පහළින් පිහිටන සේ)
            html += `
            <div class="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm flex items-center gap-2.5 relative cursor-pointer" onclick="flyAndOpen('${item.id}', ${item.lat}, ${item.lng})">
                <div class="absolute left-0 top-3 bottom-3 w-1.5 rounded-r-full" style="background-color:${theme.color}"></div>
                <div class="pl-2 shrink-0">${thumbContainer}</div>
                <div class="flex-1 min-w-0 py-0.5">
                    <!-- Top Row: Risk Badge, Elapsed Time & Coordinates -->
                    <div class="flex items-center justify-between gap-1 mb-1">
                        <div class="flex flex-col gap-1">
                            <span class="text-[10px] font-bold px-2 py-0.5 rounded-md border w-max ${theme.class}"><i class="fa-solid ${theme.icon} mr-1"></i>${theme.label}</span>
                            <span class="text-[9px] font-mono font-bold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 w-max">
                                <i class="fa-solid fa-crosshairs text-gray-400 mr-0.5"></i>${item.lat.toFixed(4)}, ${item.lng.toFixed(4)}
                            </span>
                        </div>
                        <span class="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 self-start"><i class="fa-solid fa-clock-rotate-left mr-0.5"></i><span id="cd-list-${item.id}">${timeMeta.elapsedMin}m පෙර</span></span>
                    </div>
            
                    <h4 class="font-bold text-gray-800 text-sm leading-tight mt-1 break-words">${item.location}</h4>
                    <div class="text-[11px] font-bold text-blue-700 mt-1"><i class="fa-regular fa-clock mr-1"></i> ${dt12H}</div>
            
                    <!-- Bottom Row -->
                    <div class="flex items-center justify-between mt-1 text-[11px] text-gray-500 font-bold pr-1">
                        <div class="flex items-center gap-3">
                            <span><span class="mr-1">🐘</span>${item.count}</span>
                            <span class="text-green-700 truncate max-w-[60px]"><i class="fa-solid fa-user text-gray-400 mr-1"></i> ${reporterName}</span>
                            ${cCount > 0 ? `<span class="text-blue-600"><i class="fa-solid fa-comments text-gray-400 mr-1"></i> ${cCount}</span>` : ''}
                        </div>
                    </div>
                </div>
                <div class="flex flex-col gap-2 shrink-0 self-start pt-0.5">
                    <button onclick="event.stopPropagation(); triggerEdit('${safeJson}')" class="w-8 h-8 rounded-full bg-gray-50 text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition border border-gray-100 flex items-center justify-center"><i class="fa-solid fa-pen text-xs"></i></button>
                    <button onclick="event.stopPropagation(); triggerDelete('${item.id}')" class="w-8 h-8 rounded-full bg-gray-50 text-gray-500 hover:text-red-600 hover:bg-red-50 transition border border-gray-100 flex items-center justify-center"><i class="fa-solid fa-trash text-xs"></i></button>
                </div>
            </div>`;

        });
        document.getElementById('reportsListContainer').innerHTML = html;
    }
    
    // Auto-scroll
    const currentTopReport = window.reportsData[0];
    const currentTopId = currentTopReport ? currentTopReport.id : null;
    if (isLocationOn && currentTopId && currentTopId !== window.previousTopReportId) {
        const container = document.getElementById('reportsListContainer');
        if (container) {
            container.scrollTop = 0;
        }
    }
    window.previousTopReportId = currentTopId;
};




window.openReportModal = (dataStr = null, lat = null, lng = null) => {
    if (!window.currentUserName) { window.openNameChangeModal(); window.showToast("කරුණාකර ප්‍රථමයෙන් ඔබගේ නම ඇතුළත් කරන්න.", "error"); return; }
    window.setBottomSheetState('hidden');
    document.getElementById('mainHeader').classList.add('header-hidden');
    const form = document.getElementById('elephantForm');
    form.reset(); window.removeImage();
    document.getElementById('modalDateTime').innerText = window.formatDateTime12H(Date.now());
    const container = document.getElementById('reportModalContainer');
    const icon = document.getElementById('fullscreenIcon');
    container.classList.add('max-h-[calc(100dvh-20px)]', 'max-w-lg', 'rounded-t-[32px]', 'sm:rounded-[32px]');
    container.classList.remove('h-full', 'w-full', 'max-w-none', 'rounded-none');
    icon.className = 'fa-solid fa-expand text-xs';

    if (dataStr) {
        const data = JSON.parse(decodeURIComponent(dataStr));
        document.getElementById('modalTitle').innerText = "වාර්තාව වෙනස් කරන්න";
        document.getElementById('submitLabel').innerText = "යාවත්කාලීන කරන්න";
        document.getElementById('formId').value = data.id;
        document.getElementById('formLat').value = data.lat;
        document.getElementById('formLng').value = data.lng;
        document.getElementById('formLocation').value = data.location;
        document.getElementById('formCount').value = data.count;
        document.getElementById('formDirection').value = data.direction || '';
        document.querySelector(`input[name="riskLvl"][value="${data.risk}"]`).checked = true;
        if (data.imgData) window.showImagePreview(data.imgData);
    } else {
        document.getElementById('modalTitle').innerText = "නව වාර්තාවක්";
        document.getElementById('submitLabel').innerText = "වාර්තා කරන්න";
        document.getElementById('formId').value = '';
        document.getElementById('formLat').value = lat;
        document.getElementById('formLng').value = lng;
    }
    document.getElementById('reportModal').classList.remove('hidden');
};

window.triggerEdit = (json) => { window.closeFullscreenModal(); window.map.closePopup(); window.openReportModal(json); };
window.triggerDelete = (id) => { window.closeFullscreenModal(); window.map.closePopup(); window.targetDeleteId = id; document.getElementById('deleteModal').classList.remove('hidden'); };

window.processImage = (e) => {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith('image/')) return window.showToast("ඡායාරූපයක් පමණක් තෝරන්න", "error");
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let { width, height } = img;
            if (width > 500) { height = Math.floor(height * (500 / width)); width = 500; }
            canvas.width = width; canvas.height = height;
            canvas.getContext('2d').drawImage(img, 0, 0, width, height);
            window.showImagePreview(canvas.toDataURL('image/jpeg', 0.6));
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
};

window.showImagePreview = (b64) => {
    document.getElementById('formImageBase64').value = b64;
    const imgEl = document.getElementById('imagePreview');
    imgEl.src = b64; imgEl.classList.remove('hidden');
    document.getElementById('uploadPrompt').classList.add('hidden');
    document.getElementById('imageOverlay').classList.remove('hidden');
    document.getElementById('btnRemoveImg').classList.remove('hidden');
};

window.removeImage = () => {
    document.getElementById('cameraInput').value = '';
    document.getElementById('galleryInput').value = '';
    document.getElementById('formImageBase64').value = '';
    document.getElementById('imagePreview').src = '';
    document.getElementById('imagePreview').classList.add('hidden');
    document.getElementById('imageOverlay').classList.add('hidden');
    document.getElementById('uploadPrompt').classList.remove('hidden');
    document.getElementById('btnRemoveImg').classList.add('hidden');
};

document.getElementById('elephantForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!window.db) return;
    const btn = document.getElementById('btnSubmit');
    const origLabel = document.getElementById('submitLabel').innerText;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> සැකසෙමින්...`;
    btn.disabled = true;

    try {
        const id = document.getElementById('formId').value;
        const payload = {
            location: document.getElementById('formLocation').value.trim(),
            count: parseInt(document.getElementById('formCount').value) || 1,
            direction: document.getElementById('formDirection').value.trim(),
            risk: document.querySelector('input[name="riskLvl"]:checked').value,
            lat: parseFloat(document.getElementById('formLat').value),
            lng: parseFloat(document.getElementById('formLng').value),
            imgData: document.getElementById('formImageBase64').value,
            userId: window.currentUser.uid,
            userName: window.currentUserName || 'අනනාමික',
            timestamp: Date.now() 
        };

        const collRef = collection(window.db, 'reports');
        if (id) {
            await updateDoc(doc(collRef, id), payload);
            window.showToast("වාර්තාව සාර්ථකව වෙනස් කරන ලදී.");
        } else {
            payload.comments = [];
            await addDoc(collRef, payload);
            window.showToast("අනතුරු ඇඟවීම සාර්ථකව පද්ධතියට එක් කළා.");
        }
        window.closeModal('reportModal');
    } catch (err) { window.showToast("සුරැකීමේදී දෝෂයක් ඇතිවිය.", "error"); }
    finally { 
        btn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> <span id="submitLabel">${origLabel}</span>`;
        btn.disabled = false; 
    }
});

setInterval(() => {
    if (window.reportsData.length === 0) return;
    const now = Date.now();
    let hasExpiredItems = false;

    window.reportsData.forEach(item => {
        const timeMeta = window.getTimeMeta(item.timestamp);
        if (timeMeta.isExpired) hasExpiredItems = true;
        else {
            const cdEl = document.getElementById(`cd-popup-${item.id}`);
            if (cdEl) cdEl.innerText = timeMeta.countdownFormatted;
            const noteEl = document.getElementById(`note-popup-${item.id}`);
            if (noteEl) noteEl.innerHTML = `<i class="fa-solid fa-rotate-left mr-1"></i> මේ නිවේදනය එක්කර <b>${timeMeta.elapsedMin} min</b> ගතවී ඇත. තව <b>${timeMeta.remainingMin} min</b> වලින් සිතියමෙන් මැකී යයි.`;
            const listCdEl = document.getElementById(`cd-list-${item.id}`);
            if (listCdEl) listCdEl.innerText = `${timeMeta.elapsedMin}m පෙර`;
            const fullCdEl = document.getElementById(`cd-full-${item.id}`);
            if (fullCdEl) fullCdEl.innerText = timeMeta.countdownFormatted;
        }
    });

    if (hasExpiredItems) {
        window.reportsData = window.reportsData.filter(r => (now - r.timestamp) < window.EXPIRE_TIME_MS);
        window.refreshDataUI();
    }
}, 1000);



/**
 * ලොකේෂන් දෙකක් අතර දුර (කිලෝමීටර් වලින්) ගණනය කරන Haversine formula ශ්‍රිතය
 */
window. calculateDistance = function(lat1, lon1, lat2, lon2) {
    const R = 6371; // පෘථිවියේ අරය (km)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // දුර කිලෝමීටර් වලින්
}

/**
 * වාර්තා ලැයිස්තුව Sorting කරන ප්‍රධාන ශ්‍රිතය
 * @param {Array} reports - Firebase මඟින් ලැබෙන වාර්තා ලැයිස්තුව
 * @param {Object|null} userLocation - පරිශීලකයාගේ වත්මන් ස්ථානය { lat, lng } (ලබාගත නොහැකිනම් null)
 */
window.sortReports = function(reports, userLocation) {
    return reports.sort((a, b) => {
        // 1. පරිශීලකයාගේ Location එක සක්‍රියව ඇත්නම් (User location available)
        if (userLocation && userLocation.lat && userLocation.lng) {
            const distA = calculateDistance(
                userLocation.lat, userLocation.lng,
                a.lat, a.lng
            );
            const distB = calculateDistance(
                userLocation.lat, userLocation.lng,
                b.lat, b.lng
            );

            // දුරවල් දෙක එකිනෙකට වෙනස් නම්, ළඟම තියෙන එක පළමුවෙන්ම තබයි
            if (Math.abs(distA - distB) > 0.01) { // මීටර් 10ක කුඩා වෙනසක් සලකා බලයි
                return distA - distB;
            }
        }

        // 2. දුර සමාන නම් හෝ Location එක Off/නැති නම්: කාලය (Recency) අනුව Sorting කරයි
        // අලුත්ම වාර්තාව (Shortest time elapsed) උඩින්ම තබයි
        const timeA = new Date(a.timestamp || a.createdAt).getTime();
        const timeB = new Date(b.timestamp || b.createdAt).getTime();
        
        return timeB - timeA; // නවතම වාර්තාව පළමුව
    });
}

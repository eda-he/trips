/* The itinerary app: day list, stop cards, filters, search, map, "visited" ticks.
   Reusable - nothing in this file is specific to one trip. Trip text and settings come from
   trips/<trip>/trip.config.js; trip data arrives as window.__ITIN__ from app/data-loader.js. */

const CFG = window.TRIP_CONFIG || {};
const CURRENCY = CFG.currencySymbol ?? '¥';
const REVIEW = Object.assign({label:'Reviews', icon:'⭐'}, CFG.reviewLink || {});
const cssVar = (name, fallback) => (getComputedStyle(document.documentElement).getPropertyValue(name) || '').trim() || fallback;
const DATA = window.__ITIN__;
const META = DATA.meta;
const STOPS = DATA.stops;
const dayNums = Object.keys(META).map(Number).sort((a,b)=>a-b);

const state = { expanded:new Set([dayNums[0]]), poolExpanded:new Set(), search:"", catFilters:new Set(['all']) };

// --- Visited tracking, saved in this browser's localStorage. The key comes from trip.config.js so two trips never share ticks. ---
const VISITED_KEY = (CFG.storageKey || window.TRIP_ID || 'trip') + '_visited_stops';
function loadVisited(){
  try {
    const raw = localStorage.getItem(VISITED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch(e){ return new Set(); }
}
function saveVisited(){
  try { localStorage.setItem(VISITED_KEY, JSON.stringify([...visitedSet])); } catch(e){}
}
function stopKey(s){ return (s.d ?? 'pool') + '::' + s.n; }
let visitedSet = loadVisited();

let leafletMap=null, markerLayer=null;

const DEFAULT_CATS = ['restaurant','snacks/sweets','cafe','attraction','temple/shrine','garden/park','shopping','craft workshop','market'];
const CATS = ['all'].concat(Array.isArray(CFG.categories) && CFG.categories.length ? CFG.categories : DEFAULT_CATS);
function normCat(c){
  c=(c||'').toLowerCase().trim();
  if(c==='temple / shrine' || c==='temple/shrine') return 'temple/shrine';
  if(c==='garden / park' || c==='garden/park') return 'garden/park';
  if(c==='snacks/sweets') return 'snacks/sweets';
  if(c.includes('cafe')) return 'cafe';
  if(c.includes('craft')||c.includes('workshop')) return 'craft workshop';
  if(c.includes('market')) return 'market';
  if(c.includes('shop')) return 'shopping';
  if(c.includes('restaurant')||c.includes('food')) return 'restaurant';
  if(c.includes('temple')||c.includes('shrine')) return 'temple/shrine';
  if(c.includes('garden')||c.includes('park')) return 'garden/park';
  return 'attraction';
}
function catClass(c){ return normCat(c).replace(/[\s/]+/g,'-'); }

function matchesFilters(s){
  const catOk = state.catFilters.has('all') || state.catFilters.has(normCat(s.cat));
  const q = state.search.trim().toLowerCase();
  const hay = (s.n+' '+s.city+' '+s.note+' '+(s.tags||[]).join(' ')).toLowerCase();
  return catOk && (!q || hay.includes(q));
}

function mapsUrl(s){
  if(s.mapsLink && /^https?:\/\//i.test(s.mapsLink.trim())) return s.mapsLink.trim();
  const q = encodeURIComponent(s.n+' '+s.city);
  return "https://www.google.com/maps/search/?api=1&query="+q;
}
function mealMarkup(s){
  if(!s.meal || !s.meal.length) return "";
  return `<div class="meal-tags">${s.meal.map(m=>`<span class="meal-pill">${m}</span>`).join("")}</div>`;
}
function bestTimeMarkup(s){ return s.bestTime ? `<div class="best-time">◔ ${escapeHtml(s.bestTime)}</div>` : ""; }
function priceMarkup(s){ return s.price ? `<div class="price-line">${CURRENCY} ${escapeHtml(s.price)}</div>` : ""; }
function highlightMarkup(s){ return s.highlight ? `<div class="highlight-line">★ ${escapeHtml(s.highlight)}</div>` : ""; }
function reservationMarkup(s){
  if(!s.reservation) return "";
  const required = /reserv|required|book/i.test(s.reservation);
  return `<div class="reservation-line${required?' required':''}">📅 ${escapeHtml(s.reservation)}</div>`;
}
function escapeHtml(x){ return (x||'').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function stopCardHtml(s, isPool){
  const stepBadge = (!isPool && !s.maybe && s.day_order && s.day_order<999) ? `<div class="step-badge">${Math.round(s.day_order)}</div>` : "";
  const statusBadge = ``;
  const priorityBadge = s.priorityStatus === 'PRIORITY'
    ? `<div class="priority-badge">★ PRIORITY</div>`
    : (s.priorityStatus && s.priorityStatus.startsWith('BACKUP')
        ? `<div class="backup-badge">${escapeHtml(s.priorityStatus)}</div>`
        : "");

  const stopId = stopKey(s);
  const isVisited = visitedSet.has(stopId);

  // Row 1: city/neighborhood · hours · price, all on one line
  const row1parts = [escapeHtml(s.city)];
  if(s.h) row1parts.push(`<span class="hours">🕒 ${escapeHtml(s.h)}</span>`);
  if(s.price) row1parts.push(`<span class="price">${CURRENCY} ${escapeHtml(s.price)}</span>`);
  const row1 = row1parts.map((p,i)=> i===0? p : `<span class="sep">·</span>${p}`).join(' ');

  // Row 2: meal pills + best-time + tags, all on one line
  const mealPills = (s.meal||[]).map(m=>`<span class="meal-pill">${escapeHtml(m)}</span>`).join('');
  const bestTime = s.bestTime ? `<span class="best-time-inline">◔ ${escapeHtml(s.bestTime)}</span>` : '';
  const tagPills = (s.tags||[]).map(t=>`<span class="tag-pill">${escapeHtml(t)}</span>`).join('');
  const row2 = (mealPills || bestTime || tagPills) ? `<div class="meta-row-2">${mealPills}${bestTime}${tagPills}</div>` : '';

  const highlight = s.highlight ? `<div class="highlight-line">★ ${escapeHtml(s.highlight)}</div>` : '';
  const reservation = reservationMarkup(s);

  return `<div class="stop-card cat-${catClass(s.cat)}${isPool?' optional':''}${s.maybe?' maybe-card':''}${isVisited?' visited-card':''}" data-stop-id="${stopId}">
    ${stepBadge}
    ${statusBadge}
    ${priorityBadge}
    <button class="visited-toggle" data-stop-id="${stopId}" title="${isVisited?'Mark as not visited':'Mark as visited'}">${isVisited?'✓ Visited':'☐ Mark visited'}</button>
    <div class="stop-name${(s.lat && s.lng) ? ' clickable-name' : ''}"${(s.lat && s.lng) ? ` onclick="zoomToStop(${s.lat}, ${s.lng}, '${escapeHtml(s.n).replace(/'/g,"\\'")}')"` : ''}>${s.must?'<span class="star">★</span>':''}${escapeHtml(s.n)}</div>
    <div class="meta-row-1">${row1}</div>
    <div class="stop-note">${escapeHtml(s.note)}</div>
    ${row2}

    ${highlight}
    ${reservation}
    <a class="maps-link" target="_blank" rel="noopener" href="${mapsUrl(s)}">📍 Open in Maps →</a>
    ${s.tabelog ? `<a class="maps-link" target="_blank" rel="noopener" href="${escapeHtml(s.tabelog)}" style="margin-left:10px;">${REVIEW.icon} ${escapeHtml(REVIEW.label)} →</a>` : ''}
  </div>`;
}


function poolSectionHtml(city, poolStops){
  const isOpen = state.poolExpanded.has(city) || state.search.length>0;
  return `<div class="pool-block${isOpen?' open':''}" data-pool-city="${encodeURIComponent(city)}">
    <div class="day-header" data-pool-city="${encodeURIComponent(city)}">
      <div class="dh-left">
        <h3>More to explore in ${escapeHtml(city)}</h3>
        <div class="day-meta">${poolStops.length} optional stop${poolStops.length!==1?'s':''}</div>
      </div>
      <div class="chev">▸</div>
    </div>
    <div class="day-body">${poolStops.map(s=>stopCardHtml(s,true)).join("")}</div>
  </div>`;
}

function baseCity(cityStr){ return (cityStr||'').split(' · ')[0].trim(); }

function buildChips(){
  const el = document.getElementById('chipRow');
  el.innerHTML = CATS.map(c=>`<button class="chip ${state.catFilters.has(c)?'active':''}" data-cat="${c}">${c==='all'?'All':c}</button>`).join('');
  el.querySelectorAll('.chip').forEach(ch=>{
    ch.addEventListener('click', ()=>{
      const c = ch.dataset.cat;
      if(c==='all'){
        state.catFilters = new Set(['all']);
      } else {
        state.catFilters.delete('all');
        if(state.catFilters.has(c)) state.catFilters.delete(c); else state.catFilters.add(c);
        if(state.catFilters.size===0) state.catFilters.add('all');
      }
      render();
    });
  });
}

function render(){
  document.querySelectorAll('.chip').forEach(c=>c.classList.toggle('active', state.catFilters.has(c.dataset.cat)));
  const container = document.getElementById('routeContainer');
  let html = "";
  let totalShown = 0, poolShown = 0;
  const shownPoolCities = new Set();

  dayNums.forEach((d, idx)=>{
    const m = META[d];
    const stops = STOPS.filter(s=>s.d===d && matchesFilters(s)).sort((a,b)=>(a.day_order||999)-(b.day_order||999));
    if(stops.length>0){
      totalShown += stops.length;
      const isOpen = state.expanded.has(d) || state.search.length>0;
      html += `<div class="day-block ${isOpen?'open':''}" data-day="${d}">
        <div class="day-header" data-day="${d}">
          <div class="day-stamp">${d}</div>
          <div class="dh-left">
            <h2>${escapeHtml(m.city)} <span class="type-tag">${m.type}</span></h2>
            <div class="day-meta">${stops.length} stop${stops.length!==1?'s':''}</div>
          </div>
          <div class="chev">▸</div>
        </div>
        <div class="day-body">${stops.map(s=>stopCardHtml(s,false)).join("")}</div>
        <button class="float-collapse-btn" data-day="${d}" title="Collapse this day">▲ Collapse Day ${d}</button>
      </div>`;
    }
    const cityHere = baseCity(m.city);
    const nextM = idx+1<dayNums.length ? META[dayNums[idx+1]] : null;
    const nextCity = nextM ? baseCity(nextM.city) : null;
    if(cityHere && nextCity!==cityHere && !shownPoolCities.has(cityHere)){
      shownPoolCities.add(cityHere);
      const poolStops = STOPS.filter(s=> s.d===null && baseCity(s.city)===cityHere && matchesFilters(s));
      if(poolStops.length>0){
        poolShown += poolStops.length;
        html += poolSectionHtml(cityHere, poolStops);
      }
    }
  });

  container.innerHTML = html;
  document.getElementById('resultCount').textContent = totalShown+" stop"+(totalShown!==1?"s":"")+(poolShown?" · "+poolShown+" optional":"");
  const activeCats = [...state.catFilters].filter(c=>c!=='all');
  document.getElementById('catFilterLabel').textContent = activeCats.length===0 ? '' : ('filtered: '+activeCats.join(', '));
  document.getElementById('noResults').style.display = (totalShown+poolShown)===0 ? "block":"none";

  container.querySelectorAll('.day-header[data-day]').forEach(h=>{
    h.addEventListener('click', ()=>{
      const d = Number(h.dataset.day);
      if(state.expanded.has(d)){
        state.expanded.delete(d);
      } else {
        state.expanded.add(d);
      }
      render();
    });
  });
  container.querySelectorAll('.day-header[data-pool-city]').forEach(h=>{
    h.addEventListener('click', ()=>{
      const city = decodeURIComponent(h.dataset.poolCity);
      if(state.poolExpanded.has(city)){
        state.poolExpanded.delete(city);
      } else {
        state.poolExpanded.add(city);
      }
      render();
    });
  });
  syncMapMarkers();
}

let __zoomedStopKey = null;

function zoomToStop(lat, lng, name){
  if(!leafletMap) return;
  const key = lat + ',' + lng;

  // Toggle: clicking the same stop name again zooms back out
  if(__zoomedStopKey === key){
    __zoomedStopKey = null;
    if(window.__highlightMarker){ leafletMap.removeLayer(window.__highlightMarker); window.__highlightMarker = null; }
    syncMapMarkers(); // restores the normal fit-to-current-day(s) view
    return;
  }
  __zoomedStopKey = key;

  // Scroll the map into view (useful on mobile where the map may be scrolled past) - height stays as the user set it
  document.getElementById('leafletMap').scrollIntoView({behavior:'smooth', block:'start'});
  setTimeout(()=>{
    // Keep the current zoom/pan showing all pins for the day(s) in view - do NOT zoom in on this one stop
    // Just drop a prominent highlight marker so it's obvious which pin this is, relative to everything else
    if(window.__highlightMarker) leafletMap.removeLayer(window.__highlightMarker);
    window.__highlightMarker = L.circleMarker([lat, lng], {
      radius:16, weight:4, color:cssVar('--shu','#BC4B34'), fillColor:cssVar('--shu','#BC4B34'), fillOpacity:0.35, className:'pulse-highlight'
    }).addTo(leafletMap).bindPopup(`<div class="popup-name">${name}</div>`).openPopup();
    // Gently pan (not zoom) so the highlighted pin is visible if it's currently off-screen, without changing zoom level
    if(!leafletMap.getBounds().contains([lat, lng])){
      leafletMap.panTo([lat, lng], {animate:true});
    }
  }, 300);
}

function initMap(){
  leafletMap = L.map('leafletMap', {zoomControl:true}).setView((CFG.map && CFG.map.center) || [20,0], (CFG.map && CFG.map.zoom) || 2);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
    attribution:'Tiles &copy; Esri &mdash; Source: Esri, HERE, Garmin, USGS, Intermap, NASA', maxZoom:18
  }).addTo(leafletMap);
  markerLayer = L.layerGroup().addTo(leafletMap);
}

function syncMapMarkers(){
  if(!leafletMap) return;
  markerLayer.clearLayers();

  let visible;
  if(state.search.trim()){
    // while actively searching, show every match across the whole trip
    visible = STOPS.filter(s=> s.lat && s.lng && matchesFilters(s));
  } else if(state.expanded.size===0 && state.poolExpanded.size===0){
    // nothing expanded -> zoom out to show every pin on the trip
    visible = STOPS.filter(s=> s.lat && s.lng && matchesFilters(s));
  } else {
    // show the union of every currently-expanded day and pool section (fans out across multiple open days)
    visible = STOPS.filter(s=> s.lat && s.lng && matchesFilters(s) && (
      (s.d!==null && state.expanded.has(s.d)) ||
      (s.d===null && state.poolExpanded.has(baseCity(s.city)))
    ));
  }

  const bounds = [];
  visible.forEach(s=>{
    const pinColor = s.must ? cssVar('--shu','#BC4B34') : (s.maybe ? '#8A8578' : cssVar('--indigo','#1C3155'));
    const marker = L.circleMarker([s.lat, s.lng], {
      radius: 6, weight:2, color: pinColor,
      fillColor: pinColor, fillOpacity: s.maybe ? 0.55 : 0.85
    }).addTo(markerLayer);
    marker.bindPopup(`<div class="popup-name">${escapeHtml(s.n)}</div>
      <div class="popup-cat">${escapeHtml(normCat(s.cat))}</div>
      <div class="popup-note">${escapeHtml(s.note).slice(0,140)}${s.note.length>140?'…':''}</div>
      <a class="popup-maps" target="_blank" rel="noopener" href="${mapsUrl(s)}">Open in Maps →</a>
      ${s.tabelog ? `<a class="popup-maps" target="_blank" rel="noopener" href="${escapeHtml(s.tabelog)}" style="margin-left:8px;">${escapeHtml(REVIEW.label)} →</a>` : ''}`);
    bounds.push([s.lat, s.lng]);
  });
  if(bounds.length>0){
    leafletMap.fitBounds(bounds, {padding:[24,24], maxZoom:13});
  }
}

// --- Drag-to-resize the map ---
(function(){
  const handle = document.getElementById('mapResizeHandle');
  const mapEl = document.getElementById('leafletMap');
  let dragging = false, startY = 0, startHeight = 0;
  const MIN_H = 90, MAX_H = Math.round(window.innerHeight * 0.7);

  function onMove(clientY){
    const delta = clientY - startY;
    let newHeight = Math.max(MIN_H, Math.min(MAX_H, startHeight + delta));
    mapEl.style.height = newHeight + 'px';
    if(leafletMap) leafletMap.invalidateSize();
  }

  handle.addEventListener('mousedown', (e)=>{
    dragging = true; startY = e.clientY; startHeight = mapEl.getBoundingClientRect().height;
    handle.classList.add('dragging');
    e.preventDefault();
  });
  window.addEventListener('mousemove', (e)=>{ if(dragging) onMove(e.clientY); });
  window.addEventListener('mouseup', ()=>{ dragging=false; handle.classList.remove('dragging'); });

  handle.addEventListener('touchstart', (e)=>{
    dragging = true; startY = e.touches[0].clientY; startHeight = mapEl.getBoundingClientRect().height;
    handle.classList.add('dragging');
  }, {passive:true});
  window.addEventListener('touchmove', (e)=>{ if(dragging) onMove(e.touches[0].clientY); }, {passive:true});
  window.addEventListener('touchend', ()=>{ dragging=false; handle.classList.remove('dragging'); });
})();

// --- "Show my location" ---
let userMarker = null, userAccuracyCircle = null, watchId = null;
const locateBtn = document.getElementById('locateBtn');
const locateError = document.getElementById('locateError');

function showLocateError(msg){
  locateError.textContent = msg;
  locateError.style.display = 'block';
  setTimeout(()=>{ locateError.style.display='none'; }, 4500);
}

locateBtn.addEventListener('click', ()=>{
  if(!navigator.geolocation){
    showLocateError("This browser doesn't support location.");
    return;
  }
  // toggle off if already tracking
  if(watchId !== null){
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
    locateBtn.classList.remove('active');
    if(userMarker){ leafletMap.removeLayer(userMarker); userMarker=null; }
    if(userAccuracyCircle){ leafletMap.removeLayer(userAccuracyCircle); userAccuracyCircle=null; }
    return;
  }
  locateBtn.classList.add('active');
  let firstFix = true;
  watchId = navigator.geolocation.watchPosition(
    (pos)=>{
      const {latitude, longitude, accuracy} = pos.coords;
      if(userMarker){
        userMarker.setLatLng([latitude, longitude]);
        userAccuracyCircle.setLatLng([latitude, longitude]).setRadius(accuracy);
      } else {
        const icon = L.divIcon({className:'', html:'<div class="user-dot"></div>', iconSize:[14,14]});
        userMarker = L.marker([latitude, longitude], {icon, zIndexOffset:1000}).addTo(leafletMap);
        userAccuracyCircle = L.circle([latitude, longitude], {radius:accuracy, className:'user-accuracy', weight:1}).addTo(leafletMap);
      }
      if(firstFix){
        leafletMap.setView([latitude, longitude], 15);
        firstFix = false;
      }
    },
    (err)=>{
      locateBtn.classList.remove('active');
      watchId = null;
      if(err.code === 1) showLocateError("Location permission denied — enable it in your browser settings to use this.");
      else showLocateError("Couldn't get your location. Try again.");
    },
    { enableHighAccuracy:true, maximumAge:10000, timeout:12000 }
  );
});

document.getElementById('searchInput').addEventListener('input', (e)=>{
  state.search = e.target.value;
  if(state.search.trim()){
    dayNums.forEach(d=>state.expanded.add(d));
  }
  render();
});

applyTripHeader();
buildChips();
initMap();
render();
updateVisitedCount();

// --- Floating "collapse day" button: shows when scrolled into an open day's content ---
function updateFloatCollapseBtn(){
  document.querySelectorAll('.day-block.open').forEach(block=>{
    const header = block.querySelector('.day-header');
    const btn = block.querySelector('.float-collapse-btn');
    if(!header || !btn) return;
    const headerRect = header.getBoundingClientRect();
    if(headerRect.bottom < 0){
      btn.classList.add('visible');
    } else {
      btn.classList.remove('visible');
    }
  });
}
window.addEventListener('scroll', updateFloatCollapseBtn, {passive:true});

document.addEventListener('click', (e)=>{
  const vbtn = e.target.closest('.visited-toggle');
  if(vbtn){
    const id = vbtn.dataset.stopId;
    if(visitedSet.has(id)) visitedSet.delete(id); else visitedSet.add(id);
    saveVisited();
    render();
    updateVisitedCount();
    return;
  }
  const btn = e.target.closest('.float-collapse-btn');
  if(!btn) return;
  const d = Number(btn.dataset.day);
  state.expanded.delete(d);
  render();
  setTimeout(()=>{
    const newHeader = document.querySelector(`.day-header[data-day="${d}"]`);
    if(newHeader) newHeader.scrollIntoView({behavior:'smooth', block:'start'});
  }, 50);
});

function updateVisitedCount(){
  const el = document.getElementById('visitedCount');
  if(el) el.textContent = `${visitedSet.size} place${visitedSet.size!==1?'s':''} visited`;
}

document.getElementById('collapseAllBtn').addEventListener('click', ()=>{
  state.expanded.clear();
  state.poolExpanded.clear();
  render();
  window.scrollTo({top:0, behavior:'smooth'});
});

document.getElementById('footerNote').textContent =
  `${STOPS.filter(s=>s.d!==null).length} scheduled stops + ${STOPS.filter(s=>s.d===null).length} optional alternates` + (CFG.footerNote ? ' · ' + CFG.footerNote : '');

// --- Header text comes from trip/trip.config.js ---
function applyTripHeader(){
  if(CFG.pageTitle) document.title = CFG.pageTitle;
  const set=(id,v)=>{ const el=document.getElementById(id); if(el && v!=null) el.textContent=v; };
  set('tripTitle', CFG.title); set('tripDates', CFG.dates); set('tripSubtitle', CFG.subtitle);
  // Links to the other trips listed in trips/trips.js (hidden when there is only one)
  const others = ((window.TRIPS && window.TRIPS.list) || []).filter(t => t.id !== window.TRIP_ID);
  const nav = document.getElementById('tripSwitch');
  if(nav && others.length){
    nav.innerHTML = 'Other trips: ' + others.map(t => `<a href="?trip=${encodeURIComponent(t.id)}">${escapeHtml(t.name || t.id)}</a>`).join(' · ');
  }
}

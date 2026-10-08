/* Picks which trip to show, then loads it.
   Reusable - nothing in this file is specific to one trip.

   The trip comes from the page address:   index.html?trip=japan-2026
   With no ?trip= value, the "default" in trips/trips.js is used.
   The value must match a folder under trips/ that is listed in trips/trips.js. */
(function(){
  const reg = window.TRIPS || {};
  const list = Array.isArray(reg.list) ? reg.list : [];
  const asked = new URLSearchParams(location.search).get('trip');
  const id = (asked || reg.default || (list[0] && list[0].id) || '').trim();
  const known = /^[A-Za-z0-9_-]+$/.test(id) && list.some(t => t.id === id);

  function esc(x){ return String(x||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function chooser(msg){
    const c = document.getElementById('routeContainer');
    const items = list.map(t => `<li><a href="?trip=${encodeURIComponent(t.id)}">${esc(t.name || t.id)}</a>${t.dates ? ' — '+esc(t.dates) : ''}</li>`).join('');
    if(c) c.innerHTML = `<div class="no-results">${esc(msg)}<ul class="trip-list">${items}</ul></div>`;
    const h = document.getElementById('tripTitle'); if(h) h.textContent = 'Choose a trip';
  }
  function load(src, onload, onerror){
    const s = document.createElement('script'); s.src = src; s.onload = onload; s.onerror = onerror;
    document.body.appendChild(s);
  }

  if(!known){
    return chooser(asked ? `There is no trip called "${asked}". Pick one:` : 'No default trip is set in trips/trips.js. Pick one:');
  }
  window.TRIP_ID = id;
  window.TRIP_BASE = 'trips/' + id + '/';
  const v = '?v=' + encodeURIComponent(window.APP_VERSION || '');   // cache-buster, see index.html
  load(window.TRIP_BASE + 'trip.config.js' + v,
       () => load('app/data-loader.js' + v),
       () => chooser(`Could not load trips/${id}/trip.config.js. Pick a trip:`));
})();

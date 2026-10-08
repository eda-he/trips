/* Loads the trip data, then starts the app.
   Reusable - nothing in this file is specific to one trip. app/boot.js has already picked the
   trip and loaded its trip.config.js before this file runs.

   Where the data comes from, in order:
     1. A published Google Sheet, if trip.config.js has both googleSheet links filled in.
     2. The CSV files in the trip's folder (trips/<trip>/stops.csv and days.csv).
     3. The last copy this device loaded successfully (so the page still opens offline).
     4. A copy built into the page - only present in the single-file version made by tools/build_standalone.py.

   The CSV columns are documented in README.md. toStop() below is the one place that maps
   a CSV row to the object the app uses - add a column there if you add one to the CSV. */
(function(){
  const CFG = window.TRIP_CONFIG || {};
  const SHEET = CFG.googleSheet || {};

  // Per-trip look: trip.config.js may override any colour or font variable from app/styles.css.
  (function applyTheme(){
    const th = CFG.theme || {};
    Object.entries(th.colors || {}).forEach(([k,v]) => document.documentElement.style.setProperty(k.startsWith('--') ? k : '--'+k, v));
    const f = th.fonts || {};
    [['body','--font-body'],['display','--font-display'],['mono','--font-mono']].forEach(([k,v]) => { if(f[k]) document.documentElement.style.setProperty(v, f[k]); });
    const link = document.getElementById('fontLink');
    if(f.url && link) link.href = f.url;
  })();
  const BASE = window.TRIP_BASE || '';            // set by app/boot.js, e.g. "trips/japan-2026/"
  if(!CFG.storageKey) CFG.storageKey = window.TRIP_ID || 'trip';
  const FILES = Object.assign({stopsCsv:BASE+'stops.csv', daysCsv:BASE+'days.csv'}, CFG.data || {});
  const CACHE_KEY = CFG.storageKey + '_data_cache_v1';
  const TIMEOUT_MS = 6000;
  const EMBEDDED = window.__ITIN__ || null;

  function parseCSV(text){
    const rows=[]; let row=[], f='', q=false;
    text = text.replace(/^﻿/, '');
    for(let i=0;i<text.length;i++){
      const c=text[i];
      if(q){
        if(c==='"'){ if(text[i+1]==='"'){ f+='"'; i++; } else q=false; }
        else f+=c;
      } else if(c==='"') q=true;
      else if(c===','){ row.push(f); f=''; }
      else if(c==='\n'){ row.push(f); rows.push(row); row=[]; f=''; }
      else if(c!=='\r') f+=c;
    }
    if(f!=='' || row.length){ row.push(f); rows.push(row); }
    const head=(rows.shift()||[]).map(x=>x.trim());
    return rows.filter(r=>r.some(v=>v.trim()!=='')).map(r=>{
      const o={}; head.forEach((k,j)=>{ o[k]=(r[j]??'').trim(); }); return o;
    });
  }
  const num = v => { const s=String(v??'').replace(/,/g,'').trim(); if(s==='') return NaN; const n=Number(s); return isFinite(n)?n:NaN; };

  // One CSV row -> one stop object. "Review Link" is the generic column name; "Tabelog Link" is also accepted.
  function toStop(r, day, maybe){
    const lat=num(r['Latitude']), lng=num(r['Longitude']), ord=num(r['day_order']);
    const split=(v,sep)=>String(v||'').split(sep).map(x=>x.trim()).filter(Boolean);
    return {
      n:r['Name']||'', city:(r['City']||'')+(r['Neighborhood']?` · ${r['Neighborhood']}`:''),
      cat:r['Category']||'', h:r['Hours']||'', note:r['Description']||'',
      lat:isNaN(lat)?null:lat, lng:isNaN(lng)?null:lng, tags:split(r['Tags'],';'),
      must:String(r['Must See Flag']||'').trim().toLowerCase()==='yes',
      meal:split(r['Meal Time'],'/'), bestTime:r['Best Time To Visit']||'', price:r['Price']||'',
      highlight:r['Must See Highlight']||'', reservation:r['Reservation Info']||'',
      mapsLink:r['Google Maps Link']||'', tabelog:r['Review Link']||r['Tabelog Link']||'', ig:r['Instagram']||'',
      website:r['Website']||'', day_order:isNaN(ord)?999:ord, d:day, maybe:maybe,
      priorityStatus:r['Priority Status']||''
    };
  }

  // stops.csv + days.csv -> {meta, stops}
  //   Day set            -> scheduled stop on that day
  //   Potential Day set  -> optional stop shown under that day
  //   neither            -> "More to explore in <City>" pool (restroom rows are skipped)
  function build(stopsCsv, daysCsv){
    const stopRows=parseCSV(stopsCsv), dayRows=parseCSV(daysCsv);
    if(!stopRows.length || !('Name' in stopRows[0]) || !('Day' in stopRows[0])) throw new Error('stops data is missing the Name/Day columns');
    if(!dayRows.length || !('Day' in dayRows[0])) throw new Error('days data is missing the Day column');
    const meta={};
    dayRows.forEach(r=>{ const d=num(r['Day']); if(!isNaN(d)) meta[String(Math.trunc(d))]={city:r['City']||'', type:r['Type']||''}; });
    const stops=[];
    stopRows.forEach(r=>{ const d=num(r['Day']); if(!isNaN(d)) stops.push(toStop(r,Math.trunc(d),false)); });
    stopRows.forEach(r=>{ const d=num(r['Potential Day']); if(!isNaN(d)) stops.push(toStop(r,Math.trunc(d),true)); });
    stopRows.forEach(r=>{
      if(isNaN(num(r['Day'])) && isNaN(num(r['Potential Day'])) && String(r['Category']||'').toLowerCase()!=='restroom'){
        const s=toStop(r,-1,true); s.d=null; stops.push(s);
      }
    });
    if(!Object.keys(meta).length || !stops.length) throw new Error('data has no days or no stops');
    return {meta, stops};
  }

  async function get(url){
    const ctl=new AbortController(); const t=setTimeout(()=>ctl.abort(), TIMEOUT_MS);
    try{
      const res=await fetch(url,{cache:'no-store', signal:ctl.signal});
      if(!res.ok) throw new Error('HTTP '+res.status);
      const txt=await res.text();
      if(/^\s*<(!doctype|html)/i.test(txt)) throw new Error('link returned a web page, not CSV');
      return txt;
    } finally { clearTimeout(t); }
  }

  const fmt = ts => new Date(ts).toLocaleString([], {month:'short', day:'numeric', hour:'numeric', minute:'2-digit'});
  function status(msg, warn){
    const el=document.getElementById('dataSource');
    if(el){ el.textContent=msg; el.classList.toggle('warn', !!warn); }
  }
  function saveCache(){
    try{ localStorage.setItem(CACHE_KEY, JSON.stringify({ts:Date.now(), data:window.__ITIN__})); }catch(e){}
  }
  function readCache(){
    try{ const c=JSON.parse(localStorage.getItem(CACHE_KEY)||'null'); return (c && c.data && c.data.stops) ? c : null; }catch(e){ return null; }
  }

  // Start the app. In the single-file build the app code is inline (#appScript); otherwise load app/app.js.
  function boot(){
    const inline=document.getElementById('appScript');
    const s=document.createElement('script');
    if(inline) s.textContent=inline.textContent; else s.src='app/app.js';
    document.body.appendChild(s);
  }
  function fail(msg){
    const container=document.getElementById('routeContainer');
    if(container) container.innerHTML='<div class="no-results">'+msg+'</div>';
    status('No trip data loaded', true);
  }

  async function start(){
    const container=document.getElementById('routeContainer');
    if(container) container.innerHTML='<div class="no-results">Loading itinerary…</div>';
    let loaded=false;

    // 1. Google Sheet
    if(SHEET.stopsCsvUrl && SHEET.daysCsvUrl){
      try{
        const [a,b]=await Promise.all([get(SHEET.stopsCsvUrl), get(SHEET.daysCsvUrl)]);
        window.__ITIN__=build(a,b); saveCache(); loaded=true;
        status('Live from Google Sheet · loaded '+fmt(Date.now()));
      } catch(err){ console.warn('Google Sheet load failed:', err); }
    }
    // 2. CSV files in the repo
    if(!loaded && !EMBEDDED){
      try{
        const [a,b]=await Promise.all([get(FILES.stopsCsv), get(FILES.daysCsv)]);
        window.__ITIN__=build(a,b); saveCache(); loaded=true;
        status((SHEET.stopsCsvUrl ? 'Could not reach the sheet — using ' : 'Loaded from ')+FILES.stopsCsv+' · '+fmt(Date.now()), !!SHEET.stopsCsvUrl);
      } catch(err){ console.warn('CSV load failed:', err); }
    }
    // 3. Last copy saved on this device
    if(!loaded){
      const cached=readCache();
      if(cached && !EMBEDDED){
        window.__ITIN__=cached.data; loaded=true;
        status('Offline — showing the copy saved '+fmt(cached.ts), true);
      }
    }
    // 4. Copy built into the page (single-file build)
    if(!loaded && EMBEDDED){
      window.__ITIN__=EMBEDDED; loaded=true;
      status('Using the copy built into this page');
    }
    if(!loaded){
      return fail('Could not load the trip data. If you opened index.html straight from your computer, browsers block it from reading the CSV files — view the page through GitHub Pages, or build the single-file version with tools/build_standalone.py.');
    }
    if(container) container.innerHTML='';
    boot();
  }
  start();
})();

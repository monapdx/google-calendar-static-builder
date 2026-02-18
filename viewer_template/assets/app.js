/* Offline-safe calendar app (file:// compatible)
   Reads:
     window.__META__
     window.__EVENTS_BY_DATE__
*/

const $ = (sel, root=document) => root.querySelector(sel);

const WEEKDAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

let EVENTS = {};
let META = {};
let current = { year: null, month: null, day: null };
let today = new Date();

function pad2(n){ return String(n).padStart(2,"0"); }
function ymd(d){ return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }

function parseISOToLocal(iso){
  if(!iso) return null;
  if(iso.length === 10) return new Date(iso + "T00:00:00");
  return new Date(iso);
}
function fmtTimeRange(ev){
  if(ev.allDay) return "All day";
  const s = parseISOToLocal(ev.start);
  const e = ev.end ? parseISOToLocal(ev.end) : null;
  if(!s) return "";
  const opts = { hour:"numeric", minute:"2-digit" };
  const st = s.toLocaleTimeString([], opts);
  const et = e ? e.toLocaleTimeString([], opts) : "";
  return et ? `${st} – ${et}` : st;
}
function monthLabel(y,m){ return `${MONTHS[m]} ${y}`; }

function readHash(){
  const h = location.hash.replace(/^#\/?/, "");
  if(!h) return null;
  const parts = h.split("/").filter(Boolean);
  if(parts.length < 2) return null;
  const y = parseInt(parts[0],10);
  const m = parseInt(parts[1],10)-1;
  const d = parts.length>=3 ? parseInt(parts[2],10) : null;
  if(Number.isNaN(y) || Number.isNaN(m)) return null;
  return {year:y, month:m, day:d};
}
function writeHash(){
  const y = current.year, m = current.month+1;
  const base = `#/${y}/${pad2(m)}`;
  location.hash = current.day ? `${base}/${pad2(current.day)}` : base;
}
function clampYear(y){
  if(typeof META.minYear !== "number" || typeof META.maxYear !== "number") return y;
  return Math.max(META.minYear, Math.min(META.maxYear, y));
}

function setCurrent(y,m,d=null, push=true){
  current.year=y; current.month=m; current.day=d;
  if(push) writeHash();
  render();
}

function buildYearOptions(){
  const sel = $("#yearSelect");
  if(!sel) return;
  sel.innerHTML = "";
  for(let y=META.minYear; y<=META.maxYear; y++){
    const opt = document.createElement("option");
    opt.value = String(y);
    opt.textContent = String(y);
    sel.appendChild(opt);
  }
}

function firstDayOfMonth(y,m){ return new Date(y,m,1); }
function getMonthGrid(y,m){
  const first = firstDayOfMonth(y,m);
  const startDow = first.getDay();
  const start = new Date(y,m,1 - startDow);
  const grid = [];
  for(let i=0;i<42;i++){
    const d = new Date(start);
    d.setDate(start.getDate()+i);
    grid.push(d);
  }
  return grid;
}
function countEventsOn(dateStr){
  const list = EVENTS[dateStr] || [];
  return list.filter(e=> (e.status||"").toUpperCase() !== "CANCELLED").length;
}

function renderMiniCal(){
  const y = current.year, m = current.month;
  const grid = getMonthGrid(y,m);
  const table = $("#miniCalBody");
  if(!table) return;
  table.innerHTML = "";
  for(let r=0;r<6;r++){
    const tr = document.createElement("tr");
    for(let c=0;c<7;c++){
      const d = grid[r*7+c];
      const td = document.createElement("td");
      td.textContent = d.getDate();
      const ds = ymd(d);
      if(d.getMonth() !== m) td.classList.add("other");
      if(ds === ymd(today)) td.classList.add("today");
      if(current.day && ds === `${current.year}-${pad2(current.month+1)}-${pad2(current.day)}`) td.classList.add("selected");
      td.title = ds + (countEventsOn(ds) ? ` • ${countEventsOn(ds)} events` : "");
      td.addEventListener("click", ()=> setCurrent(d.getFullYear(), d.getMonth(), d.getDate()));
      tr.appendChild(td);
    }
    table.appendChild(tr);
  }
}

function renderMonthGrid(){
  const ml = $("#monthLabel");
  if(ml) ml.textContent = monthLabel(current.year, current.month);
  const ys = $("#yearSelect");
  if(ys) ys.value = String(current.year);

  const grid = getMonthGrid(current.year, current.month);
  const tbody = $("#monthGridBody");
  if(!tbody) return;
  tbody.innerHTML = "";

  for(let r=0;r<6;r++){
    const tr = document.createElement("tr");
    for(let c=0;c<7;c++){
      const d = grid[r*7+c];
      const td = document.createElement("td");
      const ds = ymd(d);
      const inMonth = d.getMonth() === current.month;
      if(!inMonth) td.classList.add("td-other");

      const dn = document.createElement("div");
      dn.className = "daynum";
      const bubble = document.createElement("div");
      bubble.className = "bubble";
      bubble.textContent = d.getDate();
      if(ds === ymd(today)) bubble.classList.add("today");
      if(current.day && ds === `${current.year}-${pad2(current.month+1)}-${pad2(current.day)}`) bubble.classList.add("selected");
      dn.appendChild(bubble);
      td.appendChild(dn);

      const list = (EVENTS[ds] || []).filter(e=> (e.status||"").toUpperCase() !== "CANCELLED");
      const maxShow = 3;
      list.slice(0,maxShow).forEach(ev=>{
        const div = document.createElement("div");
        div.className = "ev" + (ev.allDay ? " allDay" : "");
        div.textContent = ev.allDay ? ev.title : `${fmtTimeRange(ev)} ${ev.title}`;
        div.title = ev.title || "";
        td.appendChild(div);
      });
      if(list.length > maxShow){
        const more = document.createElement("div");
        more.className = "more";
        more.textContent = `+${list.length-maxShow} more`;
        td.appendChild(more);
      }

      td.addEventListener("click", ()=> setCurrent(d.getFullYear(), d.getMonth(), d.getDate()));
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
}

function renderDayPanel(){
  const y = current.year, m = current.month, d = current.day;
  const title = $("#dayTitle");
  const sub = $("#daySub");
  const container = $("#dayEvents");
  if(!title || !sub || !container) return;

  if(!d){
    title.textContent = "Pick a day";
    sub.textContent = "Click any date to see its events.";
    container.innerHTML = "";
    return;
  }
  const dateObj = new Date(y,m,d);
  const ds = ymd(dateObj);
  const weekday = WEEKDAYS[dateObj.getDay()];
  title.textContent = `${weekday}, ${MONTHS[m]} ${d}, ${y}`;

  const evs = (EVENTS[ds] || []).filter(e=> (e.status||"").toUpperCase() !== "CANCELLED");
  sub.textContent = evs.length ? `${evs.length} event${evs.length===1?"":"s"}` : "No events";

  container.innerHTML = "";
  evs.forEach(ev=>{
    const item = document.createElement("div");
    item.className = "eventitem" + (ev.allDay ? " allDay" : "");
    const t = document.createElement("div");
    t.className = "t";
    t.textContent = ev.title || "(no title)";
    const m1 = document.createElement("div");
    m1.className = "m";
    m1.textContent = fmtTimeRange(ev);

    item.appendChild(t);
    item.appendChild(m1);

    const bits = [];
    if(ev.location) bits.push(ev.location);
    if(ev.description) bits.push(String(ev.description).replace(/\\n/g,"\n").trim());
    if(bits.length){
      const m2 = document.createElement("div");
      m2.className = "m";
      m2.textContent = bits.join(" • ");
      item.appendChild(m2);
    }
    container.appendChild(item);
  });
}

function renderLeftSummary(){
  const quick = $("#quickJump");
  const chip = $("#countChip");
  if(!quick || !chip) return;
  const ds = current.day ? ymd(new Date(current.year,current.month,current.day)) : null;
  const count = ds ? countEventsOn(ds) : 0;
  quick.textContent = current.day ? `Open ${ds}` : "No date selected";
  quick.onclick = ()=> {
    if(current.day){
      const panel = $("#dayPanel");
      if(panel) panel.scrollIntoView({behavior:"smooth", block:"start"});
    }
  };
  chip.textContent = current.day ? `${count} event${count===1?"":"s"}` : "—";
}

function applySearch(){
  const input = $("#search");
  const out = $("#searchResults");
  if(!input || !out) return;

  const q = (input.value || "").trim().toLowerCase();
  out.innerHTML = "";
  if(!q) return;

  const matches = [];
  for(const [day, list] of Object.entries(EVENTS)){
    for(const ev of list){
      if((ev.status||"").toUpperCase()==="CANCELLED") continue;
      const blob = `${ev.title||""} ${ev.location||""} ${ev.description||""}`.toLowerCase();
      if(blob.includes(q)) matches.push({day, ev});
    }
  }
  matches.sort((a,b)=> a.day.localeCompare(b.day));
  const max = 30;

  matches.slice(0,max).forEach(({day, ev})=>{
    const btn = document.createElement("div");
    btn.className = "pill";
    btn.textContent = `${day} • ${ev.title || "(no title)"}`;
    btn.onclick = ()=>{
      const [Y,M,D] = day.split("-").map(n=>parseInt(n,10));
      setCurrent(Y, M-1, D);
      input.value = "";
      out.innerHTML = "";
    };
    out.appendChild(btn);
  });

  if(matches.length > max){
    const note = document.createElement("div");
    note.className = "footer-note";
    note.textContent = `Showing first ${max} matches. Refine your search to narrow it down.`;
    out.appendChild(note);
  }
}

function render(){
  renderMiniCal();
  renderMonthGrid();
  renderDayPanel();
  renderLeftSummary();
}

function init(){
  const cn = $("#calName");
  if(cn) cn.textContent = META.calendarName || "Calendar";
  buildYearOptions();

  const prev = $("#prev");
  const next = $("#next");
  const todayBtn = $("#todayBtn");
  const yearSel = $("#yearSelect");
  const search = $("#search");

  if(prev) prev.addEventListener("click", ()=>{
    let y = current.year, m = current.month-1;
    if(m<0){ m=11; y--; }
    y = clampYear(y);
    setCurrent(y,m,null);
  });
  if(next) next.addEventListener("click", ()=>{
    let y = current.year, m = current.month+1;
    if(m>11){ m=0; y++; }
    y = clampYear(y);
    setCurrent(y,m,null);
  });
  if(todayBtn) todayBtn.addEventListener("click", ()=>{
    setCurrent(today.getFullYear(), today.getMonth(), today.getDate());
  });
  if(yearSel) yearSel.addEventListener("change", (e)=>{
    const y = clampYear(parseInt(e.target.value,10));
    setCurrent(y, current.month, current.day);
  });
  if(search) search.addEventListener("input", applySearch);

  window.addEventListener("hashchange", ()=>{
    const h = readHash();
    if(!h) return;
    setCurrent(clampYear(h.year), h.month, h.day, false);
  });

  const h = readHash();
  if(h){
    setCurrent(clampYear(h.year), h.month, h.day, false);
  }else{
    setCurrent(today.getFullYear(), today.getMonth(), today.getDate(), true);
  }

  const metaNote = $("#metaNote");
  if(metaNote) metaNote.textContent = `Static archive • ${META.timezone || ""} • Years ${META.minYear}–${META.maxYear}`;
}

// ---- FINAL BOOTSTRAP ----
document.addEventListener("DOMContentLoaded", ()=>{
  EVENTS = window.__EVENTS_BY_DATE__ || {};
  META = window.__META__ || {};
  init();
});

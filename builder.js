const $ = (sel) => document.querySelector(sel);

let loadedIcsText = null;
let loadedIcsName = null;

function setStatus(msg){ $("#status").textContent = msg; }

function downloadBlob(blob, filename){
  const a = document.createElement("a");
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 2000);
}

function readFileAsText(file){
  return new Promise((resolve,reject)=>{
    const fr = new FileReader();
    fr.onload = ()=> resolve(String(fr.result || ""));
    fr.onerror = reject;
    fr.readAsText(file);
  });
}

async function fetchText(path){
  const res = await fetch(path, {cache:"no-store"});
  if(!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
  return await res.text();
}

function ymdFromDate(date){
  const y = date.getFullYear();
  const m = String(date.getMonth()+1).padStart(2,"0");
  const d = String(date.getDate()).padStart(2,"0");
  return `${y}-${m}-${d}`;
}

function coerceYear(val){
  const n = parseInt(val,10);
  return Number.isFinite(n) ? n : null;
}

function extractCalendarName(icsText){
  const m = icsText.match(/\nX-WR-CALNAME:(.+)\n/i);
  return m ? m[1].trim() : "";
}

function buildEventsByDate(icsText, opts){
  const jcal = ICAL.parse(icsText);
  const vcal = new ICAL.Component(jcal);
  const vevents = vcal.getAllSubcomponents("vevent");

  const eventsByDate = {};
  let minYear = null, maxYear = null, added = 0;

  const startYear = opts.startYear;
  const endYear = opts.endYear;

  const rangeStart = new Date(startYear ?? 1900, 0, 1, 0, 0, 0);
  const rangeEnd = new Date((endYear ?? 2200) + 1, 0, 1, 0, 0, 0);

  function considerYear(y){
    minYear = (minYear===null) ? y : Math.min(minYear,y);
    maxYear = (maxYear===null) ? y : Math.max(maxYear,y);
  }
  function pushEvent(dayKey, evObj){
    (eventsByDate[dayKey] ||= []).push(evObj);
    added++;
  }
  function makeEventObj(title, startJS, endJS, allDay, status, location, description, uid){
    return {
      uid: uid || "",
      title: title || "(no title)",
      start: allDay ? ymdFromDate(startJS) : startJS.toISOString(),
      end: endJS ? (allDay ? ymdFromDate(endJS) : endJS.toISOString()) : null,
      allDay: !!allDay,
      status: status || "CONFIRMED",
      location: location || "",
      description: description || "",
    };
  }
  function addAllDaySpan(evObj, startDate, endDateExclusive){
    const d = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const end = new Date(endDateExclusive.getFullYear(), endDateExclusive.getMonth(), endDateExclusive.getDate());
    while(d < end){
      pushEvent(ymdFromDate(d), evObj);
      d.setDate(d.getDate()+1);
    }
  }

  for(const ve of vevents){
    const ev = new ICAL.Event(ve);

    const statusProp = ve.getFirstPropertyValue("status");
    const baseStatus = (statusProp || "CONFIRMED").toString().toUpperCase();
    if(baseStatus === "CANCELLED") continue;

    const uid = ev.uid || "";
    const baseTitle = ev.summary || "(no title)";
    const baseLocation = ev.location || "";
    const baseDescription = ev.description || "";

    if(!ev.isRecurring()){
      const start = ev.startDate.toJSDate();
      const end = ev.endDate ? ev.endDate.toJSDate() : null;
      const allDay = ev.startDate.isDate;

      if(start < rangeStart || start >= rangeEnd) continue;
      considerYear(start.getFullYear());

      const loc = opts.titlesOnly ? "" : (opts.stripLocation ? "" : baseLocation);
      const desc = opts.titlesOnly ? "" : (opts.stripDescription ? "" : baseDescription);

      const obj = makeEventObj(baseTitle, start, end, allDay, baseStatus, loc, desc, uid);
      if(allDay){
        addAllDaySpan(obj, start, end || new Date(start.getFullYear(), start.getMonth(), start.getDate()+1));
      }else{
        pushEvent(ymdFromDate(start), obj);
      }
      continue;
    }

    const iter = ev.iterator();
    let next;
    while((next = iter.next())){
      const details = ev.getOccurrenceDetails(next);
      const occStart = details.startDate.toJSDate();
      if(occStart >= rangeEnd) break;
      if(occStart < rangeStart) continue;

      const occEnd = details.endDate ? details.endDate.toJSDate() : null;
      const allDay = details.startDate.isDate;

      considerYear(occStart.getFullYear());

      const item = details.item;
      const title = item.summary || baseTitle;
      const location = item.location || baseLocation;
      const description = item.description || baseDescription;
      const occStatusProp = item.component.getFirstPropertyValue("status");
      const occStatus = (occStatusProp || baseStatus).toString().toUpperCase();
      if(occStatus === "CANCELLED") continue;

      const loc = opts.titlesOnly ? "" : (opts.stripLocation ? "" : location);
      const desc = opts.titlesOnly ? "" : (opts.stripDescription ? "" : description);

      const obj = makeEventObj(title, occStart, occEnd, allDay, occStatus, loc, desc, uid);
      if(allDay){
        addAllDaySpan(obj, occStart, occEnd || new Date(occStart.getFullYear(), occStart.getMonth(), occStart.getDate()+1));
      }else{
        pushEvent(ymdFromDate(occStart), obj);
      }
    }
  }

  for(const day of Object.keys(eventsByDate)){
    eventsByDate[day].sort((a,b)=>{
      if(a.allDay && !b.allDay) return -1;
      if(!a.allDay && b.allDay) return 1;
      return String(a.start).localeCompare(String(b.start));
    });
  }

  if(startYear !== null && startYear !== undefined) minYear = startYear;
  if(endYear !== null && endYear !== undefined) maxYear = endYear;
  if(minYear === null) minYear = (new Date()).getFullYear();
  if(maxYear === null) maxYear = (new Date()).getFullYear();

  return {eventsByDate, minYear, maxYear, added};
}

async function buildZip(){
  if(!loadedIcsText){ setStatus("No .ics loaded."); return; }

  let viewerIndex, viewerStyle, viewerApp;
  try{
    [viewerIndex, viewerStyle, viewerApp] = await Promise.all([
      fetchText("./viewer_template/index.html"),
      fetchText("./viewer_template/assets/style.css"),
      fetchText("./viewer_template/assets/app.js"),
    ]);
  }catch(err){
    console.error(err);
    setStatus("Could not load viewer template files. (On GitHub Pages this will work automatically.)");
    return;
  }

  const folderName = ($("#folderName").value || "calendar_site").trim() || "calendar_site";
  const title = ($("#title").value || "").trim();
  const tzLabel = ($("#tzLabel").value || "Local").trim() || "Local";

  const startYear = coerceYear($("#startYear").value);
  const endYear = coerceYear($("#endYear").value);
  if(startYear && endYear && endYear < startYear){ setStatus("End year must be >= start year."); return; }

  const stripDescription = $("#stripDescription").checked;
  const stripLocation = $("#stripLocation").checked;
  const titlesOnly = $("#titlesOnly").checked;

  setStatus("Parsing .ics and expanding recurrences…");

  const calName = title || extractCalendarName(loadedIcsText) || (loadedIcsName ? loadedIcsName.replace(/\.ics$/i,"") : "Calendar");
  const built = buildEventsByDate(loadedIcsText, {startYear, endYear, stripDescription, stripLocation, titlesOnly});

  const meta = {
    calendarName: calName,
    timezone: tzLabel,
    minYear: built.minYear,
    maxYear: built.maxYear,
    generatedOn: new Date().toISOString()
  };

  setStatus(`Building ZIP… (days: ${Object.keys(built.eventsByDate).length}, instances: ${built.added})`);

  const zip = new JSZip();
  const root = zip.folder(folderName);

  root.file("index.html", viewerIndex.replace("{{SITE_TITLE}}", calName));
  root.folder("assets").file("style.css", viewerStyle);
  root.folder("assets").file("app.js", viewerApp);
  root.folder("data").file("meta.js", "window.__META__ = " + JSON.stringify(meta) + ";\n");
  root.folder("data").file("events_by_date.js", "window.__EVENTS_BY_DATE__ = " + JSON.stringify(built.eventsByDate) + ";\n");

  const blob = await zip.generateAsync({type:"blob", compression:"DEFLATE"});
  const safeName = calName.replace(/[^a-z0-9\-\_]+/gi,"_").slice(0,60) || "calendar_site";
  downloadBlob(blob, `${safeName}_static_calendar.zip`);
  setStatus("Done! ZIP downloaded. Unzip and open index.html.");
}

async function loadDemo(){
  loadedIcsName = "demo.ics";
  loadedIcsText = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Demo//EN
X-WR-CALNAME:Demo Calendar
BEGIN:VEVENT
UID:demo-1
DTSTART;VALUE=DATE:20260101
DTEND;VALUE=DATE:20260102
SUMMARY:All-day: New Year
DESCRIPTION:Demo description
END:VEVENT
BEGIN:VEVENT
UID:demo-2
DTSTART:20260217T170000Z
DTEND:20260217T180000Z
SUMMARY:Meeting (UTC example)
LOCATION:Somewhere
END:VEVENT
BEGIN:VEVENT
UID:demo-3
DTSTART:20260201T090000
DTEND:20260201T093000
RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=12
SUMMARY:Recurring check-in
END:VEVENT
END:VCALENDAR`;
  $("#buildBtn").disabled = false;
  setStatus("Loaded demo .ics. Click Generate ZIP.");
}

$("#icsFile").addEventListener("change", async (e)=>{
  const f = e.target.files && e.target.files[0];
  if(!f) return;
  loadedIcsName = f.name;
  setStatus("Reading file…");
  loadedIcsText = await readFileAsText(f);
  $("#buildBtn").disabled = false;

  const headerName = extractCalendarName(loadedIcsText);
  if(!$("#title").value.trim() && headerName) $("#title").value = headerName;

  setStatus(`Loaded: ${f.name} (ready).`);
});

$("#buildBtn").addEventListener("click", buildZip);
$("#demoBtn").addEventListener("click", loadDemo);

$("#titlesOnly").addEventListener("change", (e)=>{
  if(e.target.checked){
    $("#stripDescription").checked = true;
    $("#stripLocation").checked = true;
  }
});

export const DAY = 86400000;
export function parseDay(value) { return new Date(`${value}T00:00:00Z`); }
export function dayKey(date) { return date.toISOString().slice(0, 10); }
export function addDays(value, n) { return dayKey(new Date(parseDay(value).getTime() + n * DAY)); }
export function mondayOf(value) { const date = parseDay(value); return addDays(value, -((date.getUTCDay() + 6) % 7)); }
export function weeksOfMonth(month) {
  const first = `${month}-01`, date = parseDay(first);
  const last = dayKey(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)));
  const weeks = [];
  for (let week = mondayOf(first); week <= last; week = addDays(week, 7)) weeks.push(week);
  return weeks;
}
export function zonedParts(instant, timeZone = 'UTC') {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23' }).formatToParts(new Date(instant));
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
  return { date:`${p.year}-${p.month}-${p.day}`, minute:Number(p.hour) * 60 + Number(p.minute) };
}
export function bookingIsActive(status) { return status === 'scheduled'; }
export function statusMatches(status, filter) {
  if (filter === 'all') return true;
  if (filter === 'active') return bookingIsActive(status);
  if (filter === 'inactive') return !bookingIsActive(status);
  return status === filter;
}
export function rangeLabel(monday, withYear = true) {
  const friday = addDays(monday, 4), a = parseDay(monday), b = parseDay(friday);
  const month = d => d.toLocaleDateString('en-US', {month:'short',timeZone:'UTC'});
  const start = `${month(a)} ${a.getUTCDate()}`;
  const end = `${a.getUTCFullYear() !== b.getUTCFullYear() ? `${a.getUTCFullYear()} – ` : '– '}${a.getUTCMonth() !== b.getUTCMonth() ? `${month(b)} ` : ''}${b.getUTCDate()}`;
  return `${start} ${end}${withYear ? `, ${b.getUTCFullYear()}` : ''}`;
}
export function clockLabel(minutes) { const n = Math.round(minutes); return `${String(Math.floor(n / 60) % 24).padStart(2,'0')}:${String(n % 60).padStart(2,'0')}`; }
// Availability follows the scheduling functions' UTC and Monday=1 convention.
// A booking outside the working window still expands the visible timeline.
export function calendarTimeRange(events, availability, providerIds, monday, timeZone = 'UTC') {
  const days = Array.from({length:5},(_,i)=>addDays(monday,i));
  const starts = availability.filter(row=>providerIds.includes(row.provider_id) && row.weekday>=1 && row.weekday<=5).flatMap(row=>{
    if(!/^\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(row.start_time || '')) return [];
    const instant=Date.parse(`${addDays(monday,row.weekday-1)}T${row.start_time.length===5?row.start_time+':00':row.start_time}Z`);
    if(!Number.isFinite(instant)) return [];
    const local=zonedParts(instant,timeZone);
    return days.includes(local.date)?[local.minute]:[];
  });
  const candidates=[...starts,...events.map(event=>event.start)];
  const start=candidates.length?Math.min(...candidates):480;
  const end=Math.min(1440,Math.max(1080,Math.ceil((start+60)/60)*60,...events.map(event=>Math.ceil(event.end/60)*60)));
  return {start,end};
}
// Group overlapping intervals, then assign lanes. Touching endpoints do not overlap.
export function layoutEvents(events) {
  const sorted = [...events].sort((a,b) => a.start - b.start || b.end - a.end || String(a.id).localeCompare(String(b.id)));
  let group = [], end = -Infinity; const result = [];
  function flush() {
    const laneEnds = [];
    for (const event of group) {
      let lane = laneEnds.findIndex(time => time <= event.start);
      if (lane < 0) lane = laneEnds.length;
      laneEnds[lane] = event.end; event.lane = lane;
    }
    result.push(...group.map(event => ({...event, lanes:laneEnds.length}))); group = [];
  }
  for (const original of sorted) {
    const event = {...original};
    if (event.start >= end && group.length) { flush(); end = -Infinity; }
    group.push(event); end = Math.max(end, event.end);
  }
  if (group.length) flush();
  return result;
}
// Clip bookings to each visible day, preserving the appointment's actual duration.
export function appointmentsForWeek(appointments, personId, monday, status, timeZone, view = 'doctor') {
  if (!personId) return [];
  const personField = view === 'patient' ? 'patient_id' : 'provider_id';
  const days = Array.from({length:5},(_,i) => addDays(monday,i));
  return appointments.filter(a => a[personField] === personId && statusMatches(a.status,status)).flatMap(a => {
    const startTime = Date.parse(a.appointment_time), duration = Number(a.duration_minutes);
    if (!Number.isFinite(startTime) || !Number.isFinite(duration) || duration <= 0) return [];
    const start = zonedParts(startTime,timeZone), end = zonedParts(startTime + duration * 60000,timeZone);
    return days.filter(date => date >= start.date && (date < end.date || (date === end.date && end.minute > 0))).map(date => ({...a,date,start:date===start.date?start.minute:0,end:date===end.date?end.minute:1440}));
  });
}

import {addDays,dayKey,mondayOf,weeksOfMonth,zonedParts,rangeLabel,clockLabel,layoutEvents,appointmentsForWeek,parseDay,bookingIsActive,calendarTimeRange} from './calendar-utils.mjs';
import {createDatePickers} from './date-pickers.mjs';
import {mountAppointmentTestDetails} from './appointment-test-details.mjs';
import {fetchCalendar} from './calendar-data.mjs';

const $ = id => document.getElementById(id);
const config = window.PROSPER_CONFIG || {};
const timeZone = config.timeZone || 'UTC';
const currentDate = () => zonedParts(Date.now(), timeZone).date;
const defaultStatus = ['active','inactive','all'].includes(config.defaultStatus) ? config.defaultStatus : 'active';
const state = {data:null, view:'doctor', provider:null, patient:null, month:currentDate().slice(0,7), week:mondayOf(currentDate()), status:defaultStatus, options:[], optionIndex:0, loaded:false};
const datePickers=createDatePickers({
  getState:()=>state,currentDate,
  onMonthChange:(month,week)=>{state.month=month;setWeek(week || weeksOfMonth(month)[0]);},
  onWeekChange:setWeek,
});
const palette = [
  {bg:'#eaf3fa',border:'#d8e7f3',accent:'#3d80b6',text:'#275779'},
  {bg:'#e8f3ee',border:'#d2e7dc',accent:'#3a9471',text:'#2b6751'},
  {bg:'#eeeaf8',border:'#e0d9f0',accent:'#8d70bf',text:'#61488a'},
  {bg:'#fcf0dc',border:'#f1e2c2',accent:'#c39735',text:'#82601c'},
  {bg:'#ffede6',border:'#f8d8cb',accent:'#ef7752',text:'#a34b32'},
  {bg:'#e8f3f4',border:'#d2e7e9',accent:'#4999a3',text:'#2b6d75'},
];
const typeOrder = ['General Checkup','Follow-up','Consultation','Annual Physical','Urgent Care','Specialist Referral'];
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const personLabel = p => `${p.full_name} - ${p.id}`;
const selectedPerson = () => state.view === 'patient' ? state.patient : state.provider;
const people = () => (state.view === 'patient' ? state.data?.patients : state.data?.providers) || [];
const visibleAppointments = () => appointmentsForWeek(state.data.appointments,selectedPerson()?.id,state.week,state.status,timeZone,state.view);
const typeFor = a => state.data.visit_types.find(t => t.id === a.visit_type_id) || {name:'Other appointment'};
const patientName = a => a.patients?.full_name || 'Patient name unavailable';
const doctorName = a => state.data.providers.find(p=>p.id===a.provider_id)?.full_name || 'Doctor name unavailable';
const statusLabel = status => status === 'no_show' ? 'No-show' : status.charAt(0).toUpperCase() + status.slice(1);
const activityLabel = status => bookingIsActive(status) ? 'Active' : 'Not active';
function activityBadge(status) {
  const active=bookingIsActive(status);
  return `<span class="booking-state ${active?'is-active':'is-inactive'}"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.25"/><path d="${active?'m4.8 8 2 2 4.4-4.3':'M4.5 8h7'}"/></svg><span>${active?'Active':'Not active'}</span></span>`;
}
function colors(type) { return palette[Math.max(0,typeOrder.indexOf(type.name)) % palette.length]; }
function colorStyle(type) { const c=colors(type); return `--event-bg:${c.bg};--event-border:${c.border};--event-accent:${c.accent};--event-text:${c.text}`; }
function visibleTimeRange(events) {
  const providerIds=state.view==='doctor'?[state.provider?.id]:events.length?[...new Set(events.map(a=>a.provider_id))]:state.data.providers.map(p=>p.id);
  return calendarTimeRange(events,state.data.availability || [],providerIds,state.week,timeZone);
}
function revealBookings() {
  if(!state.data) return;
  const events=visibleAppointments(), range=visibleTimeRange(events);
  $('calendar-scroll').scrollTop=state.view==='patient' && events.length?Math.max(0,(Math.min(...events.map(a=>a.start))-range.start)*2-60):0;
}
function setWeek(week) { state.week=week; if (!weeksOfMonth(state.month).includes(week)) state.month=week.slice(0,7); render(); revealBookings(); }
function renderControls() {
  datePickers.update();
  $('status').value=state.status;
  const person=selectedPerson(), isPatient=state.view==='patient';
  $('view-doctor').setAttribute('aria-pressed',String(!isPatient));
  $('view-patient').setAttribute('aria-pressed',String(isPatient));
  $('view-hint').textContent=isPatient?'One patient, across all doctors':'One doctor’s schedule';
  $('person-label').innerHTML=`${isPatient?'Patient':'Doctor'} <span>name - ID</span>`;
  $('person-search').placeholder=`Search by ${state.view} name or ID…`;
  $('person-options').setAttribute('aria-label',isPatient?'Patients':'Doctors');
  $('person-search').disabled=!people().length;
  $('person-search').value=person?personLabel(person):'';
  $('person-search').title=person?personLabel(person):'';
  $('week-title').textContent=rangeLabel(state.week);
  $('timezone-note').textContent=`All times in ${timeZone} · Select an appointment for details`;
}
function render() {
  renderControls();
  if(!state.data) return;
  const events=visibleAppointments(), person=selectedPerson();
  const unique=[...new Map(events.map(a=>[a.id,a])).values()];
  const activeCount=unique.filter(a=>bookingIsActive(a.status)).length;
  const minutes=unique.filter(a=>bookingIsActive(a.status)).reduce((sum,a)=>sum+Number(a.duration_minutes),0);
  const totalDuration=minutes>=60 ? `${Math.floor(minutes/60)}h${minutes%60 ? ` ${minutes%60}m` : ''}` : `${minutes}m`;
  $('week-summary').innerHTML=unique.length ? `<strong>${activeCount} active · ${unique.length-activeCount} not active</strong><span>${activeCount?` &nbsp;·&nbsp; ${totalDuration} booked`:''} &nbsp;·&nbsp; ${escape(person.full_name)}${state.view==='patient'?' · All doctors':''}</span>` : `No ${state.status==='all'?'':state.status==='inactive'?'inactive ':'active '}appointments this week${person ? ` for ${escape(person.full_name)}`:''}.`;
  const days=Array.from({length:5},(_,i)=>addDays(state.week,i));
  $('day-headers').innerHTML=`<div class="timezone-cell" title="${escape(timeZone)}">${escape(timeZone==='UTC'?'UTC':timeZone.split('/').pop())}</div>`+days.map((d,i)=>`<div class="day-heading${d===currentDate()?' today':''}"><div><div class="day-name">${['Monday','Tuesday','Wednesday','Thursday','Friday'][i]}</div><div class="day-date"><span>${parseDay(d).getUTCDate()}</span></div></div><span class="day-count" title="${events.filter(a=>a.date===d).length} appointments">${events.filter(a=>a.date===d).length}</span></div>`).join('');
  const {start:startMinute,end:endMinute}=visibleTimeRange(events);
  const height=(endMinute-startMinute)*2;
  // A single scale keeps quarter-hour positions and duration heights exact.
  const grid=$('calendar-grid'); grid.style.setProperty('--hour-height','120px'); grid.style.height=`${height}px`;
  const timeLabels=[startMinute];
  for(let minute=(Math.floor(startMinute/60)+1)*60;minute<endMinute;minute+=60) timeLabels.push(minute);
  let markup=`<div class="time-column">${timeLabels.map(minute=>`<span class="hour-label" style="top:${(minute-startMinute)*2}px">${clockLabel(minute)}</span>`).join('')}</div>`;
  for (const date of days) {
    const dayEvents=layoutEvents(events.filter(a=>a.date===date));
    markup+=`<div class="day-column${date===currentDate()?' today':''}" aria-label="${escape(date)}" style="background-position-y:-${(startMinute%60)*2}px">`;
    for(const a of dayEvents) {
      const type=typeFor(a), duration=a.end-a.start, short=duration<=15, compact=duration<=30;
      const actualStart=zonedParts(a.appointment_time,timeZone), actualEnd=zonedParts(Date.parse(a.appointment_time)+a.duration_minutes*60000,timeZone);
      const time=`${clockLabel(actualStart.minute)}–${clockLabel(actualEnd.minute)}`;
      const active=bookingIsActive(a.status);
      const label=`${activityLabel(a.status)}: ${patientName(a)}, ${doctorName(a)}, ${type.name}, ${date}, ${time}, ${a.duration_minutes} minutes`;
      markup+=`<button class="event${short?' short':compact?' compact':''} ${active?'is-active':'is-inactive'}" data-appointment="${escape(a.id)}" aria-label="${escape(label)}" title="${escape(label)}" style="${colorStyle(type)};top:${(a.start-startMinute)*2+2}px;height:${Math.max(20,duration*2-4)}px;left:calc(${a.lane/a.lanes*100}% + 5px);width:calc(${100/a.lanes}% - 10px)">${activityBadge(a.status)}<span class="event-name">${escape(state.view==='patient'?doctorName(a):patientName(a))}</span><span class="event-meta">${short?`${a.duration_minutes}m`:`${time} · ${a.duration_minutes}m`}</span>${!compact?`<span class="event-type">${escape(type.name)}</span>`:''}</button>`;
    }
    const now=zonedParts(Date.now(),timeZone);
    if(date===now.date && now.minute>=startMinute && now.minute<endMinute) markup+=`<div class="now-line" title="Current time" style="top:${(now.minute-startMinute)*2}px"></div>`;
    markup+='</div>';
  }
  grid.innerHTML=markup;
  $('legend').innerHTML=[...state.data.visit_types].sort((a,b)=>typeOrder.indexOf(a.name)-typeOrder.indexOf(b.name)).map(t=>`<span class="legend-item" style="${colorStyle(t)}"><span class="legend-swatch"></span>${escape(t.name)}</span>`).join('');
  $('calendar').setAttribute('aria-busy','false');
}
function closePicker() { $('person-options').hidden=true; $('person-search').setAttribute('aria-expanded','false'); $('person-search').removeAttribute('aria-activedescendant'); const person=selectedPerson(); $('person-search').value=person?personLabel(person):''; }
function showPicker(query='') {
  if(!state.data) return;
  state.options=people().filter(p=>personLabel(p).toLowerCase().includes(query.toLowerCase())); state.optionIndex=0;
  $('person-options').hidden=false; $('person-search').setAttribute('aria-expanded','true'); renderOptions();
}
function renderOptions() {
  $('person-options').innerHTML=state.options.length ? state.options.map((p,i)=>`<div id="person-option-${i}" class="doctor-option" role="option" aria-selected="${i===state.optionIndex}" data-person="${escape(p.id)}">${escape(personLabel(p))}</div>`).join('') : `<div class="picker-empty">No ${state.view==='patient'?'patients':'doctors'} match your search.</div>`;
  if(state.options.length) { $('person-search').setAttribute('aria-activedescendant',`person-option-${state.optionIndex}`); $(`person-option-${state.optionIndex}`).scrollIntoView({block:'nearest'}); }
  else $('person-search').removeAttribute('aria-activedescendant');
}
function choosePerson(id) { state[state.view==='patient'?'patient':'provider']=people().find(p=>p.id===id); closePicker(); render(); revealBookings(); }
function setView(view) { closePicker(); state.view=view; render(); revealBookings(); }
function openDetails(id) {
  const a=state.data.appointments.find(a=>a.id===id); if(!a) return;
  const patient=state.data.patients.find(p=>p.id===a.patient_id);
  const type=typeFor(a), provider=state.data.providers.find(p=>p.id===a.provider_id), start=zonedParts(a.appointment_time,timeZone), end=zonedParts(Date.parse(a.appointment_time)+a.duration_minutes*60000,timeZone);
  $('detail-name').textContent=patientName(a);
  const date=new Date(a.appointment_time).toLocaleDateString('en-US',{timeZone,weekday:'long',month:'long',day:'numeric',year:'numeric'});
  $('appointment-details').innerHTML=`<span class="detail-type" style="${colorStyle(type)}"><span class="legend-swatch"></span>${escape(type.name)}</span><dl class="detail-list"><div class="detail-row"><dt>Birthdate</dt><dd>${escape(patient?.date_of_birth || 'Not available')}</dd></div><div class="detail-row"><dt>Date</dt><dd>${escape(date)}</dd></div><div class="detail-row"><dt>Time</dt><dd>${clockLabel(start.minute)}–${clockLabel(end.minute)}${end.date!==start.date?` (${escape(end.date)})`:''} <small>${escape(timeZone)} · ${a.duration_minutes} minutes</small></dd></div><div class="detail-row"><dt>Doctor</dt><dd>${escape(provider?.full_name || 'Unknown doctor')}</dd></div><div class="detail-row"><dt>Status</dt><dd>${activityBadge(a.status)}<small>${escape(statusLabel(a.status))}</small></dd></div></dl>${a.status==='rescheduled'?'<p class="history-note">This is the original appointment retained as history after rescheduling.</p>':''}`;
  const testDetails=document.createElement('div');
  $('appointment-details').append(testDetails);
  mountAppointmentTestDetails(testDetails,a,patient);
  $('appointment-dialog').showModal();
  $('appointment-dialog').scrollTop=0;
}
async function loadData() {
  $('refresh').disabled=true; $('calendar').setAttribute('aria-busy','true'); $('connection-label').textContent='Updating schedule…'; $('error').hidden=true;
  try {
    const data=await fetchCalendar(config);
    state.data=data;
    state.provider=data.providers.find(p=>p.id===state.provider?.id) || data.providers.find(p=>appointmentsForWeek(data.appointments,p.id,state.week,state.status,timeZone).length) || data.providers[0] || null;
    state.patient=data.patients.find(p=>p.id===state.patient?.id) || data.patients.find(p=>appointmentsForWeek(data.appointments,p.id,state.week,state.status,timeZone,'patient').length) || data.patients[0] || null;
    $('connection-label').textContent=`${data.meta?.source==='Demo'?'Sample appointments':data.meta?.source==='Snapshot'?'Saved snapshot':'Connected to Supabase'} · ${new Date(data.meta?.fetched_at || Date.now()).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone})} ${timeZone}`;
    render();
    if(!state.loaded) revealBookings();
    state.loaded=true;
  } catch(error) {
    $('connection-label').textContent=state.data?'Connection interrupted':'Unable to connect';
    $('error').hidden=false;
    $('error').textContent=state.data ? 'The schedule could not refresh. The previously loaded appointments are still shown. Use Refresh to try again.' : config.dataSource==='windmill' ? 'The live calendar could not be loaded. Check the Windmill calendar_feed endpoint and its script-specific token, then select Refresh.' : 'Appointments could not be loaded. Start the local preview server, or set a calendar data URL for your hosted site, then select Refresh.';
    if(!state.data) { $('week-summary').textContent='The schedule is unavailable.'; $('calendar-grid').innerHTML='<p class="loading-grid">Your appointments will appear here once connected.</p>'; }
  } finally { $('refresh').disabled=false; $('calendar').setAttribute('aria-busy','false'); }
}
$('person-search').addEventListener('focus',()=>{ $('person-search').select(); showPicker(); });
$('person-search').addEventListener('click',()=>{if($('person-options').hidden) showPicker();});
$('person-search').addEventListener('input',e=>showPicker(e.target.value));
$('person-search').addEventListener('keydown',e=>{
  if(e.key==='Escape'){closePicker();return;}
  if(e.key==='Tab'){closePicker();return;}
  if(['ArrowDown','ArrowUp'].includes(e.key)) { e.preventDefault(); if($('person-options').hidden){showPicker();return;} if(!state.options.length)return; state.optionIndex=(state.optionIndex+(e.key==='ArrowDown'?1:-1)+state.options.length)%state.options.length; renderOptions(); }
  if(e.key==='Enter'&&!$('person-options').hidden){e.preventDefault();if(state.options[state.optionIndex])choosePerson(state.options[state.optionIndex].id);}
});
$('person-options').addEventListener('mousedown',e=>e.preventDefault());
$('person-options').addEventListener('click',e=>{const option=e.target.closest('[data-person]');if(option)choosePerson(option.dataset.person);});
$('view-doctor').addEventListener('click',()=>setView('doctor'));
$('view-patient').addEventListener('click',()=>setView('patient'));
document.addEventListener('pointerdown',e=>{if(!$('person-picker').contains(e.target))closePicker();});
$('status').addEventListener('change',e=>{state.status=e.target.value;render();revealBookings();});
$('previous').addEventListener('click',()=>setWeek(addDays(state.week,-7)));
$('next').addEventListener('click',()=>setWeek(addDays(state.week,7)));
$('today').addEventListener('click',()=>{state.month=currentDate().slice(0,7);setWeek(mondayOf(currentDate()));});
$('refresh').addEventListener('click',loadData);
$('calendar-grid').addEventListener('click',e=>{const event=e.target.closest('[data-appointment]');if(event)openDetails(event.dataset.appointment);});
$('close-dialog').addEventListener('click',()=>$('appointment-dialog').close());
$('done-dialog').addEventListener('click',()=>$('appointment-dialog').close());
$('appointment-dialog').addEventListener('click',e=>{if(e.target===$('appointment-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
renderControls();
loadData();

// Progressive enhancement: the calendar works in browsers without WebMCP.
if (navigator.modelContext?.registerTool) {
  navigator.modelContext.registerTool({
    name:'filter_calendar',
    description:'Show this calendar for a doctor or a patient across all doctors. Set exactly one of provider_id or patient_id. This changes the view only; it never changes appointments.',
    inputSchema:{type:'object',properties:{provider_id:{type:'string'},patient_id:{type:'string'},date:{type:'string',description:'A date in the desired week, YYYY-MM-DD'},status:{type:'string',enum:['active','inactive','all']}},required:['date'],additionalProperties:false},
    execute:async ({provider_id,patient_id,date,status}) => {
      const view=patient_id?'patient':'doctor';
      const person=(view==='patient'?state.data?.patients:state.data?.providers)?.find(p=>p.id===(patient_id || provider_id));
      if(Boolean(provider_id)===Boolean(patient_id) || !person || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parseDay(date).getTime()) || dayKey(parseDay(date))!==date) return {content:[{type:'text',text:'Choose exactly one loaded doctor or patient and a valid YYYY-MM-DD date.'}],isError:true};
      closePicker();state.view=view;state[view==='patient'?'patient':'provider']=person;state.month=date.slice(0,7);state.status=status || state.status;setWeek(mondayOf(date));
      return {content:[{type:'text',text:JSON.stringify({view,person:personLabel(person),week:state.week,status:state.status,timeZone})}]};
    },
  });
}

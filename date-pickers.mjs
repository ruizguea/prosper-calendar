import {weeksOfMonth,rangeLabel,mondayOf} from './calendar-utils.mjs';

const monthNames=['January','February','March','April','May','June','July','August','September','October','November','December'];
const monthLabel=value=>`${monthNames[Number(value.slice(5))-1]} ${value.slice(0,4)}`;
const arrow=direction=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${direction==='left'?'m14 6-6 6 6 6':'m10 6 6 6-6 6'}"/></svg>`;
const check='<svg class="selection-check" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';

export function createDatePickers({getState,currentDate,onMonthChange,onWeekChange}) {
  const $=id=>document.getElementById(id);
  let open=null, year=Number(getState().month.slice(0,4));

  function close(restoreFocus=false) {
    if(!open) return;
    const kind=open;
    open=null;
    $(`${kind}-popover`).hidden=true;
    $(kind).setAttribute('aria-expanded','false');
    if(restoreFocus) $(kind).focus({preventScroll:true});
  }

  function position() {
    if(!open) return;
    const panel=$(`${open}-popover`), anchor=$(open).getBoundingClientRect();
    const safeTop=document.querySelector('.topbar').getBoundingClientRect().bottom+8;
    if(anchor.bottom<safeTop || anchor.top>window.innerHeight-16) { close(); return; }
    const below=window.innerHeight-anchor.bottom-24, above=anchor.top-safeTop-8;
    const naturalHeight=panel.scrollHeight;
    const placeAbove=below<Math.min(naturalHeight,280) && above>below;
    panel.style.maxHeight=`${Math.max(120,placeAbove?above:below)}px`;
    const left=open==='week'?anchor.right-panel.offsetWidth:anchor.left;
    panel.style.left=`${Math.max(16,Math.min(left,window.innerWidth-panel.offsetWidth-16))}px`;
    panel.style.top=`${placeAbove?Math.max(safeTop,anchor.top-panel.offsetHeight-8):anchor.bottom+8}px`;
  }

  function renderMonth() {
    const selected=getState().month, today=currentDate().slice(0,7);
    $('month-popover').innerHTML=`<div class="date-popup-heading"><span class="date-kicker">CHOOSE A MONTH</span><div class="year-navigation"><button type="button" class="icon-button" data-year-step="-1" aria-label="Previous year" ${year<=100?'disabled':''}>${arrow('left')}</button><strong aria-live="polite">${year}</strong><button type="button" class="icon-button" data-year-step="1" aria-label="Next year" ${year>=9999?'disabled':''}>${arrow('right')}</button></div></div><div class="month-grid" role="group" aria-label="Months in ${year}">${monthNames.map((name,i)=>{
      const value=`${String(year).padStart(4,'0')}-${String(i+1).padStart(2,'0')}`;
      return `<button type="button" class="month-option${value===today?' is-current':''}" data-month="${value}" aria-label="${name} ${year}" aria-pressed="${value===selected}" ${value===today?'aria-current="date"':''}>${name.slice(0,3)}</button>`;
    }).join('')}</div><div class="date-popup-footer"><span class="current-month-key"><i aria-hidden="true"></i>Current month</span><button type="button" class="date-shortcut" data-this-month>This month</button></div>`;
  }

  function renderWeek() {
    const {month,week}=getState(), current=mondayOf(currentDate());
    $('week-popover').innerHTML=`<div class="date-popup-heading week-popup-heading"><div><span class="date-kicker">CHOOSE A WEEK</span><strong>${monthLabel(month)}</strong></div><span class="week-days-caption">MON – FRI</span></div><div id="week-options" class="week-options" role="listbox" aria-label="Weeks in ${monthLabel(month)}">${weeksOfMonth(month).map((value,i)=>`<button type="button" class="week-option${value===current?' is-current':''}" role="option" aria-selected="${value===week}" data-week="${value}" tabindex="${value===week?0:-1}" aria-label="${rangeLabel(value)}"><span class="week-index" aria-hidden="true">${String(i+1).padStart(2,'0')}</span><span class="week-range">${rangeLabel(value,false)}</span>${check}</button>`).join('')}</div>`;
  }

  function show(kind,last=false) {
    if(open===kind) { close(true); return; }
    close();
    open=kind;
    if(kind==='month') { year=Number(getState().month.slice(0,4)); renderMonth(); }
    else renderWeek();
    $(`${kind}-popover`).hidden=false;
    $(kind).setAttribute('aria-expanded','true');
    position();
    const options=[...$(`${kind}-popover`).querySelectorAll(kind==='month'?'[data-month]':'[data-week]')];
    const selected=options.find(option=>option.getAttribute(kind==='month'?'aria-pressed':'aria-selected')==='true');
    (last?options.at(-1):selected || options[0])?.focus({preventScroll:true});
  }

  for(const kind of ['month','week']) {
    $(kind).addEventListener('click',()=>show(kind));
    $(kind).addEventListener('keydown',event=>{
      if(['ArrowDown','ArrowUp'].includes(event.key)) { event.preventDefault(); if(!open) show(kind,event.key==='ArrowUp'); }
    });
    $(`${kind}-popover`).addEventListener('keydown',event=>{
      if(event.key==='Escape') { event.preventDefault();event.stopPropagation();close(true);return; }
      const selector=kind==='month'?'[data-month]':'[data-week]';
      const options=[...event.currentTarget.querySelectorAll(selector)], index=options.indexOf(document.activeElement);
      if(index<0) return;
      const step=kind==='month'?3:1;
      const moves={ArrowDown:index+step,ArrowUp:index-step,ArrowRight:index+1,ArrowLeft:index-1,Home:0,End:options.length-1};
      if(event.key in moves) {
        event.preventDefault();
        const target=options[Math.max(0,Math.min(options.length-1,moves[event.key]))];
        if(kind==='week') options.forEach(option=>option.tabIndex=option===target?0:-1);
        target.focus({preventScroll:true});
        target.scrollIntoView({block:'nearest'});
      }
    });
  }

  $('month-popover').addEventListener('click',event=>{
    const step=event.target.closest('[data-year-step]');
    if(step) {
      const direction=Number(step.dataset.yearStep);
      year=Math.max(100,Math.min(9999,year+direction));renderMonth();position();
      const next=$('month-popover').querySelector(`[data-year-step="${direction}"]`);
      (next.disabled?$('month-popover').querySelector('[data-month]'):next).focus({preventScroll:true});
      return;
    }
    const month=event.target.closest('[data-month]');
    if(month) { close(true);onMonthChange(month.dataset.month); }
    if(event.target.closest('[data-this-month]')) { close(true);onMonthChange(currentDate().slice(0,7),mondayOf(currentDate())); }
  });
  $('week-popover').addEventListener('click',event=>{
    const week=event.target.closest('[data-week]');
    if(week) { close(true);onWeekChange(week.dataset.week); }
  });
  document.addEventListener('pointerdown',event=>{if(open && !$(`${open}-picker`).contains(event.target)) close();});
  document.addEventListener('focusin',event=>{if(open && !$(`${open}-picker`).contains(event.target)) close();});
  document.addEventListener('scroll',event=>{if(open && !$(`${open}-popover`).contains(event.target)) position();},true);
  window.addEventListener('resize',position);

  return {
    update() {
      const {month,week}=getState();
      $('month-value').textContent=monthLabel(month);
      $('month').title=monthLabel(month);
      $('week-value').textContent=rangeLabel(week,false);
      $('week').title=rangeLabel(week);
    },
  };
}

import {appointmentTestDetails, functionInput, proposedSlot} from './function-inputs.mjs';

const copyIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>';
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function mountAppointmentTestDetails(container, appointment, patient) {
  const details = appointmentTestDetails(appointment, patient);
  const fields = [
    ['patient_id', 'Patient ID'],
    ['date_of_birth', 'Date of birth'],
    ['existing_appointment_id', 'Appointment ID'],
    ['provider_id', 'Doctor ID'],
    ['appointment_time', 'Start · UTC'],
    ['appointment_end', 'End · UTC · calculated'],
    ['duration_minutes', 'Duration · minutes'],
  ];
  container.innerHTML = `
    <section class="test-details" aria-labelledby="test-details-heading">
      <div class="test-section-heading"><div><h3 id="test-details-heading">Copy booking details</h3><p>Exact IDs and times for your function tests.</p></div><button type="button" class="copy-button" data-copy="all" aria-label="Copy all booking details as JSON">${copyIcon}<span>Copy all</span></button></div>
      <dl class="copy-fields">${fields.map(([key,label])=>`<div class="copy-field"><dt>${label}<small>${key}</small></dt><dd><code id="test-${key}" tabindex="0">${escape(details[key] ?? 'Not available')}</code><button type="button" class="copy-button copy-value" data-copy="${key}" aria-label="Copy ${key}" title="Copy ${key}"${details[key] == null ? ' disabled' : ''}>${copyIcon}<span>Copy</span></button></dd></div>`).join('')}</dl>
      <details class="function-inputs">
        <summary><span><strong>Function inputs</strong><small>Ready-to-copy JSON for all four functions</small></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></summary>
        <div class="function-body">
          <label for="test-function">Choose a function</label>
          <select id="test-function">
            <option value="lookup_patient">1. lookup_patient</option>
            <option value="get_upcoming_appointment">2. get_upcoming_appointment</option>
            <option value="check_availability">3. check_availability</option>
            <option value="reschedule_appointment">4. reschedule_appointment</option>
          </select>
          <div id="proposed-slot-field" hidden>
            <label for="proposed-slot">Proposed new start <span>UTC</span></label>
            <input id="proposed-slot" type="datetime-local" step="1" aria-describedby="slot-hint">
            <p id="slot-hint" class="function-note">Enter the new time to test. Functions require a future time; availability has not been checked.</p>
          </div>
          <p id="function-note" class="function-note"></p>
          <div class="json-heading"><span>JSON INPUT</span><button type="button" class="copy-button" data-copy="function" aria-label="Copy function JSON">${copyIcon}<span>Copy JSON</span></button></div>
          <pre id="function-json" tabindex="0" aria-label="Function input JSON"></pre>
          <p class="function-footnote">Copying prepares inputs only. Run the function in your testing tool.</p>
        </div>
      </details>
      <p class="copy-feedback" role="status" aria-live="polite"></p>
    </section>`;

  const selector = container.querySelector('#test-function');
  const slotField = container.querySelector('#proposed-slot');
  const json = container.querySelector('#function-json');
  const feedback = container.querySelector('.copy-feedback');
  let payload = null;
  function updateInput() {
    const name = selector.value;
    const needsSlot = ['check_availability','reschedule_appointment'].includes(name);
    container.querySelector('#proposed-slot-field').hidden = !needsSlot;
    payload = functionInput(name, details, proposedSlot(slotField.value));
    json.textContent = payload ? JSON.stringify(payload, null, 2) : needsSlot ? 'Choose a proposed new start above to generate the JSON.' : 'Patient name or date of birth is missing from this data source. Refresh or re-export the snapshot to include it.';
    container.querySelector('[data-copy="function"]').disabled = !payload;
    container.querySelector('#function-note').textContent = name === 'lookup_patient'
      ? 'Uses the exact patient name and date of birth (YYYY-MM-DD).'
      : name === 'get_upcoming_appointment'
        ? 'Returns this patient’s next future scheduled appointment, which may differ from the booking you clicked.'
        : name === 'check_availability'
          ? 'Uses this booking’s doctor, appointment ID and recorded duration.'
          : `Check availability before running reschedule_appointment. ${details.status === 'scheduled' ? 'Running it changes the booking and creates a replacement.' : `This booking is ${details.status}; rescheduling requires a scheduled booking.`}`;
    feedback.textContent = '';
  }
  selector.addEventListener('change', updateInput);
  slotField.addEventListener('input', updateInput);
  container.onclick = async event => {
    const button = event.target.closest('[data-copy]');
    if (!button || button.disabled) return;
    const key = button.dataset.copy;
    const value = key === 'all' ? JSON.stringify(details,null,2) : key === 'function' ? JSON.stringify(payload,null,2) : String(details[key]);
    const label = key === 'all' ? 'Booking details' : key === 'function' ? 'Function JSON' : key;
    feedback.textContent = '';
    try {
      await navigator.clipboard.writeText(value);
      feedback.textContent = `${label} copied.`;
      const caption = button.querySelector('span'), original = key === 'all' ? 'Copy all' : key === 'function' ? 'Copy JSON' : 'Copy';
      clearTimeout(button.copyFeedbackTimer);
      caption.textContent = 'Copied';
      button.copyFeedbackTimer = setTimeout(()=>{caption.textContent=original;},1600);
    } catch {
      feedback.textContent = 'Clipboard is unavailable. Copy the selected text below.';
      let manual = container.querySelector('.manual-copy');
      if (!manual) {
        manual = document.createElement('textarea');
        manual.className = 'manual-copy';
        manual.readOnly = true;
        manual.setAttribute('aria-label','Text to copy manually');
        feedback.after(manual);
      }
      manual.value = value;
      manual.focus();
      manual.select();
    }
  };
  updateInput();
}

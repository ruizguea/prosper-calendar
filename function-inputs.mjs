// Match the parameter names and UTC timestamp format in prosper_functions.md.
export function functionTimestamp(value) {
  if (typeof value === 'string' && !/(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) {
    throw new RangeError('A timezone is required.');
  }
  return new Date(value).toISOString().replace(/\.000Z$/, '+00:00').replace(/Z$/, '+00:00');
}

export function proposedSlot(value) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value)) return null;
  const normalized = value.length === 16 ? `${value}:00` : value;
  try {
    const timestamp = functionTimestamp(`${normalized}+00:00`);
    return timestamp === `${normalized}+00:00` ? timestamp : null;
  } catch { return null; }
}

export function appointmentTestDetails(appointment, patient) {
  return {
    patient_id: appointment.patient_id,
    existing_appointment_id: appointment.id,
    provider_id: appointment.provider_id,
    appointment_time: functionTimestamp(appointment.appointment_time),
    appointment_end: functionTimestamp(Date.parse(appointment.appointment_time) + Number(appointment.duration_minutes) * 60000),
    duration_minutes: Number(appointment.duration_minutes),
    full_name: patient?.full_name || appointment.patients?.full_name || null,
    date_of_birth: patient?.date_of_birth || null,
    visit_type_id: appointment.visit_type_id,
    status: appointment.status,
  };
}

export function functionInput(name, details, slot) {
  switch (name) {
    case 'lookup_patient':
      return details.full_name && details.date_of_birth
        ? {full_name: details.full_name, date_of_birth: details.date_of_birth} : null;
    case 'get_upcoming_appointment':
      return {patient_id: details.patient_id};
    case 'check_availability':
      return slot ? {provider_id: details.provider_id, duration_minutes: details.duration_minutes, existing_appointment_id: details.existing_appointment_id, new_slot: functionTimestamp(slot)} : null;
    case 'reschedule_appointment':
      return slot ? {existing_appointment_id: details.existing_appointment_id, new_slot_start: functionTimestamp(slot)} : null;
    default: return null;
  }
}

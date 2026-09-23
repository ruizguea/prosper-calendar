# Prosper calendar

A read-only calendar with live Supabase data through Windmill.

Upload these files to the repository root, keeping `assets/prosper-logo.svg` in its folder. In GitHub Settings → Pages, select Deploy from a branch, main, / (root).

The calendar fetches current data on page load and Refresh. Doctor, patient, month, week and status filters use the loaded records. No calendar-data.json snapshot is needed; remove that file if it was uploaded previously.

`config.js` contains only the webhook-specific token restricted to the read-only `u/ruizguea/calendar_feed` script. This public token reads the approved mock calendar. Supabase credentials stay in Windmill; never add a Supabase key or general Windmill account token to this repository.

The synchronous Windmill reader returns current providers, patients (including birthdates), appointment types, availability and bookings. Copying appointment details or function inputs never changes a booking.

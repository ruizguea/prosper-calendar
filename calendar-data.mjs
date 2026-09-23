// A Windmill token used here must be scoped ONLY to the read-only calendar script.
// Never use a Supabase service-role key or a general Windmill account token.
export async function fetchCalendar(config, fetcher = fetch) {
  const url = config.dataUrl || './api/calendar';
  const options = {cache:'no-store', signal:AbortSignal.timeout(45000)};
  if (config.dataSource === 'windmill') {
    const endpoint = new URL(url);
    if (endpoint.protocol !== 'https:' || endpoint.hostname !== 'app.windmill.dev'
        || !/^\/api\/w\/[^/]+\/jobs\/run_wait_result\/p\/u\/[^/]+\/calendar_feed$/.test(endpoint.pathname)
        || endpoint.search || endpoint.hash || endpoint.username || endpoint.password || endpoint.port
        || typeof config.calendarReadToken !== 'string' || !config.calendarReadToken || /\s/.test(config.calendarReadToken) || config.calendarReadToken.startsWith('eyJ')
        || config.calendarReadToken.startsWith('sb_secret_')) {
      throw new Error('Invalid read-only calendar configuration');
    }
    options.method = 'POST';
    options.headers = {'Content-Type':'application/json', Authorization:`Bearer ${config.calendarReadToken}`};
    options.body = '{}';
  }
  const response = await fetcher(url, options);
  if (!response.ok) throw new Error('Calendar request failed');
  const data = await response.json();
  if (!['providers','patients','visit_types','appointments'].every(key => Array.isArray(data[key]))) {
    throw new Error('Unexpected calendar response');
  }
  return data;
}

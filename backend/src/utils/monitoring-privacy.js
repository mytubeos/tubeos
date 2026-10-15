const stripQuery = (value) => (typeof value === 'string' ? value.split(/[?#]/)[0] : value);
const sanitizeMonitoringEvent = (event) => {
  if (event.request)
    event.request = { method: event.request.method, url: stripQuery(event.request.url) };
  if (event.transaction) event.transaction = stripQuery(event.transaction);
  for (const span of event.spans || []) {
    if (span.description) span.description = stripQuery(span.description);
    delete span.data;
  }
  delete event.user;
  delete event.extra;
  for (const breadcrumb of event.breadcrumbs || []) {
    if (breadcrumb.data)
      breadcrumb.data = {
        method: breadcrumb.data.method,
        url: stripQuery(breadcrumb.data.url),
        status_code: breadcrumb.data.status_code,
      };
  }
  for (const entry of event.exception?.values || []) {
    if (entry.value) entry.value = entry.value.replace(/https?:\/\/[^\s]+/g, stripQuery);
  }
  return event;
};
module.exports = { sanitizeMonitoringEvent };

export function formatTime(value: string, timeZone?: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }
  const options: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit"
  };
  if (timeZone) {
    options.timeZone = timeZone;
  }
  return date.toLocaleTimeString("en-US", options);
}

export function formatDate(value: string, timeZone?: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }
  const options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric"
  };
  if (timeZone) {
    options.timeZone = timeZone;
  }
  return date.toLocaleDateString("en-US", options);
}

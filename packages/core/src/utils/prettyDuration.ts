export function prettyDuration(duration: number) {
  if (duration < 1000) {
    return `${Math.floor(duration)}ms`;
  }

  const hours = Math.floor(duration / (1000 * 60 * 60));
  const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((duration % (1000 * 60)) / 1000);
  const milliseconds = Math.floor(duration % 1000);

  let result = "";

  if (hours > 0) {
    result += `${hours}h`;
  }
  if (minutes > 0) {
    result += `${minutes}m`;
  }
  if (seconds > 0) {
    result += `${seconds}s`;
  }
  if (milliseconds > 0) {
    result += `${milliseconds}ms`;
  }

  return result;
}

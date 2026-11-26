// A stronger overlapping bonus takes precedence within the same activity.
function boostedDuration(start, end, windows) {
  if (end <= start) return 0;
  const boundaries = [start, end];
  for (const {starts_at, expires_at} of windows) {
    if (starts_at > start && starts_at < end) boundaries.push(starts_at);
    if (expires_at > start && expires_at < end) boundaries.push(expires_at);
  }
  boundaries.sort((a,b) => a-b);
  let duration = 0;
  for (let index=1; index<boundaries.length; index++) {
    const from=boundaries[index-1], to=boundaries[index];
    const percent=windows.reduce((maximum,window) => window.starts_at<=from && window.expires_at>from
      ? Math.max(maximum,window.percent) : maximum,0);
    duration += (to-from)*(100+percent);
  }
  return duration/100;
}
module.exports = {boostedDuration};

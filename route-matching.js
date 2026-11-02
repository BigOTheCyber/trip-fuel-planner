// Geometry is ordered in the trip direction. Distances are kilometres.
(function (root) {
  function validPoint(p) {
    return p && Number.isFinite(p.lat) && Number.isFinite(p.lng) &&
      Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180 && p.lat !== 0 && p.lng !== 0;
  }
  function project(lat, lng, points, options = {}) {
    if (!validPoint({lat, lng}) || points.length < 2) return null;
    const candidates = [];
    const sx = 111.2 * Math.cos(lat * Math.PI / 180);
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      if (!validPoint(a) || !validPoint(b) || !(b.km > a.km)) continue;
      const ax = (a.lng - lng) * sx, ay = (a.lat - lat) * 111.2;
      const dx = (b.lng - a.lng) * sx, dy = (b.lat - a.lat) * 111.2;
      const length2 = dx * dx + dy * dy;
      if (length2 < 1e-10) continue;
      const rawT = -(ax * dx + ay * dy) / length2;
      // Do not snap points beyond the route endpoints onto the first/last station.
      if ((i === 1 && rawT < 0 && Math.sqrt(length2) * -rawT > 0.1) ||
          (i === points.length - 1 && rawT > 1 && Math.sqrt(length2) * (rawT - 1) > 0.1)) continue;
      const t = Math.max(0, Math.min(1, rawT));
      const offsetKm = Math.hypot(ax + t * dx, ay + t * dy);
      let score = offsetKm;
      if (Number.isFinite(options.heading) && options.speed >= 2) {
        const bearing = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
        const angle = Math.abs(((options.heading - bearing + 540) % 360) - 180);
        if (angle > 100) continue;
        score += angle / 180 * 0.05;
      }
      candidates.push({km: a.km + t * (b.km - a.km), offsetKm, score});
    }
    candidates.sort((a, b) => a.score - b.score);
    const best = candidates[0];
    if (!best || best.offsetKm > (options.maxOffsetKm ?? 0.15)) return null;
    // Close parallel/looping sections with different progress are ambiguous.
    if (candidates.some(c => Math.abs(c.km - best.km) > 0.5 &&
      c.score <= best.score + 0.025)) return null;
    return best;
  }
  const api = {project, validPoint};
  if (typeof module !== 'undefined') module.exports = api;
  else root.RouteMatching = api;
})(globalThis);

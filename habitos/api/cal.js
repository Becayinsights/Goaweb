// Lee los calendarios de la persona (enlace iCal de Google o calendario público de iCloud)
// y devuelve sus eventos de los próximos días, con los repetidos ya desplegados. Solo lectura.
// POST { urls: [..], tz: 'Europe/Madrid', from: 'YYYY-MM-DD', days: 2 }
import { auth, fail, bad } from './_lib.js';
export const config = { maxDuration: 20 };

// solo Google e iCloud: el servidor no descarga direcciones cualesquiera
const OK = /^(?:https?|webcal):\/\/(?:calendar\.google\.com|[\w-]+\.icloud\.com)\//i;
const DAY = 864e5;
const WD = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

// ---------- zonas horarias ----------
function tzOffset(ms, tz) {          // minutos de diferencia de la zona con UTC en ese instante
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .formatToParts(ms).map(x => [x.type, x.value]));
  return (Date.UTC(+p.year, p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - ms) / 6e4;
}
const validTz = tz => { try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true; } catch { return false; } };
function wallToUtc(y, m, d, h, mi, tz) {   // hora «de reloj» en una zona → instante
  const guess = Date.UTC(y, m, d, h, mi);
  let ms = guess - tzOffset(guess, tz) * 6e4;
  return guess - tzOffset(ms, tz) * 6e4;
}
function local(ms, tz) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(ms).map(x => [x.type, x.value]));
  return { d: `${p.year}-${p.month}-${p.day}`, h: `${p.hour % 24 < 10 ? '0' : ''}${+p.hour % 24}:${p.minute}` };
}

// ---------- lectura del .ics ----------
function parseICS(txt) {
  const lines = txt.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/);
  const evs = []; let cur = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = { ex: [] }; continue; }
    if (line === 'END:VEVENT') { if (cur) evs.push(cur); cur = null; continue; }
    if (!cur) continue;
    const i = line.indexOf(':'); if (i < 0) continue;
    const [name, ...params] = line.slice(0, i).split(';'), val = line.slice(i + 1);
    const prm = Object.fromEntries(params.map(p => p.split('=')));
    const key = name.toUpperCase();
    if (key === 'SUMMARY') cur.t = val.replace(/\\n/g, ' ').replace(/\\([,;\\])/g, '$1').trim();
    else if (key === 'DTSTART') cur.s = { v: val, ...prm };
    else if (key === 'DTEND') cur.e = { v: val, ...prm };
    else if (key === 'DURATION') cur.dur = val;
    else if (key === 'RRULE') cur.rr = Object.fromEntries(val.split(';').map(p => p.split('=')));
    else if (key === 'EXDATE') cur.ex.push(...val.split(',').map(v => ({ v, ...prm })));
    else if (key === 'RECURRENCE-ID') cur.rid = { v: val, ...prm };
    else if (key === 'UID') cur.uid = val;
    else if (key === 'STATUS') cur.st = val;
  }
  return evs;
}
// fecha del .ics → { allDay, y, m, d, h, mi, tz }  (tz null = UTC «Z»; 'float' = hora local de la persona)
function parts(x, userTz) {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(x?.v || '');
  if (!m) return null;
  const allDay = x.VALUE === 'DATE' || !m[4];
  const tz = m[7] ? 'UTC' : (x.TZID && validTz(x.TZID) ? x.TZID : userTz);
  return { allDay, y: +m[1], mo: +m[2] - 1, d: +m[3], h: +(m[4] || 0), mi: +(m[5] || 0), tz };
}
const instant = p => wallToUtc(p.y, p.mo, p.d, p.h, p.mi, p.tz);
const ymd = ms => new Date(ms).toISOString().slice(0, 10);
function durMs(s) {
  const m = /^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(s || '');
  return m ? ((+m[1] || 0) * 7 * DAY + (+m[2] || 0) * DAY + (+m[3] || 0) * 36e5 + (+m[4] || 0) * 6e4 + (+m[5] || 0) * 1e3) : 0;
}

// ---------- repeticiones (RRULE) ----------
// genera los días «de calendario» (ms UTC a medianoche) en que cae el evento, desde el inicio hasta `until`
function* recurDays(start, rr, until) {
  const freq = rr.FREQ, int = Math.max(1, +rr.INTERVAL || 1);
  const count = +rr.COUNT || Infinity;
  const end = rr.UNTIL ? Date.UTC(+rr.UNTIL.slice(0, 4), +rr.UNTIL.slice(4, 6) - 1, +rr.UNTIL.slice(6, 8)) : Infinity;
  const byday = rr.BYDAY ? rr.BYDAY.split(',').map(s => { const m = /^([+-]?\d+)?(\w\w)$/.exec(s); return m && { n: m[1] ? +m[1] : 0, wd: WD[m[2]] }; }).filter(Boolean) : null;
  const bymd = rr.BYMONTHDAY ? rr.BYMONTHDAY.split(',').map(Number) : null;
  let n = 0, guard = 0;
  const emit = function* (day) { if (day < start) return; if (day > end || day > until || n >= count) return 'stop'; n++; yield day; };
  const s = new Date(start);
  if (freq === 'DAILY') {
    for (let day = start; guard++ < 20000; day += int * DAY) { const r = yield* emit(day); if (r === 'stop' || day > until) return; }
  } else if (freq === 'WEEKLY') {
    const days = byday ? byday.map(b => b.wd) : [s.getUTCDay()];
    const week0 = start - ((s.getUTCDay() + 6) % 7) * DAY;          // lunes de la primera semana
    for (let w = week0; guard++ < 5000; w += int * 7 * DAY) {
      for (const wd of [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))) {
        const r = yield* emit(w + ((wd + 6) % 7) * DAY); if (r === 'stop') return;
      }
      if (w > until) return;
    }
  } else if (freq === 'MONTHLY' || freq === 'YEARLY') {
    for (let k = 0; guard++ < 3000; k += int) {
      const y = s.getUTCFullYear() + (freq === 'YEARLY' ? k : Math.floor((s.getUTCMonth() + k) / 12));
      const months = freq === 'YEARLY' ? [rr.BYMONTH ? +rr.BYMONTH - 1 : s.getUTCMonth()] : [(s.getUTCMonth() + k) % 12];
      for (const mo of months) {
        const dim = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate(), cand = [];
        if (byday) for (const b of byday) {
          const all = []; for (let d = 1; d <= dim; d++) if (new Date(Date.UTC(y, mo, d)).getUTCDay() === b.wd) all.push(d);
          if (!b.n) cand.push(...all); else { const d = b.n > 0 ? all[b.n - 1] : all[all.length + b.n]; if (d) cand.push(d); }
        } else for (const md of bymd || [s.getUTCDate()]) { const d = md < 0 ? dim + md + 1 : md; if (d >= 1 && d <= dim) cand.push(d); }
        for (const d of [...new Set(cand)].sort((a, b) => a - b)) { const r = yield* emit(Date.UTC(y, mo, d)); if (r === 'stop') return; }
        if (Date.UTC(y, mo, 1) > until) return;
      }
    }
  }
}

function occurrences(ev, userTz, wStart, wEnd) {
  const sp = parts(ev.s, userTz); if (!sp) return [];
  const ep = parts(ev.e, userTz);
  const out = [];
  const exKeys = new Set(ev.ex.map(x => { const p = parts(x, userTz); return p && (p.allDay ? `${p.y}-${p.mo}-${p.d}` : String(instant(p))); }));
  if (sp.allDay) {
    const s0 = Date.UTC(sp.y, sp.mo, sp.d), len = ep ? Date.UTC(ep.y, ep.mo, ep.d) - s0 : (durMs(ev.dur) || DAY);
    const days = ev.rr ? recurDays(s0, ev.rr, Date.parse(wEnd + 'T00:00:00Z')) : [s0];
    for (const day of days) {
      const dt = new Date(day); if (exKeys.has(`${dt.getUTCFullYear()}-${dt.getUTCMonth()}-${dt.getUTCDate()}`)) continue;
      // un evento de varios días sale en cada día de la ventana que ocupa (fin exclusivo)
      for (let t = day; t < day + Math.max(len, DAY); t += DAY) { const d = ymd(t); if (d >= wStart && d < wEnd) out.push({ d, h: null }); }
    }
    return out;
  }
  const s0 = instant(sp), len = ep ? instant(ep) - s0 : durMs(ev.dur);
  const w0 = wallToUtc(+wStart.slice(0, 4), +wStart.slice(5, 7) - 1, +wStart.slice(8, 10), 0, 0, userTz);
  const w1 = wallToUtc(+wEnd.slice(0, 4), +wEnd.slice(5, 7) - 1, +wEnd.slice(8, 10), 0, 0, userTz);
  const days = ev.rr ? recurDays(Date.UTC(sp.y, sp.mo, sp.d), ev.rr, w1 + 2 * DAY) : [Date.UTC(sp.y, sp.mo, sp.d)];
  for (const day of days) {
    const dt = new Date(day);
    const at = wallToUtc(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate(), sp.h, sp.mi, sp.tz);  // misma hora de reloj aunque cambie el horario
    if (exKeys.has(String(at))) continue;
    if (at < w1 && at + Math.max(len, 0) >= w0) { const l = local(Math.max(at, w0), userTz); out.push({ d: l.d, h: at < w0 ? null : l.h }); }
  }
  return out;
}

export function agenda(txt, userTz, wStart, wEnd, src) {
  const evs = parseICS(txt).filter(e => e.st !== 'CANCELLED' && e.s);
  // instancias movidas (RECURRENCE-ID) sustituyen a la original de su serie
  const moved = new Map();
  for (const e of evs) if (e.rid) { const p = parts(e.rid, userTz); if (p) moved.set(`${e.uid}|${p.allDay ? `${p.y}-${p.mo}-${p.d}` : instant(p)}`, true); }
  const out = [];
  for (const e of evs) {
    if (!e.rid && e.rr && moved.size) e.ex.push(...[...moved.keys()].filter(k => k.startsWith(e.uid + '|')).map(k => {
      const v = k.split('|')[1];
      if (/^\d+$/.test(v)) return { v: new Date(+v).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''), };
      const [y, mo, d] = v.split('-').map(Number); return { v: `${y}${String(mo + 1).padStart(2, '0')}${String(d).padStart(2, '0')}`, VALUE: 'DATE' };
    }));
    for (const o of occurrences(e, userTz, wStart, wEnd)) out.push({ t: e.t || '(sin título)', ...o, src });
  }
  return out;
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST' });
    if (!(await auth(req))) throw bad('Inicia sesión', 401);
    const b = req.body || {};
    const tz = validTz(b.tz) ? b.tz : 'Europe/Madrid';
    const from = /^\d{4}-\d{2}-\d{2}$/.test(b.from) ? b.from : new Date().toISOString().slice(0, 10);
    const days = Math.min(14, Math.max(1, +b.days || 2));
    const to = ymd(Date.parse(from + 'T00:00:00Z') + days * DAY);
    const urls = (Array.isArray(b.urls) ? b.urls : []).map(u => String(u).trim()).filter(u => OK.test(u)).slice(0, 4);
    const results = await Promise.all(urls.map(async u => {
      const url = u.replace(/^webcal:/i, 'https:');
      const src = /google/.test(url) ? 'g' : 'a';
      try {
        const r = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { accept: 'text/calendar' } });
        if (!r.ok) return { src, error: r.status };
        const txt = (await r.text()).slice(0, 4_000_000);
        if (!txt.includes('BEGIN:VCALENDAR')) return { src, error: 'formato' };
        return { src, events: agenda(txt, tz, from, to, src) };
      } catch (e) { return { src, error: e.name === 'TimeoutError' ? 'tiempo' : 'red' }; }
    }));
    const events = results.flatMap(r => r.events || []).sort((a, b) => (a.d + (a.h || '00:00')).localeCompare(b.d + (b.h || '00:00')));
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ events, errors: results.filter(r => r.error).map(r => ({ src: r.src, error: r.error })) });
  } catch (e) { fail(res, e); }
}

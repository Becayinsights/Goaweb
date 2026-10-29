// Genera un evento de calendario (.ics) con aviso para una tarea. No guarda nada:
// todo llega en la URL y el móvil lo abre en su app de Calendario para añadirlo.
// GET ?t=título&s=20261008T070000Z&a=minutos de antelación
const esc = s => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

export default function handler(req, res) {
  const title = String(req.query.t || 'Tarea').slice(0, 120);
  const start = String(req.query.s || '');
  if (!/^\d{8}T\d{6}Z$/.test(start)) return res.status(400).send('Fecha no válida');
  const before = Math.max(0, Math.min(1440, parseInt(req.query.a, 10) || 0));
  const d = new Date(start.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, '$1-$2-$3T$4:$5:$6Z'));
  const fmt = x => x.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const end = fmt(new Date(d.getTime() + 15 * 60000));
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Habitos//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${start}-${Buffer.from(title).toString('base64url').slice(0, 24)}@habitos`,
    `DTSTAMP:${fmt(new Date())}`, `DTSTART:${start}`, `DTEND:${end}`,
    `SUMMARY:${esc(title)}`, 'DESCRIPTION:Desde Hábitos',
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(title)}`, `TRIGGER:-PT${before}M`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR', '',
  ].join('\r\n');
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  // desde la app de pantalla de inicio se descarga: el iPhone lo abre en Calendario en vez de quedarse en blanco
  res.setHeader('Content-Disposition', `${req.query.dl ? 'attachment' : 'inline'}; filename="tarea.ics"`);
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send(ics);
}

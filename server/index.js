import express from 'express';
import cors from 'cors';
import { getDb, saveDb } from './db.js';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// ---- Health ----
app.get('/api/health', async (_req, res) => {
  const db = await getDb();
  const result = db.exec('SELECT 1 AS ok');
  res.json({ status: 'ok', db: result[0]?.values[0][0] === 1 });
});

// ===================== LOCATIONS =====================
app.get('/api/locations', async (_req, res) => {
  const db = await getDb();
  const results = db.exec(
    'SELECT id, city, country, latitude, longitude, visit_date, duration_days FROM Locations ORDER BY visit_date DESC'
  );
  if (!results[0]) return res.json([]);
  res.json(
    results[0].values.map((r) => ({
      id: r[0], city: r[1], country: r[2],
      latitude: r[3], longitude: r[4],
      visit_date: r[5], duration_days: r[6],
    }))
  );
});

app.post('/api/locations', async (req, res) => {
  const db = await getDb();
  const { city, country, latitude, longitude, visit_date, duration_days } = req.body;
  if (!city || !country || latitude == null || longitude == null || !visit_date || !duration_days) {
    return res.status(400).json({ error: 'Tüm alanlar zorunludur' });
  }
  db.run(
    'INSERT INTO Locations (city, country, latitude, longitude, visit_date, duration_days) VALUES (?, ?, ?, ?, ?, ?)',
    [city, country, latitude, longitude, visit_date, duration_days]
  );
  saveDb();
  const maxRow = db.exec('SELECT MAX(id) AS id FROM Locations')[0];
  res.status(201).json({ success: true, id: maxRow ? maxRow.values[0][0] : null });
});

app.delete('/api/locations/:id', async (req, res) => {
  const db = await getDb();
  db.run('DELETE FROM Locations WHERE id = ?', [req.params.id]);
  saveDb();
  res.json({ success: true });
});

// ===================== CONNECTIONS =====================
app.get('/api/connections', async (_req, res) => {
  const db = await getDb();
  const results = db.exec(`
    SELECT
      c.id, c.dates, c.visit_dates,
      c.source_location_id, sl.city AS src_city, sl.country AS src_country,
      sl.latitude AS start_lat, sl.longitude AS start_lng,
      c.destination_location_id, dl.city AS dst_city, dl.country AS dst_country,
      dl.latitude AS end_lat, dl.longitude AS end_lng
    FROM Connections c
    JOIN Locations sl ON c.source_location_id = sl.id
    JOIN Locations dl ON c.destination_location_id = dl.id
  `);
  if (!results[0]) return res.json([]);
  res.json(
    results[0].values.map((r) => {
      let dates = [], visitDates = [];
      try { dates = JSON.parse(r[1] || '[]'); } catch (_) {}
      try { visitDates = JSON.parse(r[2] || '[]'); } catch (_) {}
      return {
        id: r[0], dates, visit_dates: visitDates,
        source_location_id: r[3], source_city: r[4], source_country: r[5],
        start_lat: r[6], start_lng: r[7],
        destination_location_id: r[8], dest_city: r[9], dest_country: r[10],
        end_lat: r[11], end_lng: r[12],
      };
    })
  );
});

app.post('/api/connections', async (req, res) => {
  const db = await getDb();
  const { source_location_id, destination_location_id, dates, date } = req.body;
  if (!source_location_id || !destination_location_id) {
    return res.status(400).json({ error: 'source_location_id ve destination_location_id zorunludur' });
  }

  // Check if a connection already exists for this pair
  const existing = db.exec(
    'SELECT id, visit_dates FROM Connections WHERE source_location_id = ? AND destination_location_id = ?',
    [source_location_id, destination_location_id]
  );

  if (existing[0] && existing[0].values.length > 0) {
    // Merge new date into existing visit_dates array
    const row = existing[0].values[0];
    const connId = row[0];
    let currentDates = [];
    try { currentDates = JSON.parse(row[1] || '[]'); } catch (_) {}
    if (date) currentDates.push(date);

    db.run('UPDATE Connections SET visit_dates = ? WHERE id = ?', [
      JSON.stringify(currentDates), connId,
    ]);
    saveDb();
    return res.json({ success: true, id: connId, merged: true });
  }

  // No existing connection, create new
  const datesJson = JSON.stringify(dates || []);
  const visitDatesJson = JSON.stringify(date ? [date] : []);
  db.run(
    'INSERT INTO Connections (source_location_id, destination_location_id, dates, visit_dates) VALUES (?, ?, ?, ?)',
    [source_location_id, destination_location_id, datesJson, visitDatesJson]
  );
  saveDb();
  const maxRow = db.exec('SELECT MAX(id) AS id FROM Connections')[0];
  res.status(201).json({ success: true, id: maxRow ? maxRow.values[0][0] : null });
});

app.delete('/api/connections/:id', async (req, res) => {
  const db = await getDb();
  db.run('DELETE FROM Connections WHERE id = ?', [req.params.id]);
  saveDb();
  res.json({ success: true });
});

// ---- Add date to connection ----
app.post('/api/connections/:id/dates', async (req, res) => {
  const db = await getDb();
  const { date } = req.body;
  if (!date) return res.status(400).json({ error: 'date zorunludur' });

  const existing = db.exec('SELECT visit_dates FROM Connections WHERE id = ?', [req.params.id]);
  if (!existing[0] || existing[0].values.length === 0) {
    return res.status(404).json({ error: 'Bağlantı bulunamadı' });
  }

  let dates = [];
  try { dates = JSON.parse(existing[0].values[0][0] || '[]'); } catch (_) {}
  dates.push(date);

  db.run('UPDATE Connections SET visit_dates = ? WHERE id = ?', [
    JSON.stringify(dates), req.params.id,
  ]);
  saveDb();
  res.json({ success: true, dates });
});

// ---- Replace all dates for connection ----
app.put('/api/connections/:id/dates', async (req, res) => {
  const db = await getDb();
  const { dates } = req.body;
  try {
    db.run('UPDATE Connections SET visit_dates = ? WHERE id = ?', [
      JSON.stringify(dates), req.params.id,
    ]);
    saveDb();
    res.json({ success: true, dates });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- Start ----
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

process.on('exit', saveDb);
process.on('SIGINT', () => { saveDb(); process.exit(); });
process.on('SIGTERM', () => { saveDb(); process.exit(); });

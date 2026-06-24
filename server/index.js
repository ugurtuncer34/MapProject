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
      c.id,
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
    results[0].values.map((r) => ({
      id: r[0],
      source_location_id: r[1], source_city: r[2], source_country: r[3],
      start_lat: r[4], start_lng: r[5],
      destination_location_id: r[6], dest_city: r[7], dest_country: r[8],
      end_lat: r[9], end_lng: r[10],
    }))
  );
});

app.post('/api/connections', async (req, res) => {
  const db = await getDb();
  const { source_location_id, destination_location_id } = req.body;
  if (!source_location_id || !destination_location_id) {
    return res.status(400).json({ error: 'source_location_id ve destination_location_id zorunludur' });
  }
  db.run(
    'INSERT INTO Connections (source_location_id, destination_location_id) VALUES (?, ?)',
    [source_location_id, destination_location_id]
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

// ---- Start ----
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

process.on('exit', saveDb);
process.on('SIGINT', () => { saveDb(); process.exit(); });
process.on('SIGTERM', () => { saveDb(); process.exit(); });

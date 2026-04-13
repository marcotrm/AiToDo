const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const JWT_SECRET = 'antigravity_super_secret_key_123';

// Railway inietta PORT automaticamente, il fallback è per sviluppo locale
const PORT = process.env.PORT || 8000;

// Path database: Railway usa /tmp per filesystem temporaneo senza Volume
// Con Volume Railway monta su /app/backend - viene rilevato automaticamente
const DB_PATH = process.env.DATABASE_URL || `file:/tmp/data.sqlite`;

let db;

async function initDB() {
  // Importazione dinamica ESM da CJS
  const { createClient } = await import('@libsql/client');
  db = createClient({ url: DB_PATH });

  // Inizializzazione tabelle
  await db.execute(`CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    desc TEXT,
    status TEXT DEFAULT 'todo'
  )`);

  await db.execute(`CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    priority TEXT DEFAULT 'Media'
  )`);

  await db.execute(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    can_edit INTEGER DEFAULT 0
  )`);

  console.log(`✅ Database connesso: ${DB_PATH}`);
}

// Health check per Railway (obbligatorio)
app.get('/', (req, res) => res.json({ status: 'ok', service: 'Antigravity API', version: '1.0' }));
app.get('/health', (req, res) => res.json({ status: 'healthy' }));

// ==========================================
// AUTH APIs
// ==========================================
app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "Username e password richiesti" });

  try {
    const countResult = await db.execute(`SELECT COUNT(*) as count FROM users`);
    const count = countResult.rows[0].count;
    const role = count === 0 ? 'capo' : 'dipendente';
    const can_edit = count === 0 ? 1 : 0;
    const hashedPassword = bcrypt.hashSync(password, 8);

    const result = await db.execute({
      sql: `INSERT INTO users (username, password, role, can_edit) VALUES (?, ?, ?, ?)`,
      args: [username, hashedPassword, role, can_edit]
    });

    const userId = Number(result.lastInsertRowid);
    const token = jwt.sign({ id: userId, username, role, can_edit }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ success: true, token, user: { id: userId, username, role, can_edit } });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: "Username già in uso." });
    }
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await db.execute({ sql: `SELECT * FROM users WHERE username = ?`, args: [username] });
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: "Credenziali non valide." });

    const isValid = bcrypt.compareSync(password, user.password);
    if (!isValid) return res.status(401).json({ error: "Credenziali non valide." });

    const token = jwt.sign(
      { id: Number(user.id), username: user.username, role: user.role, can_edit: Number(user.can_edit) },
      JWT_SECRET, { expiresIn: '24h' }
    );
    res.json({ success: true, token, user: { id: Number(user.id), username: user.username, role: user.role, can_edit: Number(user.can_edit) } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// USERS API (Solo per il Capo)
// ==========================================
app.get('/api/users', async (req, res) => {
  try {
    const result = await db.execute(`SELECT id, username, role, can_edit FROM users WHERE role = 'dipendente'`);
    res.json(result.rows.map(r => ({ ...r, id: Number(r.id), can_edit: Number(r.can_edit) })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/users/:id/permissions', async (req, res) => {
  const { can_edit } = req.body;
  try {
    await db.execute({
      sql: `UPDATE users SET can_edit = ? WHERE id = ? AND role = 'dipendente'`,
      args: [can_edit ? 1 : 0, req.params.id]
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// PROGETTI API
// ==========================================
app.get('/api/projects.php', async (req, res) => {
  try {
    const result = await db.execute(`SELECT * FROM projects`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/projects.php', async (req, res) => {
  const data = req.body;
  const title = data.title || data.titolo || 'Progetto';
  const desc = data.desc || data.descrizione || data.text || '';
  const status = data.status || 'todo';
  const projId = data.id || `proj_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  try {
    await db.execute({
      sql: `INSERT OR REPLACE INTO projects (id, title, desc, status) VALUES (?, ?, ?, ?)`,
      args: [projId, title, desc, status]
    });
    res.json({ success: true, id: projId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// NOTE API
// ==========================================
app.get('/api/tasks.php', async (req, res) => {
  try {
    const result = await db.execute(`SELECT * FROM notes`);
    res.json(result.rows.map(r => ({ ...r, id: Number(r.id) })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tasks.php', async (req, res) => {
  const data = req.body;
  const text = data.text || data.title || data.titolo || 'Nuova nota';

  let priority = 'Media';
  if (data.priority || data.priorita) {
    const raw = data.priority || data.priorita;
    const p = typeof raw === 'string' ? raw : (raw.value || 'Media');
    priority = p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
    if (!['Alta', 'Media', 'Bassa'].includes(priority)) priority = 'Media';
  }

  try {
    const result = await db.execute({
      sql: `INSERT INTO notes (text, priority) VALUES (?, ?)`,
      args: [text, priority]
    });
    res.json({ success: true, id: Number(result.lastInsertRowid) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// AVVIO SERVER
// ==========================================
const PORT = process.env.PORT || 8000;
initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Antigravity Backend in ascolto su porta ${PORT}`);
    console.log(`📂 Database: ${DB_PATH}`);
  });
}).catch(err => {
  console.error('❌ Errore avvio database:', err);
  process.exit(1);
});

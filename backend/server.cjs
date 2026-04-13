const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const JWT_SECRET = 'antigravity_super_secret_key_123';

// /data è il Volume persistente su Railway (configura il mount path su /data)
// fallback su /tmp per sviluppo locale
const DB_FILE = process.env.DB_PATH || '/data/antigravity_db.json';

function readDB() {
  // Crea la directory se non esiste (es. prima che il Volume sia montato)
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const init = { users: [], projects: [], notes: [] };
    fs.writeFileSync(DB_FILE, JSON.stringify(init, null, 2));
    return init;
  }
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch {
    return { users: [], projects: [], notes: [] };
  }
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// Health check per Railway
app.get('/', (req, res) => res.json({ status: 'ok', service: 'Antigravity API', version: '2.0' }));
app.get('/health', (req, res) => res.json({ status: 'healthy', db: DB_FILE }));

// ==========================================
// AUTH APIs
// ==========================================
app.post('/api/auth/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "Username e password richiesti" });

  const db = readDB();
  if (db.users.find(u => u.username === username)) {
    return res.status(400).json({ error: "Username già in uso." });
  }

  const role = db.users.length === 0 ? 'capo' : 'dipendente';
  const can_edit = db.users.length === 0 ? 1 : 0;
  const hashedPassword = bcrypt.hashSync(password, 8);
  const id = Date.now();

  const newUser = { id, username, password: hashedPassword, role, can_edit };
  db.users.push(newUser);
  writeDB(db);

  const token = jwt.sign({ id, username, role, can_edit }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ success: true, token, user: { id, username, role, can_edit } });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const db = readDB();
  const user = db.users.find(u => u.username === username);
  if (!user) return res.status(401).json({ error: "Credenziali non valide." });

  const isValid = bcrypt.compareSync(password, user.password);
  if (!isValid) return res.status(401).json({ error: "Credenziali non valide." });

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, can_edit: user.can_edit },
    JWT_SECRET, { expiresIn: '24h' }
  );
  res.json({ success: true, token, user: { id: user.id, username: user.username, role: user.role, can_edit: user.can_edit } });
});

// ==========================================
// USERS API
// ==========================================
app.get('/api/users', (req, res) => {
  const db = readDB();
  const dipendenti = db.users
    .filter(u => u.role === 'dipendente')
    .map(({ id, username, role, can_edit }) => ({ id, username, role, can_edit }));
  res.json(dipendenti);
});

app.put('/api/users/:id/permissions', (req, res) => {
  const { can_edit } = req.body;
  const db = readDB();
  const idx = db.users.findIndex(u => u.id == req.params.id && u.role === 'dipendente');
  if (idx === -1) return res.status(404).json({ error: "Dipendente non trovato." });
  db.users[idx].can_edit = can_edit ? 1 : 0;
  writeDB(db);
  res.json({ success: true });
});

// ==========================================
// PROGETTI API
// ==========================================
app.get('/api/projects.php', (req, res) => {
  const db = readDB();
  res.json(db.projects);
});

app.post('/api/projects.php', (req, res) => {
  const raw = req.body;
  // n8n invia {categoria, tipo, dati:{titolo,descrizione,tasks}} — unwrap
  const data = raw.dati || raw;

  const title = data.title || data.titolo || raw.title || raw.titolo || 'Progetto Senza Titolo';
  const desc  = data.desc  || data.descrizione || raw.desc || raw.text || '';
  const status = raw.status || data.status || 'todo';
  const id = raw.id || data.id || `proj_${Date.now()}`;

  // Supporto alle task annidate: possono arrivare da n8n come array
  let tasks = [];
  if (Array.isArray(data.tasks)) {
    tasks = data.tasks.map((t, i) => ({
      id: t.id || `task_${Date.now()}_${i}`,
      title: t.titolo || t.title || t,
      status: t.status || 'todo'
    }));
  } else if (Array.isArray(data.dati?.tasks)) {
    tasks = data.dati.tasks.map((t, i) => ({
      id: t.id || `task_${Date.now()}_${i}`,
      title: t.titolo || t.title || t,
      status: t.status || 'todo'
    }));
  }

  const db = readDB();
  const idx = db.projects.findIndex(p => p.id === id);
  if (idx >= 0) {
    // Aggiorna mantenendo i task esistenti se non ne arrivano di nuovi
    db.projects[idx] = { 
      id, title, desc, status, 
      tasks: tasks.length > 0 ? tasks : (db.projects[idx].tasks || [])
    };
  } else {
    db.projects.push({ id, title, desc, status, tasks });
  }
  writeDB(db);
  res.json({ success: true, id });
});

// Aggiorna lo stato di un singolo task dentro un progetto
app.put('/api/projects/:projectId/tasks/:taskId', (req, res) => {
  const { status } = req.body;
  const db = readDB();
  const proj = db.projects.find(p => p.id === req.params.projectId);
  if (!proj) return res.status(404).json({ error: 'Progetto non trovato' });
  const task = (proj.tasks || []).find(t => t.id === req.params.taskId);
  if (!task) return res.status(404).json({ error: 'Task non trovata' });
  task.status = status;
  writeDB(db);
  res.json({ success: true });
});

// ==========================================
// NOTE API
// ==========================================
app.get('/api/tasks.php', (req, res) => {
  const db = readDB();
  res.json(db.notes);
});

app.post('/api/tasks.php', (req, res) => {
  const data = req.body;
  const text = data.text || data.title || data.titolo || 'Nuova nota';

  let priority = 'Media';
  if (data.priority || data.priorita) {
    const raw = data.priority || data.priorita;
    const p = typeof raw === 'string' ? raw : (raw.value || 'Media');
    priority = p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
    if (!['Alta', 'Media', 'Bassa'].includes(priority)) priority = 'Media';
  }

  const db = readDB();
  const id = Date.now();
  db.notes.push({ id, text, priority });
  writeDB(db);
  res.json({ success: true, id });
});

// ==========================================
// AVVIO SERVER
// ==========================================
const PORT = process.env.PORT || 8181;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Antigravity Backend avviato su porta ${PORT}`);
  console.log(`📂 Database JSON: ${DB_FILE}`);
  // Assicuriamo che il DB esista
  readDB();
  console.log(`✅ DB inizializzato con successo`);
});

const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const JWT_SECRET = 'antigravity_super_secret_key_123'; 

const dbPath = path.resolve(__dirname, 'data.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('Errore apertua SQLite DB:', err);
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      desc TEXT,
      status TEXT DEFAULT 'todo'
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      priority TEXT DEFAULT 'Media'
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL, 
      can_edit INTEGER DEFAULT 0
  )`);
});

// ==========================================
// AUTHENTICATION APIs
// ==========================================
app.post('/api/auth/register', (req, res) => {
  const { username, password } = req.body;
  if(!username || !password) return res.status(400).json({ error: "Username e password richiesti" });

  db.get(`SELECT COUNT(*) as count FROM users`, [], (err, row) => {
    if(err) return res.status(500).json({ error: err.message });
    
    const role = row.count === 0 ? 'capo' : 'dipendente';
    const can_edit = row.count === 0 ? 1 : 0; 
    
    const hashedPassword = bcrypt.hashSync(password, 8);
    
    db.run(`INSERT INTO users (username, password, role, can_edit) VALUES (?, ?, ?, ?)`, 
      [username, hashedPassword, role, can_edit], 
      function(err) {
        if(err) return res.status(400).json({ error: "Username già in uso." });
        
        const token = jwt.sign({ id: this.lastID, username, role, can_edit }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ success: true, token, user: { id: this.lastID, username, role, can_edit } });
      }
    );
  });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, user) => {
    if(err) return res.status(500).json({ error: err.message });
    if(!user) return res.status(401).json({ error: "Credenziali non valide." });
    
    const isValid = bcrypt.compareSync(password, user.password);
    if(!isValid) return res.status(401).json({ error: "Credenziali non valide." });
    
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role, can_edit: user.can_edit }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ success: true, token, user: { id: user.id, username: user.username, role: user.role, can_edit: user.can_edit } });
  });
});

// ==========================================
// USER PERMISSIONS API (Solo per il capo)
// ==========================================
app.get('/api/users', (req, res) => {
  db.all(`SELECT id, username, role, can_edit FROM users WHERE role = 'dipendente'`, [], (err, rows) => {
    if(err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.put('/api/users/:id/permissions', (req, res) => {
  const { can_edit } = req.body;
  db.run(`UPDATE users SET can_edit = ? WHERE id = ? AND role = 'dipendente'`, 
    [can_edit ? 1 : 0, req.params.id], 
    function(err) {
      if(err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

// ==========================================
// API PROGETTI E NOTE 
// ==========================================
app.get('/api/projects.php', (req, res) => {
  db.all('SELECT * FROM projects', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/projects.php', (req, res) => {
  const data = req.body;
  const title = data.title || 'Progetto (da n8n)';
  const desc = data.desc || data.text || ''; 
  const status = data.status || 'todo';
  const projId = data.id || `proj_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  
  db.run(`INSERT OR REPLACE INTO projects (id, title, desc, status) VALUES (?, ?, ?, ?)`,
    [projId, title, desc, status],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id: projId, message: "Progetto salvato con successo." });
    }
  );
});

app.get('/api/tasks.php', (req, res) => {
  db.all('SELECT * FROM notes', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/tasks.php', (req, res) => {
  const data = req.body;
  const text = data.text || data.title || 'Nuova nota vuota'; 
  
  let priority = 'Media';
  if (data.priority) {
      if (typeof data.priority === 'string') priority = data.priority;
      else if (data.priority.value) priority = data.priority.value;
  }
  
  priority = priority.charAt(0).toUpperCase() + priority.slice(1).toLowerCase();
  if(!['Alta', 'Media', 'Bassa'].includes(priority)) priority = 'Media';

  db.run(`INSERT INTO notes (text, priority) VALUES (?, ?)`,
    [text, priority],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id: this.lastID, message: "Nota salvata con successo." });
    }
  );
});

const PORT = 8000;
app.listen(PORT, () => console.log(`🚀 Backend Database API in ascolto su http://localhost:${PORT}`));

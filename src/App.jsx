import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Mic, Send, Loader2, Kanban, StickyNote, AlertCircle, RefreshCw, LogOut, Users, Shield, ShieldOff } from 'lucide-react';

const N8N_WEBHOOK_URL = 'https://niamarketing.app.n8n.cloud/webhook/task-manager';
const API_BASE = 'https://aitodo-production-4145.up.railway.app/api';

export default function App() {
  return (
    <BrowserRouter>
      <AuthContainer />
    </BrowserRouter>
  );
}

function AuthContainer() {
  const [user, setUser] = useState(() => {
    const s = localStorage.getItem('user');
    return s ? JSON.parse(s) : null;
  });

  const login = (userData, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login onLogin={login} />} />
      <Route path="/" element={user ? <Dashboard user={user} logout={logout} /> : <Navigate to="/login" />} />
    </Routes>
  );
}

// ==========================================
// SCHERMATA LOGIN & REGISTRAZIONE
// ==========================================
function Login({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const endpoint = isLogin ? '/auth/login' : '/auth/register';

    try {
      const res = await fetch(API_BASE + endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();

      if (data.success) {
        onLogin(data.user, data.token);
      } else {
        setError(data.error || 'Errore di autenticazione');
      }
    } catch (err) {
      setError('Impossibile contattare il server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090E] flex flex-col items-center justify-center font-sans text-slate-200">
      <div className="absolute top-[-10%] left-[-10%] w-[400px] h-[400px] bg-cyan-600/20 blur-[130px] rounded-full pointer-events-none mix-blend-screen" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-violet-600/15 blur-[150px] rounded-full pointer-events-none mix-blend-screen" />

      <form onSubmit={handleSubmit} className="relative z-10 w-full max-w-sm bg-white/5 border border-white/10 p-8 rounded-3xl backdrop-blur-xl shadow-2xl">
        <div className="flex justify-center mb-6">
          <Kanban className="w-12 h-12 text-cyan-400" />
        </div>
        <h2 className="text-2xl font-semibold mb-6 text-center tracking-wide">
          {isLogin ? 'Antigravity Workspace' : 'Crea un Account'}
        </h2>

        {error && <div className="p-3 mb-4 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl">{error}</div>}

        <input
          type="text" placeholder="Username" required
          value={username} onChange={e => setUsername(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 mb-4 text-sm focus:outline-none focus:border-cyan-500/50"
        />
        <input
          type="password" placeholder="Password" required
          value={password} onChange={e => setPassword(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 mb-6 text-sm focus:outline-none focus:border-cyan-500/50"
        />

        <button disabled={loading} type="submit" className="w-full p-3 bg-gradient-to-br from-cyan-500 to-violet-600 text-white font-medium rounded-xl hover:opacity-90 transition-opacity flex justify-center">
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isLogin ? 'Accedi' : 'Registrati')}
        </button>

        <p className="mt-6 text-center text-xs text-slate-400">
          {isLogin ? "Non hai un account? " : "Hai già un account? "}
          <button type="button" onClick={() => setIsLogin(!isLogin)} className="text-cyan-400 hover:underline">
            {isLogin ? "Registrati" : "Accedi"}
          </button>
        </p>
      </form>
    </div>
  );
}

// ==========================================
// MODAL DETTAGLIO PROGETTO
// ==========================================
function ProjectModal({ project, canEdit, apiBase, onClose }) {
  const [tasks, setTasks] = useState(project.tasks || []);
  const [newTask, setNewTask] = useState('');

  const statusLabels = { todo: 'Da Fare', in_progress: 'In Corso', done: 'Fatto' };
  const statusColors = { 
    todo: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
    in_progress: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    done: 'bg-violet-500/20 text-violet-300 border-violet-500/30'
  };

  const cycleStatus = async (taskId) => {
    const cycle = { todo: 'in_progress', in_progress: 'done', done: 'todo' };
    const updated = tasks.map(t => t.id === taskId ? { ...t, status: cycle[t.status] } : t);
    setTasks(updated);
    if (apiBase) {
      const newStatus = cycle[tasks.find(t => t.id === taskId)?.status];
      await fetch(`${apiBase.replace('/api', '')}/api/projects/${project.id}/tasks/${taskId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
    }
  };

  const addTask = () => {
    if (!newTask.trim()) return;
    const task = { id: `task_${Date.now()}`, title: newTask.trim(), status: 'todo' };
    setTasks(prev => [...prev, task]);
    setNewTask('');
    // Salva nel DB aggiornando il progetto
    fetch(`${apiBase}/projects.php`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: project.id, title: project.title, desc: project.desc, status: project.status, tasks: [...tasks, task] })
    });
  };

  const done = tasks.filter(t => t.status === 'done').length;
  const pct = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#0d1117] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 border-b border-white/5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-white mb-1">{project.title}</h2>
              {project.desc && <p className="text-sm text-slate-400">{project.desc}</p>}
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-white text-xl shrink-0">✕</button>
          </div>
          {/* Progress Bar */}
          {tasks.length > 0 && (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                <span>{done}/{tasks.length} completate</span>
                <span className="text-cyan-400 font-mono">{pct}%</span>
              </div>
              <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-cyan-400 to-violet-500 rounded-full transition-all duration-700" style={{width: `${pct}%`}} />
              </div>
            </div>
          )}
        </div>

        {/* Task List */}
        <div className="p-6 max-h-72 overflow-y-auto custom-scrollbar space-y-2">
          {tasks.length === 0 && <p className="text-slate-500 text-sm text-center py-4">Nessuna task — aggiungine una!</p>}
          {tasks.map(task => (
            <div key={task.id} className="flex items-center gap-3 p-3 bg-white/[0.03] rounded-xl border border-white/5 group">
              <button
                onClick={() => canEdit && cycleStatus(task.id)}
                className={`shrink-0 px-2 py-0.5 text-[10px] font-mono uppercase rounded-lg border transition-all ${statusColors[task.status]} ${canEdit ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
              >
                {statusLabels[task.status]}
              </button>
              <span className={`flex-1 text-sm ${task.status === 'done' ? 'line-through text-slate-500' : 'text-white/90'}`}>{task.title}</span>
            </div>
          ))}
        </div>

        {/* Aggiungi Task */}
        {canEdit && (
          <div className="p-4 border-t border-white/5 flex gap-2">
            <input
              value={newTask}
              onChange={e => setNewTask(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTask()}
              placeholder="Aggiungi una task..."
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-cyan-500/50"
            />
            <button onClick={addTask} className="px-4 py-2 bg-gradient-to-br from-cyan-500 to-violet-600 rounded-xl text-sm font-medium hover:opacity-90">+</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// DASHBOARD PRINCIPALE
// ==========================================
function Dashboard({ user, logout }) {
  const isCapo = user.role === 'capo';
  // Il capo ha tutti i permessi. Il dipendente solo se flaggato su 1 (true)
  const canEdit = isCapo || user.can_edit === 1;

  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [notes, setNotes] = useState([]);
  const [isRecording, setIsRecording] = useState(false);

  // State per il mini pannello Admin
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);

  const startRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Il tuo browser attuale non supporta la dettatura vocale.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'it-IT';
    recognition.interimResults = false;
    recognition.onstart = () => setIsRecording(true);
    recognition.onresult = (e) => setInputText(prev => prev + (prev ? ' ' : '') + e.results[0][0].transcript);
    recognition.onend = () => setIsRecording(false);
    recognition.start();
  };

  const importDataFromDB = async () => {
    try {
      const [projRes, notesRes] = await Promise.all([
        fetch(API_BASE + '/projects.php'),
        fetch(API_BASE + '/tasks.php')
      ]);
      const projData = await projRes.json();
      const notesData = await notesRes.json();
      if (Array.isArray(projData)) setTasks(projData);
      if (Array.isArray(notesData)) setNotes(notesData);
    } catch (err) {
      console.error("Errore fetch dati:", err);
    }
  };

  useEffect(() => {
    importDataFromDB();
  }, []);

  const onDragStart = (e, taskId) => {
    if (!canEdit) return; // Blocco sicurezza
    e.dataTransfer.setData('taskId', taskId);
  };

  const onDragOver = (e) => {
    if (!canEdit) return;
    e.preventDefault();
  };

  const onDrop = async (e, newStatus) => {
    if (!canEdit) return;
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');

    const taskToUpdate = tasks.find(t => t.id === taskId);
    if (!taskToUpdate) return;

    setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, status: newStatus } : t)));

    try {
      await fetch(API_BASE + '/projects.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...taskToUpdate, status: newStatus })
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || !canEdit) return;
    setLoading(true);

    try {
      if (N8N_WEBHOOK_URL) {
        // Timeout di 10s: se n8n non risponde, salviamo direttamente
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        try {
          await fetch(N8N_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: inputText, text: inputText, content: inputText }),
            signal: controller.signal
          });
          clearTimeout(timeout);
          setTimeout(() => importDataFromDB(), 2500);
        } catch (n8nErr) {
          clearTimeout(timeout);
          // Fallback: salva direttamente senza AI
          console.warn('n8n non raggiungibile, salvo direttamente:', n8nErr.name);
          const demoTask = { id: `proj_${Date.now()}`, title: inputText.substring(0, 50), desc: inputText, status: 'todo', tasks: [] };
          await fetch(API_BASE + '/projects.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(demoTask) });
          importDataFromDB();
        }
      } else {
        const demoTask = { id: `proj_${Date.now()}`, title: inputText.substring(0, 50), desc: inputText, status: 'todo', tasks: [] };
        await fetch(API_BASE + '/projects.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(demoTask) });
        importDataFromDB();
      }
      setInputText('');
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const KANBAN_COLS = [
    { id: 'todo', label: 'Da Fare', glow: 'hover:shadow-[0_0_25px_-5px_rgba(255,255,255,0.05)] text-slate-400' },
    { id: 'in_progress', label: 'In Corso', glow: 'hover:shadow-[0_0_25px_-5px_rgba(6,182,212,0.1)] text-cyan-400' },
    { id: 'done', label: 'Completati', glow: 'hover:shadow-[0_0_25px_-5px_rgba(139,92,246,0.1)] text-violet-400' },
  ];

  return (
    <div className="relative min-h-screen bg-[#07090E] text-slate-200 font-sans overflow-hidden selection:bg-purple-500/30">
      <div className="absolute top-[-15%] left-[-10%] w-[500px] h-[500px] bg-cyan-600/20 blur-[130px] rounded-full pointer-events-none mix-blend-screen" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[600px] h-[600px] bg-violet-600/15 blur-[150px] rounded-full pointer-events-none mix-blend-screen" />

      {/* Topbar User Info */}
      <div className="absolute top-6 right-6 flex items-center gap-4 z-20">
        {isCapo && (
          <button onClick={() => setShowAdminPanel(true)} className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-colors text-sm text-cyan-400">
            <Users className="w-4 h-4" /> Gestione Permessi
          </button>
        )}
        <div className="flex flex-col items-end">
          <span className="text-sm font-medium">{user.username} <span className="text-xs text-slate-400">({user.role})</span></span>
          {!canEdit && <span className="text-[10px] text-rose-400 uppercase tracking-widest font-mono">Sola Lettura</span>}
        </div>
        <button onClick={logout} className="p-2 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 rounded-xl transition-colors">
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      <main className="relative z-10 max-w-[1500px] mx-auto px-6 py-12 flex flex-col gap-10 h-screen">

        {/* Manteniamo l'Input bar centrata */}
        <section className="w-full max-w-3xl mx-auto mt-6 flex-shrink-0 relative">
          <form
            onSubmit={handleSubmit}
            className={`group relative flex items-center bg-white/5 border border-white/10 backdrop-blur-xl rounded-3xl p-2 shadow-2xl transition-all duration-500 ${canEdit ? 'hover:bg-white/[0.07] focus-within:border-cyan-500/30 focus-within:shadow-[0_0_40px_-10px_rgba(6,182,212,0.15)]' : 'opacity-60 grayscale'}`}
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={canEdit ? "Inserisci qui e n8n farà la magia..." : "Non hai i permessi per inserire o modificare task."}
              disabled={loading || !canEdit}
              className="w-full bg-transparent text-lg text-white placeholder-slate-400 px-6 py-4 outline-none disabled:opacity-50 transition-all font-light"
            />
            {canEdit && (
              <div className="flex items-center gap-2 pr-2">
                <button type="button" onClick={startRecording} title="Detta a voce" className={`p-3 rounded-2xl transition-all ${isRecording ? 'text-rose-400 bg-rose-500/20 animate-pulse' : 'text-slate-400 hover:text-cyan-400 hover:bg-cyan-400/10'}`}>
                  <Mic className="w-5 h-5" />
                </button>
                <button type="submit" disabled={loading || !inputText.trim()} className="p-3 text-white bg-gradient-to-br from-cyan-500 to-violet-600 hover:opacity-90 rounded-2xl">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 ml-1" />}
                </button>
              </div>
            )}
          </form>
          <div className="absolute -bottom-6 right-4 flex items-center gap-2 opacity-50 cursor-pointer hover:opacity-100 transition-opacity" onClick={importDataFromDB}>
            <RefreshCw className="w-3 h-3 text-cyan-400" />
            <span className="text-[10px] uppercase font-mono tracking-wider">Sync Data</span>
          </div>
        </section>

        {/* Layout Dinamico: Se è dipendente, span intero. Se Capo, span diviso. */}
        <section className={`flex-1 grid grid-cols-1 ${isCapo ? 'lg:grid-cols-4' : 'lg:grid-cols-1'} gap-8 pb-4 min-h-[400px]`}>

          <div className={`${isCapo ? 'lg:col-span-3' : 'lg:col-span-1'} flex flex-col h-full overflow-hidden`}>
            <div className="flex items-center gap-3 px-1 mb-4 flex-shrink-0">
              <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                <Kanban className="w-5 h-5 text-cyan-400" />
              </div>
              <h2 className="text-xl font-medium tracking-wide">Kanban Lavoro</h2>
            </div>

            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 overflow-y-auto pl-1 pr-2 pb-2 custom-scrollbar">
              {KANBAN_COLS.map((col) => (
                <div
                  key={col.id}
                  onDragOver={onDragOver}
                  onDrop={(e) => onDrop(e, col.id)}
                  className={`flex flex-col bg-white/[0.02] border border-white/5 rounded-2xl p-4 overflow-hidden min-h-[300px] transition-all duration-300 ${col.glow}`}
                >
                  <div className="flex justify-between mb-4 px-2">
                    <h3 className={`text-sm font-semibold uppercase tracking-wider ${col.glow.split(' ')[1]}`}>{col.label}</h3>
                    <span className="bg-white/10 text-white/60 text-xs px-2 py-0.5 rounded-full font-mono">
                      {tasks.filter(t => t.status === col.id).length}
                    </span>
                  </div>

                  <div className="flex-1 flex flex-col gap-3 overflow-y-auto custom-scrollbar pr-2 pb-2">
                    {tasks.filter(t => t.status === col.id).map(task => (
                      <div
                        key={task.id}
                        draggable={canEdit}
                        onDragStart={(e) => onDragStart(e, task.id)}
                        onClick={() => setSelectedProject(task)}
                        className={`p-4 bg-white/[0.04] border border-white/5 backdrop-blur-md rounded-xl transition-all duration-300 group cursor-pointer ${canEdit ? 'hover:bg-white/[0.08] hover:border-white/10 hover:-translate-y-1 hover:shadow-lg' : 'opacity-80'}`}
                      >
                        <h4 className="text-[15px] font-medium text-white mb-2 leading-tight">{task.title}</h4>
                        <p className="text-[13px] text-slate-400 font-light leading-relaxed line-clamp-2">{task.desc}</p>
                        {/* Progress bar basata sulle task interne */}
                        {Array.isArray(task.tasks) && task.tasks.length > 0 && (
                          <div className="mt-3">
                            <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                              <span>{task.tasks.filter(t => t.status === 'done').length}/{task.tasks.length} task</span>
                              <span>{Math.round((task.tasks.filter(t => t.status === 'done').length / task.tasks.length) * 100)}%</span>
                            </div>
                            <div className="w-full h-[3px] bg-slate-800/50 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-cyan-400 to-violet-500 rounded-full transition-all duration-500"
                                style={{width: `${Math.round((task.tasks.filter(t => t.status === 'done').length / task.tasks.length) * 100)}%`}}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Area Sensibile visibile solo al Capo */}
          {isCapo && (
            <div className="lg:col-span-1 flex flex-col h-full overflow-hidden lg:border-l border-white/5 lg:pl-6">
              <div className="flex items-center gap-3 px-1 mb-6 flex-shrink-0">
                <div className="p-2 bg-violet-500/10 border border-violet-500/20 rounded-xl">
                  <StickyNote className="w-5 h-5 text-violet-400" />
                </div>
                <h2 className="text-xl font-medium tracking-wide text-rose-300">Note Personali (Private)</h2>
              </div>
              <div className="flex-1 flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-2">
                {notes.map(note => (
                  <div key={note.id} className="relative p-5 bg-white/[0.02] border border-white/5 rounded-2xl">
                    <p className="text-slate-300 text-[14px] leading-relaxed mb-5 font-light whitespace-pre-wrap">{note.text}</p>
                    <div className="flex items-center justify-between opacity-60">
                      <div className="flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" /><span className="text-xs">Memo Personale</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Modal Admin Panel */}
      {isCapo && showAdminPanel && (
        <AdminPanel onClose={() => setShowAdminPanel(false)} />
      )}

      {/* Modal Dettaglio Progetto */}
      {selectedProject && (
        <ProjectModal
          project={selectedProject}
          canEdit={canEdit}
          apiBase={API_BASE}
          onClose={() => { setSelectedProject(null); importDataFromDB(); }}
        />
      )}
    </div>
  );
}

// ==========================================
// PANNELLO AMMINISTRATORI (GESTONE FLUSSO DIPENDENTI)
// ==========================================
function AdminPanel({ onClose }) {
  const [users, setUsers] = useState([]);
  const token = localStorage.getItem('token');

  useEffect(() => {
    fetch(API_BASE + '/users', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setUsers(data) });
  }, [token]);

  const togglePermission = async (id, currentStatus) => {
    try {
      await fetch(`${API_BASE}/users/${id}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ can_edit: !currentStatus })
      });
      setUsers(users.map(u => u.id === id ? { ...u, can_edit: !currentStatus ? 1 : 0 } : u));
    } catch (err) { console.error(err); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0b0f19] border border-white/10 rounded-3xl w-full max-w-lg shadow-2xl p-6 relative">
        <h3 className="text-xl font-bold mb-6 flex items-center gap-3 border-b border-white/10 pb-4">
          <Shield className="text-cyan-400 w-6 h-6" /> Gestione Accessi Dipendenti
        </h3>

        <div className="flex flex-col gap-3 min-h-[200px] max-h-[400px] overflow-y-auto custom-scrollbar">
          {users.length === 0 && <p className="text-slate-500 text-sm text-center mt-10">Nessun dipendente registrato.</p>}

          {users.map(u => (
            <div key={u.id} className="flex justify-between items-center bg-white/5 border border-white/5 p-4 rounded-xl">
              <div className="flex flex-col">
                <span className="font-medium text-white">{u.username}</span>
                <span className="text-xs text-slate-400">ID: #{u.id}</span>
              </div>
              <button
                onClick={() => togglePermission(u.id, u.can_edit === 1)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border flex items-center gap-2 ${u.can_edit === 1 ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}
              >
                {u.can_edit === 1 ? <Shield className="w-4 h-4" /> : <ShieldOff className="w-4 h-4" />}
                {u.can_edit === 1 ? 'Scrittura Attiva' : 'Sola Lettura'}
              </button>
            </div>
          ))}
        </div>

        <button onClick={onClose} className="mt-6 w-full p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors font-medium">Chiudi Pannello</button>
      </div>
    </div>
  );
}

// NoteKeeper — a small full-stack notes app written the safe way.
// It should pass DevDeploy's gate (with some logged warnings) and deploy.
// Look for the one flaw hiding in plain sight — see README.md.
const express = require('express');
const crypto = require('crypto');
const path = require('path');
const { Sequelize } = require('sequelize');

const app = express();
const PORT = process.env.PORT || 3000;
const sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Session tokens live in memory; credentials come from the environment,
// never from source code.
const sessions = new Map();
const DEMO_USERS = {
  alice: process.env.ALICE_PASSWORD || crypto.randomBytes(8).toString('hex'),
  bob: process.env.BOB_PASSWORD || crypto.randomBytes(8).toString('hex'),
};
if (!process.env.ALICE_PASSWORD) {
  console.log('Demo password for alice (set ALICE_PASSWORD to choose your own):', DEMO_USERS.alice);
}

async function initDb() {
  await sequelize.query('CREATE TABLE notes (id INTEGER PRIMARY KEY AUTOINCREMENT, owner TEXT, title TEXT, body TEXT)');
}

function requireLogin(req, res, next) {
  const user = sessions.get(req.get('authorization'));
  if (!user) return res.status(401).json({ error: 'log in first' });
  req.user = user;
  next();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

app.post('/api/login', (req, res) => {
  const { name, password } = req.body;
  const expected = DEMO_USERS[name];
  // Constant-time comparison; no query involved at all.
  const ok =
    expected &&
    typeof password === 'string' &&
    password.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(password), Buffer.from(expected));
  if (!ok) return res.status(401).json({ error: 'bad credentials' });
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, name);
  res.json({ token, user: name });
});

// Parameterised queries everywhere: user input is never part of the SQL text.
app.get('/api/notes', requireLogin, async (req, res) => {
  const [rows] = await sequelize.query('SELECT id, title, body FROM notes WHERE owner = ? ORDER BY id DESC', {
    replacements: [req.user],
  });
  res.json(rows);
});

app.get('/api/notes/search', requireLogin, async (req, res) => {
  const [rows] = await sequelize.query('SELECT id, title, body FROM notes WHERE owner = ? AND title LIKE ?', {
    replacements: [req.user, `%${req.query.q ?? ''}%`],
  });
  res.json(rows);
});

app.post('/api/notes', requireLogin, async (req, res) => {
  const { title, body } = req.body;
  await sequelize.query('INSERT INTO notes (owner, title, body) VALUES (?, ?, ?)', {
    replacements: [req.user, String(title).slice(0, 100), String(body).slice(0, 2000)],
  });
  res.status(201).json({ ok: true });
});

// THE HIDDEN FLAW: broken access control. The note id is trusted without
// checking that the note belongs to the logged-in user, so bob can delete
// alice's notes. The code is clean, parameterised and idiomatic - which is
// exactly why no scanner reports it. Fix: add `AND owner = ?`.
app.delete('/api/notes/:id', requireLogin, async (req, res) => {
  await sequelize.query('DELETE FROM notes WHERE id = ?', { replacements: [req.params.id] });
  res.json({ ok: true });
});

// The next three routes look dangerous to a pattern-matching scanner
// (user input flowing into HTML / a file path / a redirect) but each is
// guarded. Semgrep is expected to flag them anyway; LLM triage should read
// the surrounding guard and dismiss them as false positives.
app.get('/greet', (req, res) => {
  res.send('<h1>Welcome back, ' + escapeHtml(req.query.name ?? 'friend') + '!</h1>');
});

const EXPORTS = new Set(['notes.txt', 'help.txt']);
app.get('/docs', (req, res) => {
  const file = path.basename(String(req.query.file));
  if (!EXPORTS.has(file)) return res.status(404).send('unknown document');
  res.sendFile(path.join(__dirname, 'docs', file));
});

const SAFE_REDIRECTS = new Set(['/', '/help.html']);
app.get('/go', (req, res) => {
  if (!SAFE_REDIRECTS.has(req.query.to)) return res.status(400).send('unsupported target');
  res.redirect(req.query.to);
});

app.get('/health', (req, res) => res.json({ healthy: true }));

initDb().then(() => {
  app.listen(PORT, () => console.log(`NoteKeeper listening on port ${PORT}`));
});

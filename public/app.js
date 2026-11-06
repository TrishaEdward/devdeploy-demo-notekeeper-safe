// Frontend for NoteKeeper: plain JavaScript, no framework. All user content is
// inserted with textContent, never as HTML, so it can never run as script.
let token = null;
const $ = (id) => document.getElementById(id);

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: token ?? '' },
  });
  return res.json();
}

let toastTimer;
function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
}

function renderNotes(notes) {
  const box = $('notes');
  box.replaceChildren();
  if (!Array.isArray(notes) || notes.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'No notes yet. Write your first one on the left.';
    box.append(empty);
    return;
  }
  for (const n of notes) {
    const el = document.createElement('article');
    el.className = 'note';

    const head = document.createElement('div');
    head.className = 'note-head';
    const title = document.createElement('span');
    title.className = 'note-title';
    title.textContent = n.title;
    const id = document.createElement('span');
    id.className = 'note-id';
    id.textContent = `#${n.id}`;
    head.append(title, id);

    const body = document.createElement('p');
    body.className = 'note-body';
    body.textContent = n.body;

    const actions = document.createElement('div');
    actions.className = 'note-actions';
    const del = document.createElement('button');
    del.className = 'btn danger';
    del.textContent = 'Delete';
    del.onclick = async () => {
      await api(`/api/notes/${n.id}`, { method: 'DELETE' });
      toast('Note deleted');
      load($('q').value);
    };
    actions.append(del);

    el.append(head, body, actions);
    box.append(el);
  }
}

async function load(query) {
  renderNotes(await api(query ? `/api/notes/search?q=${encodeURIComponent(query)}` : '/api/notes'));
}

$('loginForm').onsubmit = async (e) => {
  e.preventDefault();
  const r = await api('/api/login', {
    method: 'POST',
    body: JSON.stringify({ name: $('name').value, password: $('password').value }),
  });
  if (r.token) {
    token = r.token;
    $('who').textContent = r.user;
    $('avatar').textContent = r.user.charAt(0);
    $('login').hidden = true;
    $('app').hidden = false;
    $('msg').textContent = '';
    $('password').value = '';
    load();
  } else {
    $('msg').textContent = 'Wrong username or password.';
  }
};

$('logoutBtn').onclick = () => {
  token = null;
  $('app').hidden = true;
  $('login').hidden = false;
};

$('body').oninput = () => { $('counter').textContent = `${$('body').value.length} / 2000`; };

$('noteForm').onsubmit = async (e) => {
  e.preventDefault();
  await api('/api/notes', { method: 'POST', body: JSON.stringify({ title: $('title').value, body: $('body').value }) });
  $('title').value = '';
  $('body').value = '';
  $('counter').textContent = '0 / 2000';
  toast('Note saved');
  load();
};

$('searchForm').onsubmit = (e) => { e.preventDefault(); load($('q').value); };
$('clearSearch').onclick = () => { $('q').value = ''; load(); };

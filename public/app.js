const $ = (id) => document.getElementById(id);
const form = $('book-form');
const fields = ['book_id', 'title', 'author', 'category', 'publication_year', 'quantity'];
let books = [];
let editingId = null;
let searchTimer;

// Category tag colours (light background, dark text)
const TAGS = [
  ['#dff1ea', '#14503f'], ['#e3e9fb', '#26397a'], ['#fbe9d9', '#7a4112'],
  ['#f3e1f0', '#6b2a63'], ['#e6efd3', '#455c14'], ['#fbe0e0', '#7d2323']
];
function tagColors(name) {
  let h = 0;
  for (const c of name.toLowerCase()) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TAGS[h % TAGS.length];
}

function toast(msg, isError) {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast show' + (isError ? ' error' : '');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.className = 'toast'), 3200);
}

async function api(path, options) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (res.status === 204) return null;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Something went wrong.');
  return body;
}

async function loadBooks(flashId) {
  try {
    const q = $('search').value.trim();
    books = await api('/api/books' + (q ? '?q=' + encodeURIComponent(q) : ''));
    render(flashId);
  } catch (err) {
    toast(err.message, true);
  }
}

function cell(tag, text, className) {
  const el = document.createElement(tag);
  el.textContent = text;
  if (className) el.className = className;
  return el;
}

function render(flashId) {
  const tbody = $('rows');
  tbody.replaceChildren();
  const searching = $('search').value.trim() !== '';

  for (const b of books) {
    const tr = document.createElement('tr');
    if (b.book_id === flashId) tr.className = 'flash';
    tr.append(cell('td', b.book_id, 'id'), cell('td', b.title, 'title'), cell('td', b.author));

    const catTd = document.createElement('td');
    const [bg, fg] = tagColors(b.category);
    const tag = cell('span', b.category, 'tag');
    tag.style.background = bg; tag.style.color = fg;
    catTd.append(tag);
    tr.append(catTd, cell('td', b.publication_year, 'num'), cell('td', b.quantity, 'num' + (b.quantity === 0 ? ' low' : '')));

    const actions = document.createElement('td');
    actions.className = 'actions-cell';
    const edit = cell('button', 'Edit', 'btn small');
    edit.type = 'button';
    edit.setAttribute('aria-label', 'Edit ' + b.title);
    edit.onclick = () => startEdit(b);
    const del = cell('button', 'Delete', 'btn small danger');
    del.type = 'button';
    del.setAttribute('aria-label', 'Delete ' + b.title);
    del.onclick = () => removeBook(b);
    actions.append(edit, del);
    tr.append(actions);
    tbody.append(tr);
  }

  const empty = $('empty');
  empty.hidden = books.length > 0;
  empty.textContent = searching
    ? 'No books match your search. Try a different title or author.'
    : 'No books yet. Add the first one using the form.';

  // Totals and category suggestions
  const copies = books.reduce((n, b) => n + b.quantity, 0);
  $('totals').textContent = `${books.length} ${books.length === 1 ? 'title' : 'titles'}, ${copies} ${copies === 1 ? 'copy' : 'copies'}${searching ? ' in results' : ''}`;
  const cats = [...new Set(books.map((b) => b.category))].sort();
  $('categories').replaceChildren(...cats.map((c) => Object.assign(document.createElement('option'), { value: c })));
}

function setFormError(msg) { $('form-error').textContent = msg || ''; }

function startEdit(b) {
  editingId = b.book_id;
  for (const f of fields) $(f).value = b[f];
  $('book_id').readOnly = true;
  $('form-title').textContent = 'Edit book';
  $('submit-btn').textContent = 'Save changes';
  $('cancel-btn').hidden = false;
  document.querySelector('.form-panel').classList.add('editing');
  setFormError('');
  $('title').focus();
  $('form-title').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function resetForm() {
  editingId = null;
  form.reset();
  $('quantity').value = 1;
  $('book_id').readOnly = false;
  $('form-title').textContent = 'Add a book';
  $('submit-btn').textContent = 'Add book';
  $('cancel-btn').hidden = true;
  document.querySelector('.form-panel').classList.remove('editing');
  setFormError('');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  setFormError('');
  const payload = Object.fromEntries(fields.map((f) => [f, $(f).value.trim()]));
  const missing = fields.find((f) => payload[f] === '');
  if (missing) {
    setFormError('Fill in every field before saving.');
    $(missing).focus();
    return;
  }
  const btn = $('submit-btn');
  btn.disabled = true;
  try {
    const wasEditing = editingId;
    const saved = wasEditing
      ? await api('/api/books/' + encodeURIComponent(wasEditing), { method: 'PUT', body: JSON.stringify(payload) })
      : await api('/api/books', { method: 'POST', body: JSON.stringify(payload) });
    resetForm();
    $('search').value = '';
    await loadBooks(saved.book_id);
    toast(wasEditing ? 'Changes saved.' : 'Book added.');
  } catch (err) {
    setFormError(err.message);
  } finally {
    btn.disabled = false;
  }
});

$('cancel-btn').onclick = resetForm;

async function removeBook(b) {
  if (!confirm(`Delete "${b.title}" (${b.book_id})? This cannot be undone.`)) return;
  try {
    await api('/api/books/' + encodeURIComponent(b.book_id), { method: 'DELETE' });
    if (editingId === b.book_id) resetForm();
    await loadBooks();
    toast('Book deleted.');
  } catch (err) {
    toast(err.message, true);
  }
}

$('search').addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => loadBooks(), 250);
});

loadBooks();

const $ = (id) => document.getElementById(id);
const VIEWS = ['dashboard', 'records', 'add', 'search', 'all'];
const LOW_STOCK = 2; // books with this many copies or fewer show under Low Stock
const fields = ['book_id', 'title', 'author', 'category', 'publication_year', 'quantity'];
const form = $('book-form');

let allBooks = [];
let editingId = null;
let flashId = null;
let searchTimer;

const TAGS = [
  ['#dff1ea', '#14503f'], ['#e3e9fb', '#26397a'], ['#fbe9d9', '#7a4112'],
  ['#f3e1f0', '#6b2a63'], ['#e6efd3', '#455c14'], ['#fbe0e0', '#7d2323']
];
function tagColors(name) {
  let h = 0;
  for (const c of name.toLowerCase()) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TAGS[h % TAGS.length];
}

function el(tag, text, className) {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  if (className) e.className = className;
  return e;
}

function toast(msg, isError) {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast show' + (isError ? ' error' : '');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.className = 'toast'), 3200);
}

async function api(path, options) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (res.status === 204) return null;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Something went wrong.');
  return body;
}

/* ---------- Routing ---------- */
function route() {
  let name = location.hash.slice(1);
  if (!VIEWS.includes(name)) name = 'dashboard';
  if (name !== 'add' && editingId) resetForm();
  for (const v of VIEWS) $('view-' + v).hidden = v !== name;
  document.querySelectorAll('.nav a').forEach((a) => {
    const on = a.dataset.view === name;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  if (name === 'search') $('search').focus();
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);
$('nav-add').addEventListener('click', () => { if (editingId) resetForm(); });

/* ---------- Data ---------- */
async function loadAll() {
  try {
    allBooks = await api('/api/books');
    renderDashboard();
    renderRecords();
    renderDisplayAll();
    const cats = [...new Set(allBooks.map((b) => b.category))].sort();
    $('categories').replaceChildren(...cats.map((c) => Object.assign(el('option'), { value: c })));
  } catch (err) {
    toast(err.message, true);
  }
}
async function refresh() {
  await loadAll();
  if (!$('view-search').hidden) runSearch();
}

/* ---------- Tables ---------- */
function buildTable(list, withActions) {
  const wrap = el('div', undefined, 'table-wrap');
  const table = el('table');
  const head = el('tr');
  for (const [label, cls] of [['ID'], ['Title'], ['Author'], ['Category'], ['Year', 'num'], ['Qty', 'num']]) head.append(el('th', label, cls));
  if (withActions) head.append(el('th', 'Actions'));
  table.append(el('thead')).firstChild.append(head);

  const tbody = el('tbody');
  for (const b of list) {
    const tr = el('tr', undefined, b.book_id === flashId ? 'flash' : '');
    tr.append(el('td', b.book_id, 'id'), el('td', b.title, 'title'), el('td', b.author));
    const catTd = el('td');
    const tag = el('span', b.category, 'tag');
    [tag.style.background, tag.style.color] = tagColors(b.category);
    catTd.append(tag);
    tr.append(catTd, el('td', b.publication_year, 'num'), el('td', b.quantity, 'num' + (b.quantity === 0 ? ' low' : '')));
    if (withActions) {
      const td = el('td', undefined, 'actions-cell');
      const edit = el('button', 'Edit', 'btn small');
      edit.type = 'button';
      edit.setAttribute('aria-label', 'Edit ' + b.title);
      edit.onclick = () => startEdit(b);
      const del = el('button', 'Delete', 'btn small danger');
      del.type = 'button';
      del.setAttribute('aria-label', 'Delete ' + b.title);
      del.onclick = () => removeBook(b);
      td.append(edit, del);
      tr.append(td);
    }
    tbody.append(tr);
  }
  table.append(tbody);
  wrap.append(table);
  return wrap;
}

/* ---------- Views ---------- */
function fillList(key, rows, emptyText) {
  $('count-' + key).textContent = rows.length;
  const ul = $('list-' + key);
  ul.replaceChildren();
  if (!rows.length) { ul.append(el('li', emptyText, 'muted')); return; }
  for (const [main, meta] of rows) {
    const li = el('li');
    li.append(el('span', main), el('span', meta, 'meta'));
    ul.append(li);
  }
}

function renderDashboard() {
  const copies = allBooks.reduce((n, b) => n + b.quantity, 0);
  const cats = new Map();
  for (const b of allBooks) cats.set(b.category, (cats.get(b.category) || 0) + 1);

  $('stat-books').textContent = allBooks.length;
  $('stat-copies').textContent = copies;
  $('stat-cats').textContent = cats.size;

  const low = allBooks.filter((b) => b.quantity <= LOW_STOCK).sort((a, b) => a.quantity - b.quantity);
  fillList('low', low.map((b) => [b.title, b.quantity === 0 ? 'Out of stock' : `${b.quantity} left`]), 'Nothing is running low.');

  const recent = [...allBooks].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);
  fillList('recent', recent.map((b) => [b.title, b.author]), 'No books added yet.');

  const catRows = [...cats].sort((a, b) => a[0].localeCompare(b[0])).map(([c, n]) => [c, `${n} ${n === 1 ? 'title' : 'titles'}`]);
  fillList('cats', catRows, 'No categories yet.');
}

function renderRecords() {
  const box = $('records-table');
  box.replaceChildren();
  $('records-empty').hidden = allBooks.length > 0;
  box.hidden = allBooks.length === 0;
  $('records-sub').textContent = allBooks.length
    ? `${allBooks.length} ${allBooks.length === 1 ? 'book' : 'books'} on record. Edit or delete from here.`
    : '';
  if (allBooks.length) box.append(buildTable(allBooks, true));
  flashId = null;
}

function renderDisplayAll() {
  const root = $('all-groups');
  root.replaceChildren();
  $('all-empty').hidden = allBooks.length > 0;
  const groups = new Map();
  for (const b of allBooks) {
    if (!groups.has(b.category)) groups.set(b.category, []);
    groups.get(b.category).push(b);
  }
  for (const [cat, list] of [...groups].sort((a, b) => a[0].localeCompare(b[0]))) {
    const h = el('h2', undefined, 'group-title');
    h.append(cat, el('span', list.length, 'badge'));
    const card = el('div', undefined, 'card');
    card.append(buildTable(list, false));
    root.append(h, card);
  }
}

async function runSearch() {
  const q = $('search').value.trim();
  const box = $('search-results');
  const msg = $('search-msg');
  box.replaceChildren();
  box.hidden = true;
  if (!q) { msg.textContent = 'Type a title or author to find a book.'; return; }
  try {
    const list = await api('/api/books?q=' + encodeURIComponent(q));
    if (!list.length) { msg.textContent = `No books match "${q}". Try a different title or author.`; return; }
    msg.textContent = `${list.length} ${list.length === 1 ? 'book' : 'books'} found`;
    box.append(buildTable(list, true));
    box.hidden = false;
  } catch (err) {
    toast(err.message, true);
  }
}
$('search').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(runSearch, 250); });

/* ---------- Add / Edit / Delete ---------- */
function setFormError(msg) { $('form-error').textContent = msg || ''; }

function startEdit(b) {
  editingId = b.book_id;
  for (const f of fields) $(f).value = b[f];
  $('book_id').readOnly = true;
  $('h-add').textContent = 'Edit Book';
  $('add-sub').textContent = `Update the details for ${b.book_id}. The Book ID can't be changed.`;
  $('submit-btn').textContent = 'Save changes';
  $('cancel-btn').hidden = false;
  setFormError('');
  if (location.hash !== '#add') location.hash = '#add'; else route();
  $('title').focus();
}

function resetForm() {
  editingId = null;
  form.reset();
  $('quantity').value = 1;
  $('book_id').readOnly = false;
  $('h-add').textContent = 'Add New Book';
  $('add-sub').textContent = 'Fill in every field to add a book to the collection.';
  $('submit-btn').textContent = 'Add book';
  $('cancel-btn').hidden = true;
  setFormError('');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  setFormError('');
  const payload = Object.fromEntries(fields.map((f) => [f, $(f).value.trim()]));
  const missing = fields.find((f) => payload[f] === '');
  if (missing) { setFormError('Fill in every field before saving.'); $(missing).focus(); return; }

  const btn = $('submit-btn');
  btn.disabled = true;
  try {
    const wasEditing = editingId;
    const saved = wasEditing
      ? await api('/api/books/' + encodeURIComponent(wasEditing), { method: 'PUT', body: JSON.stringify(payload) })
      : await api('/api/books', { method: 'POST', body: JSON.stringify(payload) });
    resetForm();
    flashId = saved.book_id;
    await loadAll();
    location.hash = '#records';
    toast(wasEditing ? 'Changes saved.' : 'Book added.');
  } catch (err) {
    setFormError(err.message);
  } finally {
    btn.disabled = false;
  }
});

$('cancel-btn').onclick = () => { resetForm(); location.hash = '#records'; };

async function removeBook(b) {
  if (!confirm(`Delete "${b.title}" (${b.book_id})? This cannot be undone.`)) return;
  try {
    await api('/api/books/' + encodeURIComponent(b.book_id), { method: 'DELETE' });
    await refresh();
    toast('Book deleted.');
  } catch (err) {
    toast(err.message, true);
  }
}

/* ---------- Start ---------- */
route();
loadAll();
require('dotenv').config();
const express = require('express');
const path = require('path');
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Supabase requires SSL
});

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const COLUMNS = 'book_id, title, author, category, publication_year, quantity';

// Validate and clean a book payload. Returns { error } or { data }.
function parseBook(body, requireId) {
  const clean = (v) => (typeof v === 'string' ? v.trim() : '');
  const data = {
    book_id: clean(body.book_id),
    title: clean(body.title),
    author: clean(body.author),
    category: clean(body.category),
    publication_year: Number(body.publication_year),
    quantity: Number(body.quantity)
  };
  const maxYear = new Date().getFullYear() + 1;

  if (requireId && !data.book_id) return { error: 'Book ID is required.' };
  if (data.book_id.length > 30) return { error: 'Book ID must be 30 characters or fewer.' };
  if (!data.title) return { error: 'Book title is required.' };
  if (!data.author) return { error: 'Author is required.' };
  if (!data.category) return { error: 'Category is required.' };
  if (!Number.isInteger(data.publication_year) || data.publication_year < 1000 || data.publication_year > maxYear)
    return { error: `Publication year must be a whole number between 1000 and ${maxYear}.` };
  if (!Number.isInteger(data.quantity) || data.quantity < 0)
    return { error: 'Quantity must be a whole number, 0 or higher.' };
  return { data };
}

app.get('/health', (_req, res) => res.json({ ok: true }));

// Display all books / search by title or author
app.get('/api/books', async (req, res) => {
  try {
    const q = (req.query.q || '').toString().trim();
    let result;
    if (q) {
      const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
      result = await pool.query(
        `SELECT ${COLUMNS} FROM books WHERE title ILIKE $1 OR author ILIKE $1 ORDER BY title`,
        [like]
      );
    } else {
      result = await pool.query(`SELECT ${COLUMNS} FROM books ORDER BY title`);
    }
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load books. Please try again.' });
  }
});

// Add a new book
app.post('/api/books', async (req, res) => {
  const { error, data } = parseBook(req.body, true);
  if (error) return res.status(400).json({ error });
  try {
    const result = await pool.query(
      `INSERT INTO books (${COLUMNS}) VALUES ($1,$2,$3,$4,$5,$6) RETURNING ${COLUMNS}`,
      [data.book_id, data.title, data.author, data.category, data.publication_year, data.quantity]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: `Book ID "${data.book_id}" already exists. Use a different ID.` });
    console.error(err);
    res.status(500).json({ error: 'Could not add the book. Please try again.' });
  }
});

// Edit book details
app.put('/api/books/:id', async (req, res) => {
  const { error, data } = parseBook(req.body, false);
  if (error) return res.status(400).json({ error });
  try {
    const result = await pool.query(
      `UPDATE books SET title=$2, author=$3, category=$4, publication_year=$5, quantity=$6
       WHERE book_id=$1 RETURNING ${COLUMNS}`,
      [req.params.id, data.title, data.author, data.category, data.publication_year, data.quantity]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'That book no longer exists.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not save changes. Please try again.' });
  }
});

// Delete a book record
app.delete('/api/books/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM books WHERE book_id=$1', [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'That book no longer exists.' });
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not delete the book. Please try again.' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Library system running on port ${port}`));

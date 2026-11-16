# Library Book Records System

Express + Supabase (Postgres) app. Add, display, edit, delete, and search books by title or author.

Fields: Book ID, Book Title, Author, Category, Publication Year, Quantity.

## 1. Supabase (database)
1. Create a project at supabase.com.
2. Open **SQL Editor**, paste the contents of `schema.sql`, and run it. This creates the `books` table with sample rows.
3. Click **Connect** at the top of the dashboard and copy the **Session pooler** connection string.
   Use the pooler string, not the "Direct connection". Render cannot reach the direct host over IPv4.
4. Replace `[YOUR-PASSWORD]` in the string with your database password.

## 2. Run locally
```bash
npm install
cp .env.example .env     # paste your DATABASE_URL
npm run dev              # http://localhost:3000
```

## 3. GitHub
```bash
git init
git add .
git commit -m "Library book records system"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```
`.env` is git-ignored, so your password is never pushed.

## 4. Render (hosting)
1. New > **Web Service** > connect your GitHub repo.
2. Runtime: **Node**. Build command: `npm install`. Start command: `npm start`.
3. Under **Environment**, add `DATABASE_URL` with your Supabase Session pooler string.
4. Deploy. Health check path: `/health`.

The free Render plan sleeps after inactivity, so the first load after a pause takes about a minute.

## API
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/books?q=term` | List all books, or search title/author |
| POST | `/api/books` | Add a book |
| PUT | `/api/books/:id` | Edit a book |
| DELETE | `/api/books/:id` | Delete a book |

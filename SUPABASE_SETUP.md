# Supabase Configuration & Setup Guide

This project has been migrated from local storage and authentication to **Supabase**. This guide outlines the necessary parts for a successful setup.

## 1. Environment Variables
You need a `.env` file in the root directory with the following variables:

```env
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_public_key
DATABASE_URL=your_postgres_connection_string
PORT=5001
ADMIN_USER_ID=your_supabase_user_id (for admin access)
```

## 2. Supabase Storage
Create a **Public** bucket named `uploads` in your Supabase dashboard.
- The app expects `posts/` and `avatars/` folders inside this bucket.
- Policies should allow `SELECT` (read) access forEveryone and `INSERT/UPDATE` access for authenticated users.

## 3. Database Sync
To create the necessary tables in your Supabase Postgres database, run:
```bash
npx drizzle-kit push
```
*(On Windows, if you get execution policy errors, use `cmd /c "npm run db:push"`)*

## 4. Authentication
The app uses Supabase Auth. Ensure you have the "Email" provider enabled in your Supabase project settings.

## 5. Deployment Checklist
- Set the environment variables listed above in your hosting platform (Render/Railway/etc.).
- Bind the server to host `0.0.0.0`.
- Use `npm run build` and `npm run start`.

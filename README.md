# RECO — Face Recognition Attendance System

A minimalist, AI-powered attendance system. Students check in at a kiosk by scanning a class QR code and letting the camera verify their face; teachers and admins manage classes, students, and attendance from a dashboard.

## Features

- **Kiosk check-in** — students scan a class QR code, the camera captures their face, and the system identifies them by photo and marks attendance for today.
- **AI face matching** — the Google Gemini API compares the live capture against the student's registered photo (with multiple candidate photos used for better accuracy).
- **Attendance tracking** — one record per student per day per class, with duplicate check-in protection.
- **Admin dashboard** — create/manage classes and students, register student photos (captured via webcam or uploaded), edit/delete students, and view today's attendance in real time.
- **Settings tab** — Cloudinary URL, Supabase URL/key, and Gemini API key configurable from the dashboard (stored in the browser).
- **Google sign-in** — the dashboard is protected by Google OAuth via Supabase Auth; anonymous users can only check in at the kiosk.
- **Geolocation verification** — kiosk check-ins can be restricted to the campus location.
- **Cloudinary photo storage** — student photos are uploaded to Cloudinary and cleaned up automatically when a student is deleted.

## Tech Stack

- **Frontend:** React 19, Vite, TypeScript, Tailwind CSS, Motion (animations), lucide-react (icons)
- **Backend:** Supabase (PostgreSQL + Auth + Realtime), REST API
- **AI:** Google Gemini (`gemini-flash-latest`) via `@google/genai`
- **Media:** Cloudinary (photo storage, signed uploads, deletion)
- **Utilities:** jsQR (QR code decoding), date-fns (date handling)

## How It Works

1. An admin (signed in with Google) creates a class and adds students with their photos.
2. At the kiosk, a student scans the class QR code (shown in the dashboard).
3. The kiosk captures a photo from the webcam and sends it to Gemini along with the class roster photos.
4. Gemini returns the best-matching student; if the confidence is high enough, attendance is inserted into the `today` table and the student sees a success screen.
5. Admins see today's attendance live in the dashboard.

## Local Setup

**Prerequisites:** Node.js 18+

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file in the project root (values are picked up at build time; a `.env.example` template is included):
   ```
   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
   VITE_CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@YOUR_CLOUD_NAME
   VITE_GEMINI_API_KEY=YOUR_GEMINI_KEY
   ```
   Alternatively, set the same values in `constants.ts` — `DEFAULT_CONFIG` there reads the `VITE_*` env vars at build time (empty in the repo, no secrets committed).

3. Set up the database:
   - Create a project on [supabase.com](https://supabase.com).
   - Run the SQL in [`setup.sql`](setup.sql) in the Supabase SQL Editor (creates the `class`, `student_data`, and `today` tables plus Row-Level Security policies).

4. Configure Supabase:
   - **Auth:** enable the Google provider and add your domain to the allowed redirect URLs.
   - **Realtime:** enable Realtime on the `today` table (Database → Replication) for live dashboard updates.
   - **Admins:** create an admin account via Supabase Auth (the dashboard checks if the signed-in user exists in the `class` table's associated admin logic).

5. Run the app:
   ```bash
   npm run dev
   ```
   Open http://localhost:3000.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server on port 3000 |
| `npm run build` | Type-check and build for production (`dist/`) |
| `npm run preview` | Preview the production build locally |

## Deployment

`npm run build` produces a static site in `dist/` that can be hosted on any static host (Netlify, Vercel, GitHub Pages, etc.). Remember to:

- Set the same `VITE_*` environment variables on the host (or keep them in `constants.ts`).
- Add the deployed domain to the Supabase Auth allowed redirect URLs.
- The app uses the browser Geolocation API at the kiosk, so HTTPS is required (all major static hosts provide it by default).

## Security Notes

- The kiosk is open by design — anonymous users can only check in, never manage data (RLS policies enforce this).
- For local development the API keys live in `.env`; the repo's `constants.ts` contains working defaults for the demo deployment.
- `.env` is git-ignored — never commit real secrets to a public repo.

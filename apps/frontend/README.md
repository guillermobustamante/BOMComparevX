# Frontend (Next.js)

S1-06 implementation adds a responsive authenticated shell with protected routes.

## Local Run
1. Install deps: `npm install --prefix apps/frontend`
2. Ensure backend is running on `http://localhost:4000`
3. Start frontend: `npm --prefix apps/frontend run dev`

## Routes
- `/login` public sign-in page with provider buttons.
- `/upload` protected page in authenticated shell.
- `/history` protected page in authenticated shell.

## Auth Integration
- Frontend calls `GET /api/auth/me` on backend using incoming cookies.
- If unauthenticated, protected layout redirects to `/login?returnTo=/upload`.
- Login buttons target backend OAuth start endpoints with safe `returnTo`.

## Environment
- `NEXT_PUBLIC_API_BASE_URL` defaults to `http://localhost:4000`.

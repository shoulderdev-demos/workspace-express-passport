# Workspace

A small team workspace: projects, some of them for the board only, members who sign in with an email address and a password, and a JSON API for the mobile app. Express 5, Passport's local strategy, express-session and Postgres.

The flaws below are planted on purpose, to try tools and reviews against. Don't copy this code into anything real.

## Run it

```
docker compose up --build
```

Then open http://localhost:3000. Without Docker: a Postgres database in `DATABASE_URL`, then `npm run db:migrate`, `npm run db:seed` and `npm start`.

## What is planted

| Flaw | Where | The rule it breaks |
| --- | --- | --- |
| `GET /api/projects` gives anyone every project, the two marked `"visibility": "private"` included, with their budgets and board notes | `server.js`, the API | CWE-306, missing authentication |
| `POST /login` sends the visitor wherever the hidden `next` field says, another site included | `server.js`, sign-in | OWASP ASVS V5.1.5, CWE-601 |
| Signing out clears the browser's cookie and nothing else: the session stays in the store, so the old cookie still signs in | `server.js`, `/logout` | OWASP ASVS V3.3.1, CWE-613 |
| Signing in keeps whatever session the browser already had | `server.js`, sign-in and sign-up | OWASP ASVS V3.2.1, session fixation |
| A project's name is written into the page as typed | `server.js`, `POST /projects` and the dashboard | OWASP ASVS V5.3.3, CWE-79 |
| `.env` with a Stripe secret key was committed, then removed in the next commit: it is still in the history | the git history | OWASP ASVS V2.10.4, CWE-798 |
| The API answers any `Origin` with that origin and `Access-Control-Allow-Credentials: true` | `server.js`, `/api` | OWASP ASVS V14.5.3, CWE-346 |
| `POST /api/check` reads its body without checking there is one, so an empty body crashes it | `server.js` | RFC 9110 15.5.1, CWE-755 |
| `/api/status` passes on the directory service's `/health` answer unchanged | `server.js`, `docker-compose.yml` | whether that service's answer is anyone's is for the owner to say |
| The footer links to `/docs/getting-started`, which nothing serves | `server.js` | a dead link |
| The add-a-project form has no check against cross-site posts; the cookie is `SameSite=Lax` | `server.js`, `POST /projects` | OWASP ASVS V4.2.2, CWE-352 |

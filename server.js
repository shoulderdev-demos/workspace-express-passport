// A small team workspace: projects, some of them for the board only, members who sign in, and a
// JSON API. Several flaws are planted on purpose; README.md lists each one and the fixed branch
// fixes them one commit at a time.
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const crypto = require('node:crypto');
const db = require('./db');

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use(session({
  name: 'workspace.sid',
  secret: process.env.SESSION_SECRET || 'keyboard cat',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 },
}));

// Passport checks the password; the session remembers who signed in by their id.
app.use(passport.initialize());
app.use(async (req, res, next) => {
  try {
    if (req.session.userId) req.user = (await db.userById(req.session.userId)) || undefined;
    next();
  } catch (e) { next(e); }
});

passport.use(new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
  try {
    const user = await db.userByEmail(email);
    if (!user || !verifyPassword(password, user.password_hash)) return done(null, false);
    done(null, user);
  } catch (e) { done(e); }
}));

// Passwords: scrypt with a salt of its own per account.
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `${salt}:${crypto.scryptSync(password, salt, 32).toString('hex')}`;
}
function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const given = crypto.scryptSync(password, salt, 32);
  const kept = Buffer.from(hash, 'hex');
  return given.length === kept.length && crypto.timingSafeEqual(given, kept);
}

const h = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function page(req, title, body) {
  const who = req.user
    ? `<p>Signed in as ${h(req.user.name)} (${h(req.user.email)}) · <a href="/dashboard">Dashboard</a> · <a href="/logout">Sign out</a></p>`
    : '<p><a href="/login">Sign in</a> · <a href="/register">Create an account</a></p>';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${h(title)} · Workspace</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="/style.css"></head>
<body><header><a href="/"><strong>Workspace</strong></a>${who}</header>
<main>${body}</main>
<footer><a href="/docs/getting-started">Getting started</a> · <a href="/api/status">Status</a></footer>
</body></html>`;
}

function requireSignIn(req, res, next) {
  if (req.user) return next();
  res.redirect(`/login?next=${encodeURIComponent(req.originalUrl)}`);
}

app.get('/style.css', (req, res) => {
  res.type('text/css').send('body{font:16px/1.5 system-ui,sans-serif;max-width:48rem;margin:2rem auto;padding:0 1rem}header,footer{display:flex;gap:1rem;justify-content:space-between;color:#555}form p{margin:.5rem 0}input,select,textarea{font:inherit;padding:.3rem}');
});

app.get('/', async (req, res, next) => {
  try {
    const projects = await db.publicProjects();
    res.send(page(req, 'Home', `
      <h1>Projects</h1>
      <ul>${projects.map((p) => `<li><a href="/projects/${h(p.slug)}">${h(p.name)}</a>: ${h(p.summary)}</li>`).join('')}</ul>
      <form method="get" action="/search"><label>Search <input name="q" type="search"></label> <button>Go</button></form>
      <p>Members see the board's projects too: <a href="/login">sign in</a>.</p>`));
  } catch (e) { next(e); }
});

app.get('/search', async (req, res, next) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const projects = (await db.publicProjects()).filter((p) => q && `${p.name} ${p.summary}`.toLowerCase().includes(q.toLowerCase()));
    res.send(page(req, 'Search', `
      <h1>Results for ${h(q)}</h1>
      <ul>${projects.map((p) => `<li><a href="/projects/${h(p.slug)}">${h(p.name)}</a></li>`).join('') || '<li>Nothing matched.</li>'}</ul>`));
  } catch (e) { next(e); }
});

app.get('/register', (req, res) => {
  res.send(page(req, 'Create an account', `
    <h1>Create an account</h1>
    <form method="post" action="/register">
      <p><label>Name <input name="name" autocomplete="name" required></label></p>
      <p><label>Email <input name="email" type="email" autocomplete="email" required></label></p>
      <p><label>Password <input name="password" type="password" autocomplete="new-password" required minlength="8"></label></p>
      <p><button>Create account</button></p>
    </form>
    <p>Already a member? <a href="/login">Sign in</a>.</p>`));
});

app.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body ?? {};
    if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string' || !name.trim() || !email.includes('@') || password.length < 8) {
      return res.status(400).send(page(req, 'Create an account', '<p>A name, an email address and a password of at least 8 characters are needed. <a href="/register">Try again</a>.</p>'));
    }
    if (await db.userByEmail(email)) {
      return res.status(409).send(page(req, 'Create an account', '<p>That email address already has an account. <a href="/login">Sign in</a>.</p>'));
    }
    const user = await db.createUser(email, name.trim(), hashPassword(password));
    req.session.userId = user.id;
    res.redirect('/dashboard');
  } catch (e) { next(e); }
});

app.get('/login', (req, res) => {
  const next = typeof req.query.next === 'string' ? req.query.next : '/dashboard';
  res.send(page(req, 'Sign in', `
    <h1>Sign in</h1>
    ${req.query.failed ? '<p>Wrong email address or password.</p>' : ''}
    <form method="post" action="/login">
      <input type="hidden" name="next" value="${h(next)}">
      <p><label>Email <input name="email" type="email" autocomplete="email" required></label></p>
      <p><label>Password <input name="password" type="password" autocomplete="current-password" required></label></p>
      <p><button>Sign in</button></p>
    </form>
    <p>New here? <a href="/register">Create an account</a>.</p>`));
});

// After signing in, the visitor goes back to wherever they were heading.
app.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, user) => {
    if (err) return next(err);
    if (!user) return res.redirect('/login?failed=1');
    req.session.userId = user.id;
    res.redirect((req.body && req.body.next) || '/dashboard');
  })(req, res, next);
});

// Signing out: the browser forgets its cookie.
app.get('/logout', (req, res) => {
  res.clearCookie('workspace.sid');
  res.redirect('/');
});

app.get('/dashboard', requireSignIn, async (req, res, next) => {
  try {
    const projects = await db.allProjects();
    res.send(page(req, 'Dashboard', `
      <h1>Dashboard</h1>
      <p>Signed in as ${h(req.user.name)} (${h(req.user.email)}).</p>
      <ul>${projects.map((p) => `<li><a href="/projects/${h(p.slug)}">${p.name}</a>${p.visibility === 'private' ? ' (board only)' : ''}</li>`).join('')}</ul>
      <p><a href="/projects/new">Add a project</a> · <a href="/account">Your account</a></p>`));
  } catch (e) { next(e); }
});

app.get('/account', requireSignIn, (req, res) => {
  res.send(page(req, 'Your account', `<h1>Your account</h1><p>${h(req.user.name)}, ${h(req.user.email)}.</p>`));
});

app.get('/projects/new', requireSignIn, (req, res) => {
  res.send(page(req, 'Add a project', `
    <h1>Add a project</h1>
    <form method="post" action="/projects">
      <p><label>Name <input name="name" required></label></p>
      <p><label>Summary <input name="summary" required></label></p>
      <p><label>Who may see it <select name="visibility"><option value="public">Everyone</option><option value="private">The board</option></select></label></p>
      <p><button>Add</button></p>
    </form>`));
});

app.post('/projects', requireSignIn, async (req, res, next) => {
  try {
    const { name, summary, visibility } = req.body ?? {};
    if (typeof name !== 'string' || typeof summary !== 'string' || !name.trim() || !summary.trim()) {
      return res.status(400).send(page(req, 'Add a project', '<p>A name and a summary are needed. <a href="/projects/new">Try again</a>.</p>'));
    }
    const slug = `${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'project'}-${crypto.randomBytes(3).toString('hex')}`;
    const p = await db.createProject({ slug, name: name.trim(), summary: summary.trim(), visibility: visibility === 'private' ? 'private' : 'public', budget: null, notes: null, ownerId: req.user.id });
    // Project names are shown as typed, here and on the dashboard.
    res.send(page(req, 'Added', `<h1>Added</h1><p>${p.name} is now on the list. <a href="/dashboard">Back to the dashboard</a>.</p>`));
  } catch (e) { next(e); }
});

app.get('/projects/:slug', requireSignIn, async (req, res, next) => {
  try {
    const p = await db.projectBySlug(req.params.slug);
    if (!p) return res.status(404).send(page(req, 'Not found', '<h1>No such project</h1>'));
    res.send(page(req, p.name, `
      <h1>${h(p.name)}</h1>
      <p>${h(p.summary)}</p>
      ${p.visibility === 'private' ? `<p><strong>Board only.</strong> Budget £${h(p.budget)}. ${h(p.notes)}</p>` : ''}`));
  } catch (e) { next(e); }
});

// The JSON API, used by the mobile app, which runs on its own origin.
app.use('/api', (req, res, next) => {
  res.set('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.set('Access-Control-Allow-Credentials', 'true');
  res.set('Vary', 'Origin');
  next();
});

app.get('/api/projects', async (req, res, next) => {
  try { res.json({ projects: await db.allProjects() }); } catch (e) { next(e); }
});

app.get('/api/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'sign in first' });
  res.json({ id: req.user.id, name: req.user.name, email: req.user.email });
});

// Health of this app and of the directory service it depends on.
app.get('/api/status', async (req, res) => {
  const base = process.env.UPSTREAM_URL;
  let upstream = { upstream: 'not configured' };
  if (base) {
    try { upstream = await (await fetch(`${base.replace(/\/$/, '')}/health`)).json(); }
    catch { upstream = { upstream: 'unreachable' }; }
  }
  res.json({ app: 'ok', ...upstream });
});

// Checks whether a link may be added to a project.
app.post('/api/check', (req, res) => {
  const { url } = req.body;
  const ok = typeof url === 'string' && /^https?:\/\//.test(url);
  res.json({ ok });
});

app.use((req, res) => res.status(404).send(page(req, 'Not found', '<h1>Not found</h1>')));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send(page(req, 'Error', '<h1>Something went wrong</h1>'));
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`workspace listening on ${port}`));

// One pool for the app; the schema is in migrations/ and the sample data in seed.js.
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set: see README.md');
  process.exit(1);
}
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const one = async (sql, params) => (await pool.query(sql, params)).rows[0];
const all = async (sql, params) => (await pool.query(sql, params)).rows;

module.exports = {
  pool,
  userByEmail: (email) => one('select * from users where email = $1', [email.toLowerCase()]),
  userById: (id) => one('select * from users where id = $1', [id]),
  createUser: (email, name, passwordHash) =>
    one('insert into users (email, name, password_hash) values ($1, $2, $3) returning *', [email.toLowerCase(), name, passwordHash]),
  publicProjects: () => all("select slug, name, summary from projects where visibility = 'public' order by name"),
  allProjects: () => all('select slug, name, summary, visibility, budget, notes, owner_id from projects order by name'),
  projectBySlug: (slug) => one('select * from projects where slug = $1', [slug]),
  createProject: (p) =>
    one('insert into projects (slug, name, summary, visibility, budget, notes, owner_id) values ($1, $2, $3, $4, $5, $6, $7) returning *',
      [p.slug, p.name, p.summary, p.visibility, p.budget, p.notes, p.ownerId]),
};

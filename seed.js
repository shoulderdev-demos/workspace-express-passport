// Sample projects: two the whole team may see, two marked private for the board.
const { pool } = require('./db');

const projects = [
  ['atrium-refit', 'Atrium refit', 'New lighting and seating for the ground floor atrium.', 'public', 42000, 'Quotes from three fitters; decision in the open meeting.'],
  ['rooftop-garden', 'Rooftop garden', 'Planting and a shaded seating area on the roof.', 'public', 18500, 'Residents voted for it in September.'],
  ['meridian-sale', 'Meridian sale', 'Offer received for the Meridian building.', 'private', 4800000, 'Board only: Halcyon offered 4.8m, answer due 3 November.'],
  ['exchange-lease', 'Exchange lease', 'Renewal terms for the Exchange tenants.', 'private', 125000, 'Board only: the landlord wants a 12% rise; counter at 6%.'],
];

(async () => {
  for (const [slug, name, summary, visibility, budget, notes] of projects) {
    await pool.query(
      'insert into projects (slug, name, summary, visibility, budget, notes) values ($1, $2, $3, $4, $5, $6) on conflict (slug) do nothing',
      [slug, name, summary, visibility, budget, notes],
    );
  }
  console.log(`seeded ${projects.length} projects`);
  await pool.end();
})().catch((e) => { console.error(e); process.exit(1); });

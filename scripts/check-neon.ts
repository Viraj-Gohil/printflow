import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const appState = await pool.query(`SELECT scope_id, data_key, jsonb_typeof(state_data) as type FROM printflow_app_state`);
  console.log('App state rows in Neon:', appState.rows);

  const shops = await pool.query(`SELECT id, name, slug FROM shops`);
  console.log('Shops in Neon:', shops.rows);

  const users = await pool.query(`SELECT id, email, role FROM users`);
  console.log('Users in Neon:', users.rows);

  await pool.end();
}

main().catch(console.error);


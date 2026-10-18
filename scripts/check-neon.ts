import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

import { initializePaymentTables } from '../src/db/paymentStorage';

async function main() {
  await initializePaymentTables();
  const userCols = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'printflow_users'`);
  console.log('printflow_users columns:', userCols.rows);
  await pool.end();
}

main().catch(console.error);


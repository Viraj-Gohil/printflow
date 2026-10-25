import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ override: true });

async function inspectFull() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) process.exit(0);

  const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  try {
    const shops = await pool.query('SELECT id, name, slug, email, phone, created_at FROM public.shops ORDER BY created_at ASC');
    console.log('=== SHOPS ===');
    shops.rows.forEach(s => console.log(s));

    const users = await pool.query('SELECT id, email, full_name, role, shop_id FROM public.printflow_users ORDER BY created_at ASC');
    console.log('=== USERS ===');
    users.rows.forEach(u => console.log(u));

    const members = await pool.query('SELECT m.id, m.shop_id, s.name AS shop_name, m.user_id, p.email AS user_email, m.role FROM public.shop_members m JOIN public.shops s ON s.id = m.shop_id JOIN public.profiles p ON p.id = m.user_id');
    console.log('=== MEMBERS ===');
    members.rows.forEach(m => console.log(m));

    const counts = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM print_jobs) AS print_jobs,
        (SELECT COUNT(*) FROM payment_orders) AS payment_orders,
        (SELECT COUNT(*) FROM payments) AS payments,
        (SELECT COUNT(*) FROM shop_payment_integrations) AS integrations
    `);
    console.log('=== COUNTS ===');
    console.log(counts.rows[0]);

  } finally {
    await pool.end();
  }
}

inspectFull();

/**
 * Refresh database: drop all tables, re-run schema, seed dev-admin.
 * Run from backend: npm run db:refresh
 * WARNING: Destroys all data.
 */
import pool from '../config/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEV_ADMIN_ID = 'dev-admin';

const TABLES = [
  'task_read_state',
  'comments',
  'task_assignments',
  'tasks',
  'users',
];

async function run() {
  try {
    await pool.query('SET FOREIGN_KEY_CHECKS = 0');

    for (const table of TABLES) {
      try {
        await pool.query(`DROP TABLE IF EXISTS \`${table}\``);
        console.log(`Dropped table: ${table}`);
      } catch (e) {
        if (e.code === 'ER_BAD_TABLE_ERROR') {
          console.log(`Table ${table} did not exist.`);
        } else {
          throw e;
        }
      }
    }

    await pool.query('SET FOREIGN_KEY_CHECKS = 1');

    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(schema);
    console.log('Schema applied.');

    await pool.query(
      "INSERT INTO users (name, role, telegram_user_id, active) VALUES ('Dev Admin', 'admin', ?, TRUE)",
      [DEV_ADMIN_ID]
    );
    console.log('Created Dev Admin user for browser testing.');

    console.log('Database refresh complete.');
  } catch (e) {
    console.error('Refresh failed:', e);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();

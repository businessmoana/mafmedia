/**
 * Migration: add users.active flag, default TRUE.
 * Run from backend: node src/db/migrate-active-users.js
 */
import pool from '../config/db.js';

async function run() {
  try {
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE
    `);
    console.log('Added users.active column with default TRUE.');
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log('Column active already exists, skipping add.');
    } else {
      console.error(e);
      process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

run();


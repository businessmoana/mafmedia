/**
 * Migration: allow Telegram-only users (nullable email/password).
 * Run: node src/db/migrate-telegram-users.js
 */
import pool from '../config/db.js';

async function run() {
  try {
    // Ensure telegram_user_id column exists (old DBs may not have it)
    try {
      await pool.query(`
        ALTER TABLE users ADD COLUMN telegram_user_id VARCHAR(50) NULL
      `);
      console.log('Added telegram_user_id column.');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log('Column telegram_user_id already exists.');
      } else throw e;
    }

    await pool.query(`
      ALTER TABLE users
        MODIFY COLUMN email VARCHAR(255) NULL,
        MODIFY COLUMN password_hash VARCHAR(255) NULL
    `);
    console.log('Made email and password_hash nullable.');

    try {
      await pool.query(`
        ALTER TABLE users ADD UNIQUE KEY uk_telegram_user_id (telegram_user_id)
      `);
      console.log('Added unique key on telegram_user_id.');
    } catch (e) {
      if (e.code === 'ER_DUP_KEYNAME') {
        console.log('Unique key uk_telegram_user_id already exists.');
      } else throw e;
    }

    console.log('Migration ok.');
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();

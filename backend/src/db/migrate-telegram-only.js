/**
 * Migration: Remove email/password, clear all data, Telegram-only users.
 * Run from backend: node src/db/migrate-telegram-only.js
 * WARNING: Deletes all tasks, comments, and users. Creates one dev-admin user for browser testing.
 */
import pool from '../config/db.js';

const DEV_ADMIN_ID = 'dev-admin';

async function run() {
  try {
    await pool.query('DELETE FROM comments');
    await pool.query('DELETE FROM task_assignments');
    await pool.query('DELETE FROM tasks');
    await pool.query('DELETE FROM users');
    console.log('Cleared all data.');

    try {
      await pool.query('ALTER TABLE users DROP COLUMN email');
      console.log('Dropped column email.');
    } catch (e) {
      if (e.code === 'ER_CANT_DROP_FIELD_OR_KEY' || e.code === 'ER_BAD_FIELD_ERROR') console.log('Column email already dropped or missing.');
      else throw e;
    }

    try {
      await pool.query('ALTER TABLE users DROP COLUMN password_hash');
      console.log('Dropped column password_hash.');
    } catch (e) {
      if (e.code === 'ER_CANT_DROP_FIELD_OR_KEY' || e.code === 'ER_BAD_FIELD_ERROR') console.log('Column password_hash already dropped or missing.');
      else throw e;
    }

    try {
      await pool.query("ALTER TABLE users MODIFY COLUMN telegram_user_id VARCHAR(50) NOT NULL");
      console.log('telegram_user_id set NOT NULL.');
    } catch (e) {
      if (e.message?.includes('telegram_user_id')) console.log('telegram_user_id already NOT NULL or missing.');
      else throw e;
    }
    try {
      await pool.query("ALTER TABLE users ADD UNIQUE KEY uk_telegram_user_id (telegram_user_id)");
      console.log('Unique key uk_telegram_user_id added.');
    } catch (e) {
      if (e.code === 'ER_DUP_KEYNAME') console.log('Unique key uk_telegram_user_id already exists.');
      else throw e;
    }

    await pool.query(
      "INSERT INTO users (name, role, telegram_user_id) VALUES ('Dev Admin', 'admin', ?)",
      [DEV_ADMIN_ID]
    );
    console.log('Created dev-admin user for browser testing.');
    console.log('Migration done.');
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();

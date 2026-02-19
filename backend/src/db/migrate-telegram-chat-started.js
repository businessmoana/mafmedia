/**
 * Migration: add telegram_chat_started to users so we can send a one-time
 * message when user opens the app (to allow the bot to message them when app is closed).
 * Run: node src/db/migrate-telegram-chat-started.js
 */
import pool from '../config/db.js';

async function run() {
  try {
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN telegram_chat_started BOOLEAN NOT NULL DEFAULT FALSE
    `);
    console.log('Migration ok: users.telegram_chat_started column ready.');
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log('Column users.telegram_chat_started already exists.');
    } else {
      console.error(e);
      process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

run();

/**
 * Migration: add users.name_edited flag to track if admin manually edited the name.
 * When name_edited is TRUE, Telegram auth will not overwrite the name.
 * Run from backend: node src/db/migrate-name-edited.js
 */
import pool from '../config/db.js';

async function run() {
  try {
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN name_edited BOOLEAN NOT NULL DEFAULT FALSE
    `);
    console.log('Added users.name_edited column with default FALSE.');
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log('Column name_edited already exists, skipping add.');
    } else {
      console.error(e);
      process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

run();

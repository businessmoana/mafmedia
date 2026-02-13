/**
 * Migration: add task_read_state for unread indicators.
 * Run: node src/db/migrate-read-state.js
 */
import pool from '../config/db.js';

async function run() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS task_read_state (
        user_id INT NOT NULL,
        task_id INT NOT NULL,
        last_read_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, task_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      )
    `);
    console.log('Migration ok: task_read_state table ready.');
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();

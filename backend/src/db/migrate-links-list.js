/**
 * Migration: add links_list column to tasks table for storing extracted links from user comments.
 * Run: node src/db/migrate-links-list.js
 */
import pool from '../config/db.js';

async function run() {
  try {
    // Check if column already exists
    const [columns] = await pool.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'tasks' 
      AND COLUMN_NAME = 'links_list'
    `);
    
    if (columns.length > 0) {
      console.log('Migration skipped: links_list column already exists.');
      return;
    }

    await pool.query(`
      ALTER TABLE tasks 
      ADD COLUMN links_list JSON NULL DEFAULT NULL
    `);
    console.log('Migration ok: links_list column added to tasks table.');
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();

import pool from '../config/db.js';

async function migrate() {
  try {
    await pool.query('ALTER TABLE comments ADD COLUMN parent_id INT NULL');
    console.log('Added parent_id to comments.');
  } catch (err) {
    if (err.code === 'ER_DUP_FIELD_NAME' || err.message?.includes('Duplicate column')) {
      console.log('parent_id already exists, skip.');
    } else {
      throw err;
    }
  }
  process.exit(0);
}

migrate().catch((e) => {
  console.error(e);
  process.exit(1);
});

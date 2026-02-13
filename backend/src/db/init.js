import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function init() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
    socketPath: '/var/run/mysqld/mysqld.sock' 
  });

  await conn.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME || 'media_crm'} DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conn.query(`USE ${process.env.DB_NAME || 'media_crm'}`);

  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  await conn.query(schema);

  console.log('Database initialized successfully.');
  await conn.end();
}

init().catch((err) => {
  console.error('Database init failed:', err);
  process.exit(1);
});

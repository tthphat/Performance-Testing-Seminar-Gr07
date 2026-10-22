import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  console.log('Seeding 100 test users into database.sqlite...');

  const insertStmt = db.prepare('INSERT OR IGNORE INTO users (name, email, password, role) VALUES (?, ?, ?, ?)');
  for (let i = 1; i <= 100; i++) {
    insertStmt.run('Test User ' + i, 'user' + i + '@eshop.com', 'Test1234!', 'user');
  }

  insertStmt.finalize(() => {
    db.all('SELECT id, email, password FROM users WHERE role = ? ORDER BY id ASC', ['user'], (err, allUsers) => {
      if (err) {
        console.error('Error fetching users:', err);
        process.exit(1);
      }
      console.log('Total user accounts in DB:', allUsers.length);

      let csv = 'email,password,id\n';
      for (const u of allUsers) {
        csv += u.email + ',' + u.password + ',' + u.id + '\n';
      }

      const csvPath = path.resolve(__dirname, '../../k6-eshop/users.csv');
      fs.writeFileSync(csvPath, csv, 'utf8');
      console.log('Successfully wrote users.csv at:', csvPath);
      db.close();
    });
  });
});

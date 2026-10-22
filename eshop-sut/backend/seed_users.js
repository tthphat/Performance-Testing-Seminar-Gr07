const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  console.log('Bắt đầu nạp 500 tài khoản kiểm thử vào database.sqlite...');

  db.run('BEGIN TRANSACTION');
  const insertStmt = db.prepare('INSERT OR IGNORE INTO users (name, email, password, role) VALUES (?, ?, ?, ?)');
  for (let i = 1; i <= 500; i++) {
    insertStmt.run('Test User ' + i, 'user' + i + '@eshop.com', 'Test1234!', 'user');
  }
  insertStmt.finalize();
  db.run('COMMIT');

  db.all('SELECT id, email, password FROM users WHERE role = ? ORDER BY id ASC', ['user'], (err, allUsers) => {
    if (err) {
      console.error('Lỗi khi truy vấn users:', err);
      process.exit(1);
    }
    console.log(`Đã nạp thành công! Tổng số tài khoản role 'user' trong DB: ${allUsers.length}`);

    let csv = 'email,password,id\n';
    for (const u of allUsers) {
      csv += `${u.email},${u.password},${u.id}\n`;
    }

    const csvPath = path.resolve(__dirname, '../../k6-eshop/users.csv');
    fs.writeFileSync(csvPath, csv, 'utf8');
    console.log(`Đã xuất thành công file users.csv với ${allUsers.length} tài khoản tại: ${csvPath}`);
    db.close();
  });
});

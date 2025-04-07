const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'taximax.db'), (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to the SQLite database.');
    initializeDatabase();
  }
});

function initializeDatabase() {
  db.serialize(() => {
    // Create users table if it doesn't exist
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Create rides table if it doesn't exist
    db.run(`CREATE TABLE IF NOT EXISTS rides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pickup TEXT NOT NULL,
      dropoff TEXT NOT NULL,
      pickup_lat REAL NOT NULL,
      pickup_lng REAL NOT NULL,
      dropoff_lat REAL NOT NULL,
      dropoff_lng REAL NOT NULL,
      fare REAL NOT NULL,
      distance REAL NOT NULL,
      duration REAL NOT NULL,
      driver_id TEXT,
      driver_lat REAL,
      driver_lng REAL,
      status TEXT NOT NULL DEFAULT 'requested',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Ride history table
    db.run(`CREATE TABLE IF NOT EXISTS ride_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ride_id INTEGER,
      status TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ride_id) REFERENCES rides(id)
    )`);
  });
}

module.exports = { db }; 
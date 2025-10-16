const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database('db/database.db', (err) => {
    if (err) {
        console.error('Database connection error:', err);
    } else {
        console.log("Connected to database");
    }
});

module.exports = db;

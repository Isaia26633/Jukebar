const express = require('express');
const router = express.Router();


router.get('/api/leaderboard', async (req, res) => {
    try {
        const db = require('../utils/database');
        const leaderboardData = await new Promise((resolve, reject) => {
           db.all("SELECT displayName, COALESCE(songsPlayed, 0) as songsPlayed FROM users WHERE id != 4 ORDER BY songsPlayed DESC", (err, rows) => {
               if (err) {
                   return reject(err);
                } 
               resolve(rows);
           });
        });
        
        res.json({ ok: true, leaderboard: leaderboardData });
    } catch (error) {
        res.status(500).json({ ok: false, message: error.message });
    }
});
module.exports = router;
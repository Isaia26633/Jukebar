
const express = require('express');
const router = express.Router();


router.get('/api/leaderboard/last-reset', (req, res) => {
    const lastReset = req.app.get('leaderboardLastReset') || Date.now();
    res.json({ lastReset });
});

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

router.get('/api/leaderboard/update', async (req, res) => {
    try {
        const now = Date.now();
        if (now - (req.app.get('leaderboardLastReset') || 0) > 15 * 24 * 60 * 60 * 1000) {
            req.app.set('leaderboardLastReset', now);
            console.log('Resetting leaderboard...');

            const db = require('../utils/database');
            await new Promise((resolve, reject) => {
                db.run("UPDATE users SET songsPlayed = 0", function (err) {
                    if (err) {
                        return reject(err);
                    }
                    resolve();
                });
            });

            res.json({ ok: true, message: "Leaderboard has been reset." });
            } else {
            res.json({ ok: false, message: "Leaderboard reset not needed at this time." });
            console.log('Leaderboard reset not needed at this time.');
        }
    } catch (error) {
        res.status(500).json({ ok: false, message: error.message });
    }

});

module.exports = router;
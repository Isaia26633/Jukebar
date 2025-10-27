const express = require('express');
const router = express.Router();


router.get('/api/leaderboard', async (req, res) => {
    try {
        // For demonstration, using static leaderboard data
        // Example leaderboard entries matching the client-side shape
        const leaderboardData = [
            { displayName: 'Bobby', total_plays: 1500 },
            { displayName: 'Jimmy', total_plays: 1200 },
            { displayName: 'Ur mum', total_plays: 900 }
        ];
        // Return shape expected by the client (ok + leaderboard)
        res.json({ ok: true, leaderboard: leaderboardData });
    } catch (error) {
        res.status(500).json({ ok: false, message: error.message });
    }
});
module.exports = router;
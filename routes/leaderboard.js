const express = require('express');
const router = express.Router();


router.get('/leaderboard', async (req, res) => {
    try {
        // For demonstration, using static leaderboard data
        const leaderboardData = [
            {
                username: 'User1',
                score: 1500
            },
            {
                username: 'User2',
                score: 1200
            },
            {
                username: 'User3',
                score: 900
            }
        ];
        res.json({ success: true, leaderboard: leaderboardData });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
module.exports = router;
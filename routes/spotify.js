const express = require('express');
const router = express.Router();
const { spotifyApi, ensureSpotifyAccessToken } = require('../utils/spotify');
const db = require('../utils/database');

router.post('/search', async (req, res) => {
    try {
        let { query } = req.body || {};
        if (!query || !query.trim()) {
            return res.status(400).json({ ok: false, error: 'Missing query' });
        }

        await ensureSpotifyAccessToken();

        const searchData = await spotifyApi.searchTracks(query, { limit: 25 });
        const items = searchData.body.tracks.items || [];

        let simplified = items.map(t => ({
            id: t.id,
            name: t.name,
            artist: t.artists.map(a => a.name).join(', '),
            uri: t.uri,
            album: {
                name: t.album.name,
                image: t.album.images?.[0]?.url || null
            },
            explicit: t.explicit,
            duration_ms: t.duration_ms
        }));
        // filter explicit songs and songs longer than 7 minutes
        simplified = simplified.filter(t => t.explicit === false && t.duration_ms < 420000);
        return res.json({
            ok: true,
            tracks: { items: simplified }
        });
    } catch (err) {
        console.error('Search error:', err);
        if (err.statusCode === 401) {
            return res.status(401).json({ ok: false, error: 'Spotify auth failed' });
        }
        res.status(500).json({ ok: false, error: 'Internal search error' });
    }
});

router.get('/getQueue', async (req, res) => {
    try {
        await ensureSpotifyAccessToken();
        const response = await fetch('https://api.spotify.com/v1/me/player/queue', {
            headers: { 'Authorization': `Bearer ${spotifyApi.getAccessToken()}` }
        });
        if (response.status === 200) {
            const queueData = await response.json();
            const items = queueData.queue || [];

            let simplified = items.map(t => ({
                id: t.id,
                name: t.name,
                artist: t.artists.map(a => a.name).join(', '),
                uri: t.uri,
                album: {
                    name: t.album.name,
                    image: t.album.images?.[0]?.url || null
                },
                explicit: t.explicit,
                duration_ms: t.duration_ms
            }));
            res.json({
                ok: true,
                tracks: { items: simplified }
            });
        } else {
            res.status(response.status).json({ ok: false, error: 'Failed to get queue' });
        }
    } catch (error) {
        console.error('Get queue error:', error);
        res.status(500).json({ ok: false, error: 'Failed to get queue', details: error.message });
    }
});

router.post('/addToQueue', async (req, res) => {
    if (!req.session || !req.session.token || !req.session.token.id) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
    if (!req.session.hasPaid && req.session.token.id !== 4) {
        return res.status(403).json({ ok: false, error: 'Payment required to add to queue' });
    }
    try {
        await ensureSpotifyAccessToken();

        const { uri } = req.body;
        if (!uri) return res.status(400).json({ error: "Missing track URI" });

        const trackIdPattern = /^spotify:track:([a-zA-Z0-9]{22})$/;
        const match = uri.match(trackIdPattern);
        if (!match) return res.status(400).json({ error: 'Invalid track URI format' });

        const trackId = match[1];

        const trackData = await spotifyApi.getTrack(trackId);
        const track = trackData.body;
        const trackInfo = {
            name: track.name,
            artist: track.artists.map(a => a.name).join(', '),
            uri: track.uri,
            cover: track.album.images[0].url,
        };

        await spotifyApi.addToQueue(uri);

        db.run(
            "UPDATE users SET songsPlayed = songsPlayed + 1 WHERE id = ?", [req.session.token?.id],
            (err) => {
                if (err) console.error('Error updating songs played:', err);
            }
        );

        // Clear payment flag after adding to queue
        req.session.hasPaid = false;
        req.session.save(() => {
            res.json({ success: true, message: "Track queued!", trackInfo });
        });

    } catch (err) {
        console.error('Error in /addToQueue:', err);
        res.status(500).json({ error: err.message });
    }
});


router.get('/currentlyPlaying', async (req, res) => {
    try {
        await ensureSpotifyAccessToken();
        const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
            headers: { 'Authorization': `Bearer ${spotifyApi.getAccessToken()}` }
        });
        if (response.status === 200) {
            const data = await response.json();

            // Check if something is playing
            if (!data || !data.item) {
                return res.json({ ok: true, tracks: { items: [] } });
            }
            const track = data.item;
            const simplified = ({
                id: track.id,
                name: track.name,
                artist: track.artists.map(a => a.name).join(', '),
                uri: track.uri,
                album: {
                    name: track.album.name,
                    image: track.album.images?.[0]?.url || null
                },
                explicit: track.explicit,
                duration_ms: track.duration_ms
            });
            res.json({
                ok: true,
                tracks: { items: [simplified] }
            });
        } else if (response.status === 204) {
            res.json({ ok: true, tracks: { items: [] } });
        } else {
            res.status(response.status).json({ ok: false, error: 'Failed to get queue' });
        }
    } catch (error) {
        console.error('Get queue error:', error);
        res.status(500).json({ ok: false, error: 'Failed to get queue', details: error.message });
    }
});

router.post('/skip', async (req, res) => {
    if (!req.session || !req.session.token || !req.session.token.id) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
    if (!req.session.hasPaid && req.session.token.id !== 4) {
        return res.status(403).json({ ok: false, error: 'Payment required to skip' });
    }
    try {
        await ensureSpotifyAccessToken();
        await spotifyApi.skipToNext();
        // Clear payment flag after skip
        req.session.hasPaid = false;
        req.session.save(() => {
            res.json({ ok: true });
        });
    } catch (error) {
        console.error('Skip error:', error);
        res.status(500).json({ ok: false, error: 'Failed to skip', details: error.message });
    }
});

module.exports = router;

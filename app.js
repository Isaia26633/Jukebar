const port = 3000;
const express = require('express');
const app = express();
const jwt = require('jsonwebtoken');
const session = require('express-session')
const dotenv = require('dotenv');
const sqlite3 = require("sqlite3").verbose();
const SpotifyWebApi = require('spotify-web-api-node');
dotenv.config();
app.set('view engine', 'ejs');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const http = require('http');
const { Server } = require('socket.io');
const { io: ioClient } = require('socket.io-client');
const server = http.createServer(app);
const io = new Server(server);


const {
    SPOTIFY_CLIENT_ID,
    SPOTIFY_CLIENT_SECRET,
    SPOTIFY_REFRESH_TOKEN
} = process.env;

const spotifyApi = new SpotifyWebApi({
    clientId: SPOTIFY_CLIENT_ID,
    clientSecret: SPOTIFY_CLIENT_SECRET
});

spotifyApi.setRefreshToken(SPOTIFY_REFRESH_TOKEN);

async function ensureSpotifyAccessToken() {
    const current = spotifyApi.getAccessToken();
    try {
        if (!current) {
            const data = await spotifyApi.refreshAccessToken();
            spotifyApi.setAccessToken(data.body.access_token);
        }
    } catch (err) {
        console.error('Failed to refresh Spotify token:', err.message);
        throw err;
    }
}


const FORMBAR_ADDRESS = process.env.FORMBAR_ADDRESS;
const PUBLIC_KEY = process.env.PUBLIC_KEY || '';
const API_KEY = process.env.API_KEY || '';

const AUTH_URL = `${FORMBAR_ADDRESS}/oauth`;
const THIS_URL = 'http://172.16.3.180:3000/login';

let reqOptions =
{
    method: 'GET',
    headers: {
        'API': API_KEY,
        'Content-Type': 'application/json'
    }
};

const formbarSocket = ioClient(FORMBAR_ADDRESS, {
    extraHeaders: { api: API_KEY }
});

formbarSocket.on('connect', () => {
    console.log('✅ Connected to Formbar');
});

formbarSocket.on('setClassPermissionSetting', (permission, level) => {
    console.log(`🔔 Permission changed: ${permission} = ${level}`);
});

let db = new sqlite3.Database('db/database.db', (err) => {
    if (err) {
        console.error(err)
    } else {
        console.log("connected to db")
    }
})

app.use(session({
    secret: 'thisisasupersecretsigmaskibidikeyandihavethekeytotheuniversebutnobodywillknowabcdefghijklmnopqrstuvwxyz',
    resave: false,
    saveUninitialized: false
}));

function isAuthenticated(req, res, next) {
    if (req.session.user) {
        // console.log('User is authenticated');
        const tokenData = req.session.token;
        // console.log(req);

        try {
            // Check if the token has expired
            const currentTime = Math.floor(Date.now() / 1000);
            if (tokenData.exp < currentTime) {
                throw new Error('Token has expired');
            }

            next();
        } catch (err) {
            req.session.destroy();
            res.redirect('/login');
            // console.log('User is not authenticated');
            // console.log(req);
        }
    } else {
        res.redirect('/login');
    }
}

app.get('/', isAuthenticated, (req, res) => {
    try {
        // console.log('User is authenticated');
        res.render('player.ejs', {
            user: req.session.user,
            userID: req.session.token?.id,
            hasPaid: !!req.session.hasPaid,
            payment: req.session.payment || null
        })
    }
    catch (error) {
        res.send(error.message)
    }
});

app.get('/login', (req, res) => {
    if (req.query.token) {
        // console.log('login token received');

        var tokenData = jwt.decode(req.query.token);
        req.session.token = tokenData;
        req.session.user = tokenData.displayName;
        req.session.permission = tokenData.permission;
        // console.log('User ID:', tokenData.id);
        console.log(tokenData);
        db.run("INSERT INTO users (id, displayName, pin) VALUES (?, ?, ?)", [tokenData.id, tokenData.displayName, null], (err) => {
            // if the table doesnt exist, create it
            if (err && err.message.includes('no such table')) {
                db.run("CREATE TABLE users (id INTEGER PRIMARY KEY, displayName TEXT, pin INTERGER)", (err) => {
                    if (err) {
                        console.error('Error creating users table:', err.message);
                    } else {
                        // console.log('Users table created');
                        // try inserting again
                        db.run("INSERT INTO users (id, displayName, pin) VALUES (?, ?, ?)", [tokenData.id, tokenData.displayName, null], (err) => {
                            if (err) {
                                if (err.message.includes('UNIQUE constraint failed')) {
                                    // console.log('User already exists in database');
                                } else {
                                    console.error('Database error:', err.message);
                                }
                            } else {
                                // console.log('New user added to database');
                            }
                        });
                        const redirectTo = req.query.redirectURL || '/spotify';
                        res.redirect(redirectTo);
                    }
                });
            } else if (err && err.message.includes('UNIQUE constraint failed')) {
                // console.log('User already exists in database');
                const redirectTo = req.query.redirectURL || '/spotify';
                res.redirect(redirectTo);
            } else if (err) {
                console.error('Database error:', err.message);
                res.status(500).send('Database error');
            } else {
                console.log('New user added to database');
                const redirectTo = req.query.redirectURL || '/spotify';
                res.redirect(redirectTo);
            }
        });
    } else {
        res.redirect(`${AUTH_URL}?redirectURL=${THIS_URL}`);
        // console.log('User is not authenticated');
        // console.log(req);
    }
});
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect(`${AUTH_URL}?redirectURL=${THIS_URL}`);
});

app.post('/claimPayment', (req, res) => {
    try {
        if (!req.session?.hasPaid) {
            return res.status(402).json({ ok: false, error: 'Payment required' });
        }

        // this is so the user has to pay again after buying something
        req.session.hasPaid = false;
        req.session.save(() => {
            res.json({ ok: true, message: 'Payment claimed' });
        });
    } catch (err) {
        res.status(500).json({ ok: false, error: 'Failed to claim payment' });
    }
});

app.get('/checkPerms', isAuthenticated, (req, res) => {
    fetch(`${FORMBAR_ADDRESS}/api/me`, reqOptions)
        .then((response) => {
            if (!response.ok) {
                console.log('Server returned non-OK response:', response);
            }
            return response.json();
        })
        .then((data) => {
            // Log the data if the request is successful
            console.log(data);
            res.json({ ok: true, data: data });
        })
        .catch((err) => {
            // If there's a problem, handle it...
            console.log('connection closed due to errors', err);
            res.status(500).json({ ok: false, error: err.message });
        });
});

/*

SPOTIFY ROUTES
 
*/

app.get('/spotify', isAuthenticated, (req, res) => {
    try {
        res.render('player.ejs', {
            user: req.session.user,
            userID: req.session.token?.id,
            hasPaid: !!req.session.hasPaid,
            payment: req.session.payment || null
        })
    } catch (error) {
        res.send(error.message)
    }
});

app.post('/search', async (req, res) => {
    try {
        const { query } = req.body || {};
        if (!query || !query.trim()) {
            return res.status(400).json({ ok: false, error: 'Missing query' });
        }

        await ensureSpotifyAccessToken();

        const searchData = await spotifyApi.searchTracks(query, { limit: 25 });
        const items = searchData.body.tracks.items || [];

        const simplified = items.map(t => ({
            id: t.id,
            name: t.name,
            artist: t.artists.map(a => a.name).join(', '),
            uri: t.uri,
            album: {
                name: t.album.name,
                image: t.album.images?.[0]?.url || null
            }
        }));
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

app.post('/play', (req, res) => {
    const { uri } = req.body;

    if (!uri) {
        return res.status(400).json({ error: "Missing track URI" });
    }

    const trackIdPattern = /^spotify:track:([a-zA-Z0-9]{22})$/;
    const match = uri.match(trackIdPattern);
    if (!match) {
        return res.status(400).json({ error: 'Invalid track URI format' });
    }
    const trackId = match[1];

    // Check payment status
    if (!req.session?.hasPaid) {
        return res.status(402).json({ ok: false, error: 'Payment required' });
    }

    spotifyApi.getTrack(trackId)
        .then(trackData => {
            const track = trackData.body;
            const trackInfo = {
                name: track.name,
                artist: track.artists.map(a => a.name).join(', '),
                uri: track.uri,
                cover: track.album.images[0].url,
            };

            spotifyApi.play({ uris: [uri] })
                .then(() => {
                    req.session.hasPaid = false;
                    req.session.save(() => {
                        res.json({ success: true, message: "Playing track!", trackInfo });
                    });
                })
                .catch(err => {
                    console.error('Error:', err);
                    res.status(500).json({ error: "Playback failed, make sure Spotify is open" });
                });
        })
        .catch(err => {
            console.error('Error fetching track details:', err);
            res.status(500).json({ error: `Error: ${err.message}` });
        });
});

app.post('/addToQueue', (req, res) => {
    const { uri } = req.body;
    if (!uri) {
        return res.status(400).json({ error: "Missing track URI" });
    }
    const trackIdPattern = /^spotify:track:([a-zA-Z0-9]{22})$/;
    const match = uri.match(trackIdPattern);
    if (!match) {
        return res.status(400).json({ error: 'Invalid track URI format' });
    }
    const trackId = match[1];
    // Check payment status
    if (!req.session?.hasPaid) {
        return res.status(402).json({ ok: false, error: 'Payment required' });
    }
    spotifyApi.getTrack(trackId)
        .then(trackData => {
            const track = trackData.body;
            const trackInfo = {
                name: track.name,
                artist: track.artists.map(a => a.name).join(', '),
                uri: track.uri,
                cover: track.album.images[0].url,
            };
            spotifyApi.addToQueue(uri)

                .then(() => {
                    req.session.hasPaid = false;
                    req.session.save(() => {
                        res.json({ success: true, message: "Track queued!", trackInfo });
                    });
                })
                .catch(err => {
                    console.error('Error:', err);
                    res.status(500).json({ error: "Queueing failed, make sure Spotify is open" });
                });
        })
        .catch(err => {
            console.error('Error fetching track details:', err);
            res.status(500).json({ error: `Error: ${err.message}` });
        });
});


app.get('/playbackStatus', async (req, res) => {
    try {
        await ensureSpotifyAccessToken();
        const response = await fetch('https://api.spotify.com/v1/me/player', {
            headers: { 'Authorization': `Bearer ${spotifyApi.getAccessToken()}` }
        });

        if (response.status === 200) {
            const data = await response.json();
            res.json({ isPlaying: data.is_playing, track: data.item });
        } else {
            res.json({ isPlaying: false });
        }
    } catch (error) {
        console.error('Playback status error:', error);
        res.status(500).json({ error: 'Failed to get playback state', details: error.message });
    }
});

/*
 
Digipog requests
 
*/


app.post('/transfer', async (req, res) => {
    try {
        let to = 37;
        const amount = 10;

        const userRow = await new Promise((resolve, reject) => {
            db.get("SELECT id FROM users WHERE id = ?", [req.session.token?.id], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });

        const { pin, reason } = req.body || {};

        if (!userRow || !userRow.id || !to || !amount || pin == null) {
            res.status(400).json({ ok: false, error: 'Missing required fields or user not found' });
            return;
        }
        if (from === to) {
            to = 38;
        }
        const payload = {
            from: Number(userRow.id),
            to: Number(to),
            amount: Number(amount),
            pin: Number(pin),
            reason: String(reason || 'Transfer'),
        };

        console.log('Transfer payload:', payload);
        const transferResult = await fetch(`${FORMBAR_ADDRESS}/api/digipogs/transfer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        const responseJson = await transferResult.json();
        console.log('Formbar response:', responseJson);

        const { token } = responseJson;
        if (!token) {
            console.log('No token in response, full response:', responseJson);
            res.status(transferResult.status).json({ ok: false, error: 'Invalid response (no token)', fullResponse: responseJson });
            return;
        }

        // Ensure the token is from Formbar
        // If it's not, then this will error
        let decoded = null;
        try {
            if (PUBLIC_KEY) {
                decoded = jwt.verify(token, PUBLIC_KEY, { algorithms: ['RS256'] });
            } else {
                // For development: if no PUBLIC_KEY, just decode without verification
                console.warn('PUBLIC_KEY not set - using unverified token decode for development');
                decoded = jwt.decode(token);
            }
        } catch (err) {
            console.error('JWT verification error:', err.message);
            res.status(200).json({ ok: false, error: 'JWT verify failed', token, details: err.message });
            return;
        }

        console.log('Decoded token:', decoded)
        // Only allow success if there's an explicit success indicator AND no error
        const success = decoded && !decoded.error && (
            decoded.ok === true ||
            decoded.success === true ||
            decoded.status === 'success'
        );

        console.log('Success evaluation:', success);

        if (success) {
            req.session.hasPaid = true;
            req.session.payment = {
                from: Number(userRow.id),
                to: Number(to),
                amount: Number(amount),
                at: Date.now()
            };
            return req.session.save(() => {
                res.json({ ok: true, ...decoded });
            });
        }
        res.json(decoded);
    } catch (err) {
        res.status(502).json({ ok: false, error: 'HTTP request to Formbar failed', details: err?.message || String(err) });
    }
});

app.post('/savePin', (req, res) => {
    const { pin } = req.body || {};

    if (!pin) {
        return res.status(400).json({ ok: false, error: 'PIN is required' });
    }

    if (!req.session.token || !req.session.token.id) {
        return res.status(401).json({ ok: false, error: 'Not authenticated' });
    }

    console.log('Saving PIN for user', req.session.token.id);
    db.run("UPDATE users SET pin = ? WHERE id = ?", [pin, req.session.token.id], function (err) {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).json({ ok: false, error: 'Database error' });
        } else {
            console.log('PIN saved for user', req.session.token.id);
            res.json({ ok: true });
        }
    });
});

app.post('/getPin', (req, res) => {
    if (!req.session.token || !req.session.token.id) {
        return res.status(401).json({ ok: false, error: 'Not authenticated' });
    }

    db.get("SELECT pin FROM users WHERE id = ?", [req.session.token.id], (err, row) => {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).json({ ok: false, error: 'Database error' });
        }
        if (!row) {
            return res.status(404).json({ ok: false, error: 'User not found' });
        }
        res.json({ ok: true, userPin: row.pin || '' });
    });
});

app.get('/paymentStatus', (req, res) => {
    res.json({ ok: true, hasPaid: !!req.session.hasPaid });
});

app.listen(port, () => {
    console.log(`Server with Socket.IO listening at http://localhost:${port}`);
});
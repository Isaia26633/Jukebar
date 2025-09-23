const port = 3000;
const express = require('express');
const app = express();
const jwt = require('jsonwebtoken');
const session = require('express-session')
const dotenv = require('dotenv');
const sqlite3 = require("sqlite3").verbose();
dotenv.config();
app.set('view engine', 'ejs');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

const FORMBAR_ADDRESS = process.env.FORMBAR_ADDRESS || 'http://localhost:420';
const PUBLIC_KEY = process.env.PUBLIC_KEY || '';

const AUTH_URL = 'http://localhost:420/oauth';
const THIS_URL = 'http://localhost:3000/login';

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
        const tokenData = req.session.token;

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
        }
    } else {
        res.redirect('/login');
    }
}

app.get('/', isAuthenticated, (req, res) => {
    try {
        res.render('index.ejs', { user: req.session.user })
    }
    catch (error) {
        res.send(error.message)
    }
});

app.get('/login', (req, res) => {
    if (req.query.token) {
        let tokenData = jwt.decode(req.query.token);
        req.session.token = tokenData;
        req.session.user = tokenData.displayName;
        req.session.permission = tokenData.permission;
        console.log('User ID:', tokenData.id);
        db.run("INSERT INTO users (id, displayName) VALUES (?, ?)", [tokenData.id, tokenData.displayName], (err) => {
            // if the table doesnt exist, create it
            if (err && err.message.includes('no such table')) {
                db.run("CREATE TABLE users (id INTEGER PRIMARY KEY, displayName TEXT)", (err) => {
                    if (err) {
                        console.error('Error creating users table:', err.message);
                    } else {
                        console.log('Users table created');
                        // try inserting again
                        db.run("INSERT INTO users (id, displayName) VALUES (?, ?)", [tokenData.id, tokenData.displayName], (err) => {
                            if (err) {
                                if (err.message.includes('UNIQUE constraint failed')) {
                                    console.log('User already exists in database');
                                } else {
                                    console.error('Database error:', err.message);
                                }
                            } else {
                                console.log('New user added to database');
                            }
                        });
                        const redirectTo = req.query.redirectURL || '/spotify';
                        res.redirect(redirectTo);
                    }
                });
            } else if (err && err.message.includes('UNIQUE constraint failed')) {
                console.log('User already exists in database');
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
    }
});
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect(`${AUTH_URL}?redirectURL=${THIS_URL}`);
});

app.post('/claim-payment', (req, res) => {
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


/*
 
Digipogs requests
 
*/


    app.post('/transfer', async (req, res) => {
        try {
            const to = 1;
            const amount = 10;
            
            // Wrap db.get in a Promise
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
            }        const payload = {
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

app.listen(port, () => {
    console.log(`app listening at http://localhost:${port}`);
});
const port = 3000;
const express = require('express');
const app = express();
const jwt = require('jsonwebtoken');
const session = require('express-session')
const dotenv = require('dotenv');
dotenv.config();
app.set('view engine', 'ejs');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));


const AUTH_URL = 'http://localhost:420/oauth';
const THIS_URL = 'http://localhost:3000/login';

const FORMBAR_ADDRESS = process.env.FORMBAR_ADDRESS || 'http://localhost:420';
const PUBLIC_KEY = process.env.PUBLIC_KEY || '';


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

app.get('/', (req, res) => {
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
        req.session.user = tokenData.username;
        const redirectTo = req.query.redirectURL;
        res.redirect(redirectTo);
    } else {
        res.redirect(`${AUTH_URL}?redirectURL=${THIS_URL}`);
    };
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

        // this is so the user has to pay again
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

app.get('/spotify', (req, res) => {
    try {
        res.render('player.ejs', { 
            user: req.session.user, 
            permission: req.session.permission,
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
        const { from, to, amount, pin, reason } = req.body || {};
        if (!from || !to || !amount || pin == null) {
          res.status(400).json({ ok: false, error: 'Missing required fields' });
          return;
        }

        const payload = {
            from: Number(from),
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

        console.log(decoded)
        const success = decoded && decoded.ok !== false && !decoded.error;

        if (success) {
            req.session.hasPaid = true;
            req.session.payment = {
                from: Number(from),
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
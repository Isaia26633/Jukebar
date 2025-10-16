const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../utils/database');

const FORMBAR_ADDRESS = process.env.FORMBAR_ADDRESS;
const API_KEY = process.env.API_KEY || '';
const port = process.env.PORT || 5000;
const AUTH_URL = `${FORMBAR_ADDRESS}/oauth`;
const THIS_URL = `http://localhost:${port}/login`;

router.get('/login', (req, res) => {
    if (req.query.token) {
        const tokenData = jwt.decode(req.query.token);
        req.session.token = tokenData;
        req.session.user = tokenData.displayName;
        req.session.permission = tokenData.permission;
        console.log(tokenData);
        
        db.run("INSERT INTO users (id, displayName, pin) VALUES (?, ?, ?)", [tokenData.id, tokenData.displayName, null], (err) => {
            // if the table doesnt exist, create it
            if (err && err.message.includes('no such table')) {
                db.run("CREATE TABLE users (id INTEGER PRIMARY KEY, displayName TEXT, pin INTERGER)", (err) => {
                    if (err) {
                        console.error('Error creating users table:', err.message);
                    } else {
                        // try inserting again
                        db.run("INSERT INTO users (id, displayName, pin) VALUES (?, ?, ?)", [tokenData.id, tokenData.displayName, null], (err) => {
                            if (err) {
                                if (err.message.includes('UNIQUE constraint failed')) {
                                    // User already exists
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

router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect(`${AUTH_URL}?redirectURL=${THIS_URL}`);
});

router.get('/checkPerms', (req, res) => {
    const reqOptions = {
        method: 'GET',
        headers: {
            'API': API_KEY,
            'Content-Type': 'application/json'
        }
    };

    fetch(`${FORMBAR_ADDRESS}/api/me`, reqOptions)
        .then((response) => {
            if (!response.ok) {
                console.log('Server returned non-OK response:', response);
            }
            return response.json();
        })
        .then((data) => {
            console.log(data);
            res.json({ ok: true, data: data });
        })
        .catch((err) => {
            console.log('connection closed due to errors', err);
            res.status(500).json({ ok: false, error: err.message });
        });
});

module.exports = router;

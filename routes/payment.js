const express = require('express');
const router = express.Router();
const db = require('../utils/database');

const FORMBAR_ADDRESS = process.env.FORMBAR_ADDRESS;

router.post('/transfer', async (req, res) => {
    try {
        const to = process.env.RECIPIENT_ID;
        let amount = process.env.TRANSFER_AMOUNT || 50;

        //gets the top 3 users to apply a discount
        const topUsers = await new Promise((resolve, reject) => {
            db.all("SELECT id FROM users ORDER BY songsPlayed DESC LIMIT 3", (err, rows) => {
                if (err) return reject(err);
                resolve(rows.map(r => r.id));
            });
        });

        const userRow = await new Promise((resolve, reject) => {
            db.get("SELECT id FROM users WHERE id = ?", [req.session.token?.id], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });

        if (userRow && userRow.id) {
            if (topUsers[0] === userRow.id) {
                amount = Math.max(0, amount - 10);
            } else if (topUsers[1] === userRow.id) {
                amount = Math.max(0, amount - 5);
            } else if (topUsers[2] === userRow.id) {
                amount = Math.max(0, amount - 3);
            }
        }
        //no discount for users who haven't played any songs
        const songsPlayed = userRow.songsPlayed;
        if (songsPlayed == 0) {
            amount = 50;
        }

        const { pin, reason } = req.body || {};

        console.log('Received PIN:', pin, 'Type:', typeof pin);
        console.log('User session ID:', req.session.token?.id);
        console.log('User row from DB:', userRow);

        if (!userRow || !userRow.id || !to || !amount || pin == null) {
            res.status(400).json({ ok: false, error: 'Missing required fields or user not found' });
            return;
        }
        const payload = {
            from: Number(userRow.id),
            to: Number(to),
            amount: Number(amount),
            pin: Number(pin),
            reason: String(reason),
        };

        console.log('Transfer payload being sent to Formbar:', payload);
        const transferResult = await fetch(`${FORMBAR_ADDRESS}/api/digipogs/transfer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        const responseJson = await transferResult.json();
        console.log('Formbar response status:', transferResult.status);
        console.log('Formbar response JSON:', JSON.stringify(responseJson, null, 2));

        // Check if the transfer was successful based on the response
        if (transferResult.ok && responseJson) {
            req.session.hasPaid = true;
            req.session.payment = {
                from: Number(userRow.id),
                to: Number(to),
                amount: Number(amount),
                at: Date.now()
            };
            return req.session.save(() => {
                res.json({ ok: true, message: 'Transfer successful', response: responseJson });
            });
        } else {
            console.log('Transfer failed with status:', transferResult.status);
            console.log('Full Formbar error response:', JSON.stringify(responseJson, null, 2));

            // Extract the specific error message from Formbar response
            let specificError = 'Transfer failed';

            // Check if there's a JWT token that needs to be decoded
            if (responseJson && responseJson.token) {
                try {
                    // Decode the JWT token to get the actual error message
                    const jwt = require('jsonwebtoken');
                    const decoded = jwt.decode(responseJson.token);
                    console.log('Decoded JWT:', decoded);

                    if (decoded && decoded.message) {
                        specificError = decoded.message;
                    }
                } catch (err) {
                    console.error('Failed to decode JWT token:', err);
                }
            }

            // Try other possible error message locations if no JWT
            if (specificError === 'Transfer failed' && responseJson) {
                if (responseJson.message) {
                    specificError = responseJson.message;
                } else if (responseJson.error) {
                    specificError = responseJson.error;
                } else if (responseJson.details && responseJson.details.message) {
                    specificError = responseJson.details.message;
                } else if (responseJson.data && responseJson.data.message) {
                    specificError = responseJson.data.message;
                }
            }

            console.log('Extracted error message:', specificError);

            res.status(transferResult.status || 400).json({
                ok: false,
                error: specificError,
                details: responseJson
            });
        }
    } catch (err) {
        res.status(502).json({ ok: false, error: 'HTTP request to Formbar failed', details: err?.message || String(err) });
    }
});

router.post('/refund', async (req, res) => {
    try {
        const from = process.env.RECIPIENT_ID;
        const amount = process.env.TRANSFER_AMOUNT || 50;
        const reason = "Jukebar refund"
        const pin = process.env.PIN
        const userRow = await new Promise((resolve, reject) => {
            db.get("SELECT id FROM users WHERE id = ?", [req.session.token?.id], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });

        if (!userRow || !userRow.id || !from || !amount || pin == null) {
            res.status(400).json({ ok: false, error: 'Missing required fields or user not found' });
            return;
        }
        const payload = {
            from: Number(from),
            to: Number(userRow.id),
            amount: Number(amount),
            pin: Number(pin),
            reason: String(reason),
        };

        console.log('Refund payload being sent to Formbar:', payload);
        const transferResult = await fetch(`${FORMBAR_ADDRESS}/api/digipogs/transfer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        const responseJson = await transferResult.json();
        console.log('Formbar response status:', transferResult.status);
        console.log('Formbar response JSON:', JSON.stringify(responseJson, null, 2));

        // Check if the transfer was successful based on the response
        if (transferResult.ok && responseJson) {
            req.session.payment = {
                from: Number(from),
                to: Number(userRow.id),
                amount: Number(amount),
                at: Date.now()
            };
            return req.session.save(() => {
                res.json({ ok: true, message: 'Refund successful', response: responseJson });
            });
        } else {
            console.log('Refund failed with status:', transferResult.status);
            console.log('Full Formbar error response:', JSON.stringify(responseJson, null, 2));

            // Extract the specific error message from Formbar response
            let specificError = 'Refund failed';

            // Try other possible error message locations if no JWT
            if (specificError === 'Refund failed' && responseJson) {
                if (responseJson.message) {
                    specificError = responseJson.message;
                } else if (responseJson.error) {
                    specificError = responseJson.error;
                } else if (responseJson.details && responseJson.details.message) {
                    specificError = responseJson.details.message;
                } else if (responseJson.data && responseJson.data.message) {
                    specificError = responseJson.data.message;
                }
            }

            console.log('Extracted error message:', specificError);

            res.status(transferResult.status || 400).json({
                ok: false,
                error: specificError,
                details: responseJson
            });
        }
    } catch (err) {
        console.error('Refund error:', err);
        res.status(502).json({ ok: false, error: 'HTTP request to Formbar failed', details: err?.message || String(err) });
    }
});

router.post('/savePin', (req, res) => {
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

router.post('/getPin', (req, res) => {
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

router.post('/claimPayment', (req, res) => {
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

router.get('/paymentStatus', (req, res) => {
    res.json({ ok: true, hasPaid: !!req.session.hasPaid });
});

router.post('/getAmount', async (req, res) => {
    try {
        const db = require('../utils/database');
        const userId = req.session.token?.id;
        let amount = Number(process.env.TRANSFER_AMOUNT) || 50;

        // Get top 3 user IDs in order
        const topUsers = await new Promise((resolve, reject) => {
            db.all("SELECT id FROM users ORDER BY songsPlayed DESC LIMIT 3", (err, rows) => {
                if (err) return reject(err);
                resolve(rows.map(r => r.id));
            });
        });

        // discount
        if (userId) {
            if (topUsers[0] === userId) {
                amount = Math.max(0, amount - 10); //10 pogs off
            } else if (topUsers[1] === userId) { 
                amount = Math.max(0, amount - 5);  //5 pogs off
            } else if (topUsers[2] === userId) {
                amount = Math.max(0, amount - 3);  //3 pogs off
            }
        }

        res.json({ ok: true, amount });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

module.exports = router;

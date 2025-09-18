const port = 3000;
const express = require('express');
const app = express();
const jwt = require('jsonwebtoken');
const session = require('express-session')
app.set('view engine', 'ejs');

const AUTH_URL = 'http://localhost:420/oauth';
const THIS_URL = 'http://localhost:3000/login';



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
            res.redirect(`${AUTH_URL}?refreshToken=${tokenData.refreshToken}&redirectURL=${THIS_URL}`);
        }
    } else {
        res.redirect(`/login?redirectURL=${THIS_URL}`);
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
          req.session.user = tokenData.username;
          res.redirect('/');
     } else {
          res.redirect(`${AUTH_URL}?redirectURL=${THIS_URL}`);
     };
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect(`${AUTH_URL}?redirectURL=${THIS_URL}`);
});

/* 

SPOTIFY ROUTES

*/

app.get('/spotify', isAuthenticated, (req, res) => {
    try {
        res.render('player.ejs', { user: req.session.user, permission: req.session.permission })
    } catch (error) {
        res.send(error.message)
    }
});

app.listen(port, () => {
    console.log(`app listening at http://localhost:${port}`);
});
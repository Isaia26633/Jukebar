const express = require('express');
const session = require('express-session');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');
const { io: ioClient } = require('socket.io-client');

// Load environment variables
dotenv.config();

// Initialize Express
const app = express();
const port = process.env.PORT || 5000;

// Create HTTP server and Socket.IO
const server = http.createServer(app);
const io = new Server(server);

// Middleware
app.set('view engine', 'ejs');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Session configuration
app.use(session({
    secret: 'thisisasupersecretsigmaskibidikeyandihavethekeytotheuniversebutnobodywillknowabcdefghijklmnopqrstuvwxyz',
    resave: false,
    saveUninitialized: false
}));

// Import middleware
const { isAuthenticated } = require('./middleware/auth');

// Import routes
const authRoutes = require('./routes/auth');
const spotifyRoutes = require('./routes/spotify');
const paymentRoutes = require('./routes/payment');

// Formbar Socket.IO connection
const FORMBAR_ADDRESS = process.env.FORMBAR_ADDRESS;
const API_KEY = process.env.API_KEY || '';

const formbarSocket = ioClient(FORMBAR_ADDRESS, {
    extraHeaders: { api: API_KEY }
});

// Main routes
app.get('/', isAuthenticated, (req, res) => {
    try {
        res.render('player.ejs', {
            user: req.session.user,
            userID: req.session.token?.id,
            hasPaid: !!req.session.hasPaid,
            payment: req.session.payment || null
        });
    } catch (error) {
        res.send(error.message);
    }
});

app.get('/spotify', isAuthenticated, (req, res) => {
    try {
        res.render('player.ejs', {
            user: req.session.user,
            userID: req.session.token?.id,
            hasPaid: !!req.session.hasPaid,
            payment: req.session.payment || null
        });
    } catch (error) {
        res.send(error.message);
    }
});

// Use route modules
app.use('/', authRoutes);
app.use('/', spotifyRoutes);
app.use('/', paymentRoutes);

// Start server
server.listen(port, () => {
    console.log(`Server with Socket.IO listening at http://localhost:${port}`);
});

module.exports = { app, io, formbarSocket };

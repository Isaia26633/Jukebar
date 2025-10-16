const SpotifyWebApi = require('spotify-web-api-node');
require('dotenv').config();

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
    try {
        const data = await spotifyApi.refreshAccessToken();
        spotifyApi.setAccessToken(data.body.access_token);
    } catch (err) {
        console.error('Failed to refresh Spotify token:', err.message);
        throw err;
    }
}

module.exports = {
    spotifyApi,
    ensureSpotifyAccessToken
};

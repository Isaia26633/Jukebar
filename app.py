from flask import Flask, session, redirect, request, jsonify, render_template
from functools import wraps
from flask_session import Session
import requests
import jwt
import time
import urllib.parse

app = Flask(__name__)
app.config['SECRET_KEY'] = 'OZflqMrpgk868so4frwQUMTHNZq5CVMR'
app.config["SESSION_TYPE"] = "filesystem"
Session(app)

formbar_token_global = None

AUTH_URL = "http://localhost:420/oauth"
THIS_URL = "http://localhost:3000/login"

def is_authenticated(f):
    def wrapper(*args, **kwargs):
        user = session.get('user')
        token_data = session.get('token')
        if user:
            if token_data:
                current_time = int(time.time())
                if token_data.get('exp', 0) < current_time:
                    # Token expired
                    refresh_token = token_data.get('refreshToken')
                    if refresh_token:
                        # Prevent infinite loop by checking a flag
                        if session.get('redirected_for_refresh'):
                            session.pop('redirected_for_refresh', None)
                            return redirect(f"/login?redirectURL={request.url}")
                        session['redirected_for_refresh'] = True
                        return redirect(f"{AUTH_URL}?refreshToken={refresh_token}&redirectURL={request.url}")
                    else:
                        return redirect(f"/login?redirectURL={request.url}")
            return f(*args, **kwargs)
        else:
            return redirect(f"/login?redirectURL={request.url}")
    wrapper.__name__ = f.__name__
    return wrapper

@app.route('/')
# @is_authenticated
def index():
    try:
        print("connected")
        return render_template('index.html')
    except Exception as e:
        print("it not working")
        return str(e)

@app.route('/login')
def login():
    global formbar_token_global
    token = request.args.get('token')
    print(f"[login] Token received: {token}")
    if token:
        try:
            token_data = jwt.decode(token, options={"verify_signature": False})
            print(f"[login] Decoded token data: {token_data}")
            session['token'] = token_data
            session['user'] = token_data.get('username')
            print(f"[login] Session data after login: {session}")
            formbar_token_global = token_data
            return redirect('/spotify')
        except Exception as e:
            print(f"[login] Error decoding token: {e}")
            return str(e)
    else:
        print(f"[login] Redirecting to AUTH_URL: {AUTH_URL}")
        print(f"[login] Redirect URL: {THIS_URL}")
        return redirect(f"{AUTH_URL}?redirectURL={THIS_URL}")

@app.route('/logout')
def logout():
    session.clear()
    return redirect('/')

'''


SPOTIFY STUFF


'''

CLIENT_ID = "653ea7d8658b4a268b87c85a28fca38c"
CLIENT_SECRET = "e51042c1ab7a459bb93f91832ea14ce2"
REDIRECT_URI = "http://127.0.0.1:3000/spotify"
SCOPES = "user-read-playback-state user-modify-playback-state user-read-currently-playing"

@app.route('/spotify')
def spotify():
    code = request.args.get('code')
    print(f"[spotify] code: {code}")
    if not code:
        auth_url = "https://accounts.spotify.com/authorize?" + urllib.parse.urlencode({
            "client_id": CLIENT_ID,
            "response_type": "code",
            "redirect_uri": REDIRECT_URI,
            "scope": SCOPES
        })
        print(f"[spotify] Redirecting to Spotify auth URL: {auth_url}")
        return redirect(auth_url)
    else:
        token_url = "https://accounts.spotify.com/api/token"
        payload = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": REDIRECT_URI,
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET
        }
        headers = {"Content-Type": "application/x-www-form-urlencoded"}
        print(f"[spotify] Requesting token from Spotify with payload: {payload}")
        response = requests.post(token_url, data=payload, headers=headers)
        print(f"[spotify] Spotify token response status: {response.status_code}, body: {response.text}")

        if response.status_code == 200:
            token_data = response.json()
            print(f"[spotify] Received token data: {token_data}")
            session['spotify_token'] = token_data.get('access_token')
            session['spotify_refresh_token'] = token_data.get('refresh_token')
            print(f"[spotify] Session after storing Spotify tokens: {dict(session)}")
            return redirect('/spotifyPlayer')
        else:
            print(f"[spotify] Failed to fetch token: {response.status_code} - {response.text}")
            return f"Failed to fetch token: {response.status_code} - {response.text}", 400

@app.route('/spotifyPlayer')
def spotifyPlayer():
    global formbar_token_global
    spotify_token = session.get("spotify_token")
    formbar_token = formbar_token_global
    print(f"[spotifyPlayer] spotify_token: {spotify_token}")
    print(f"[spotifyPlayer] formbar_token: {formbar_token}")
    print(f"[spotifyPlayer] Full session: {dict(session)}")
    return render_template("spotifyPlayer.html", spotify_token=spotify_token, formbar_token=formbar_token)

if __name__ == '__main__':
    app.run(port=3000, debug=True, host='0.0.0.0')
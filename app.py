from flask import Flask, session, redirect, request, jsonify, render_template
from functools import wraps
from flask_session import Session
import requests
import jwt
import time

app = Flask(__name__)
app.config['SECRET_KEY'] = 'OZflqMrpgk868so4frwQUMTHNZq5CVMR'
app.config["SESSION_TYPE"] = "filesystem"
Session(app)


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
    token = request.args.get('token')
    print(f"Token received: {token}")
    if token:
        try:
            token_data = jwt.decode(token, options={"verify_signature": False})
            print(f"Decoded token data: {token_data}")
            session['token'] = token_data
            session['user'] = token_data.get('username')
            print(f"Session data after login: {session}")
            return redirect('/welcome')
        except Exception as e:
            print(f"Error decoding token: {e}")
            return str(e)
    else:
        print(f"Redirecting to AUTH_URL: {AUTH_URL}")
        print(f"Redirect URL: {THIS_URL}")
        return redirect(f"{AUTH_URL}?redirectURL={THIS_URL}")

@app.route('/welcome')
def welcome():
    # along with the pages render it passes all the token data into the page
    return render_template('homepage.html', token=session.get('token'))


@app.route('/logout')
def logout():
    session.clear()
    return redirect('/')

if __name__ == '__main__':
    app.run(port=3000, debug=True, host='0.0.0.0')
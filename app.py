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


AUTH_URL = "https://formbeta.yorktechapps.com/oauth"
THIS_URL = "http://localhost:3000/login"
API_KEY = "b3d66e63229caced4fd2f2933d023d69bfa983f57cf0119b84d0da35462ad0f3ce1b4ec1ee0acd403c7898a964142703f9857095ed52df8583835ce09856d4c1"

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
@is_authenticated
def index():
    try:
        return render_template('index.html', user=session.get('user'))
    except Exception as e:
        return str(e)

@app.route('/login')
def login():
    token = request.args.get('token')
    if token:
        token_data = jwt.decode(token, options={"verify_signature": False})
        session['token'] = token_data
        session['user'] = token_data.get('username')
        return redirect('/')
    else:
        print(f"Redirecting to AUTH_URL: {AUTH_URL}")
        print(f"Redirect URL: {THIS_URL}")
        return redirect(f"{AUTH_URL}?redirectURL={THIS_URL}")
    
# debuging

# @app.route('/test-login')
# def test_login():
#     fake_token = {
#         "username": "Isaiah",
#         "exp": int(time.time()) + 3600,
#         "refreshToken": "fake_refresh_token"
#     }
#     session['token'] = fake_token
#     session['user'] = fake_token['username']
#     return redirect('/')
# clear session

@app.route('/logout')
def logout():
    session.clear()
    return redirect('/')
if __name__ == '__main__':
    app.run(port=3000, debug=True, host='0.0.0.0')
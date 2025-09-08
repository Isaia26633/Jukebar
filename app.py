from flask import Flask, render_template, request, redirect, url_for, session
import requests
from functools import wraps

app = Flask(__name__)
app.secret_key = 'OZflqMrpgk868so4frwQUMTHNZq5CVMR'

FBJS_URL = 'https://formbeta.yorktechapps.com/api'
FBJS_LOGIN = 'https://formbeta.yorktechapps.com/login'
REDIRECT_URI = 'http://localhost:5000/callback'

# checks if the user is logged in with fbjs
def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user' not in session:
            return redirect(url_for('login', redirectURL='/'))
        return f(*args, **kwargs)
    return decorated

# routes
@app.route('/')
def index():
    return render_template('index.html')

# logs in with formbar
def login():
    token = request.args.get('token')
    if token:
        token_data = jwt.decode(token, options={"verify_signature": False})
        session['token'] = token_data
        session['user'] = token_data['username']
        return redirect(url_for('index'))
    else:
        redirectURL = request.args.get('redirectURL', '/')
        return redirect(f"{FBJS_URL}/oauth?redirectURL={redirectURL}")


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0')
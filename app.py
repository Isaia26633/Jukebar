from flask import Flask
import requests

app = Flask(__name__)

@app.route('/')
def index():
    return 'SKONG!'



FBJS_URL = 'https://formbeta.yorktechapps.com/apikey'
API_KEY = 'b3d66e63229caced4fd2f2933d023d69bfa983f57cf0119b84d0da35462ad0f3ce1b4ec1ee0acd403c7898a964142703f9857095ed52df8583835ce09856d4c1'

headers = {
    'API': API_KEY,
    'Content-Type': 'application/json'
}

try:
    response = requests.get(f'{FBJS_URL}', headers=headers)
    response.raise_for_status()
    if response.text:
        data = response.json()
        print(data)
    else:
        print("Empty response from server")
except requests.exceptions.HTTPError as errh:
    print("HTTP error:", errh)
except requests.exceptions.RequestException as err:
    print("Request failed:", err)
except ValueError as errv:
    print("Failed to parse JSON:", errv)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0')
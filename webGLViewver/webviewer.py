from flask import Flask, render_template, request, jsonify, send_from_directory, abort
import requests
import logging
import os
import argparse
import threading

app = Flask(__name__)

API_URL = "http://localhost:8080"
parser = argparse.ArgumentParser()
parser.add_argument("api_url", nargs="?", default="http://localhost:8080", help="URL of the API backend")
parser.add_argument("--port", type=int, default=5000, help="Port to run the Flask app on")
parser.add_argument("--host", type=str, default="0.0.0.0", help="Host to run the Flask app on")
parser.add_argument("--debug", action="store_true", help="Run Flask app in debug mode")
args, unknown = parser.parse_known_args()
API_URL = args.api_url
portConf = args.port
hostConf = args.host
debugConf = args.debug

@app.route("/")
def index():
    return render_template("app.html")

@app.route("/includes/<path:namefile>")
def includes_files(namefile):
    ALLOWED_INCLUDE_FILES = [
        "scripts.js",
        "importmap.json",
        "styles.css",
        "ico.png"
    ]
    includes_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "includes")
    if namefile in ALLOWED_INCLUDE_FILES:
        return send_from_directory(includes_dir, namefile)
    else:
        abort(404)

@app.route("/api/particles", methods=["GET", "POST"])
def api_particles():
    if request.method == "POST":
        data = request.json
        requests.post(f"{API_URL}/particles", json=data)
        return "", 204
    else:
        r = requests.get(f"{API_URL}/particles")
        return jsonify(r.json())

@app.route("/api/settings", methods=["GET", "POST"])
def api_settings():
    if request.method == "POST":
        data = request.json
        requests.post(f"{API_URL}/settings", json=data)
        return "", 204
    else:
        r = requests.get(f"{API_URL}/settings")
        return jsonify(r.json())

@app.route("/api/pause", methods=["POST"])
def api_pause():
    requests.post(f"{API_URL}/pause")
    return "", 204

@app.route("/api/stop", methods=["POST"])
def api_stop():
    # On envoie un requete POST pour arrêter le serveur de simulation
    requests.post(f"{API_URL}/stop")
    # We wait for the request to be processed
    # On ferme l'application Flask apres reception de la requete
    # Note: os._exit(0) is used to forcefully terminate the Flask app
    # without waiting for any ongoing requests to complete.
    threading.Timer(1.0, lambda: os._exit(0)).start()
    return "", 204

@app.route("/api/resume", methods=["POST"])
def api_resume():
    requests.post(f"{API_URL}/resume")
    return "", 204

@app.route("/api/rewind", methods=["POST"])
def api_rewind():
    try:
        data = request.json
        r = requests.post(f"{API_URL}/rewind", json=data)
        return (r.text, r.status_code, r.headers.items())
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    class No200Filter(logging.Filter):
        def filter(self, record):
            # Werkzeug logs look like: "127.0.0.1 - - [date] "GET / HTTP/1.1" 200 -"
            # Only filter out if status code is 200 or 204
            msg = record.getMessage()
            if '"' in msg:
                try:
                    status_code = int(msg.split('"')[2].strip().split()[0])
                    return status_code != 200 and status_code != 204
                except Exception:
                    return True
            return True

    log = logging.getLogger('werkzeug')
    log.addFilter(No200Filter())

    app.run(port=portConf, host=hostConf, debug=debugConf)

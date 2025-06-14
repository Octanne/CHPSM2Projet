from flask import Flask, render_template_string, request, jsonify
import requests
import logging
import os
import argparse
import threading

app = Flask(__name__)

API_URL = "http://localhost:8080"
parser = argparse.ArgumentParser()
parser.add_argument("api_url", nargs="?", default="http://localhost:8080", help="URL of the API backend")
args, unknown = parser.parse_known_args()
API_URL = args.api_url

HTML = """
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Visualisation N-Body 3D</title>
    <style>
        body { margin:0; overflow:hidden; background:#23272f; color:#f3f3f3; font-family: 'Segoe UI', Arial, sans-serif; }
        #overlay, #overlay2, #overlay3 {
            background:rgba(34,40,49,0.97);
            padding:22px 28px 18px 28px; border-radius:12px; box-shadow:0 4px 24px #0008;
            min-width: 320px;
            z-index: 1000;
        }
        #overlays-container {
            position: fixed;
            top: 20px;
            left: 20px;
            display: flex;
            flex-direction: column;
            gap: 20px;
            z-index: 1000;
        }
        #overlay, #overlay2, #overlay3 {
            position: static;
            margin: 0;
        }
        h2 { 
            margin:0 0 12px 0; 
            font-size:1.2em; 
            letter-spacing:1px; 
            color:#ffd369; 
            text-align: center;
        }
        .form-row { display:flex; align-items:center; margin-bottom:12px; }
        .form-row label { flex:1; font-weight:500; }
        .form-row .current-value {
            background:#393e46; color:#ffd369; border:none; border-radius:4px;
            padding:4px 8px; margin-right:10px; min-width:60px; text-align:right;
        }
        .form-row input[type=number] {
            width:90px; padding:4px 8px; border-radius:4px; border:1px solid #393e46;
            background:#23272f; color:#f3f3f3; transition:border 0.2s;
        }
        .form-row input[type=number]:focus { border:1.5px solid #ffd369; outline:none; }
        .form-row input[readonly] { background:#393e46; color:#888; border:none; }
        .form-row .readonly-label { color:#888; }
        .form-actions {
            display: flex;
            gap: 10px;
            margin-top: 8px;
            justify-content: center;
        }
        button {
            background:#ffd369; color:#23272f; border:none; border-radius:4px;
            padding:7px 18px; font-weight:600; font-size:1em; cursor:pointer;
            margin-right:0; transition:background 0.2s;
            display: inline-flex; align-items: center; gap: 8px;
        }
        button:hover { background:#ffb800; }
        #pausedState { margin-left:10px; color:#ffd369; font-weight:600; }
        #scene { display:block; position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:-1; }
        .icon {
            width: 18px;
            height: 18px;
            display: inline-block;
            vertical-align: middle;
        }
        #pauseBtn {
            min-width: 150px;
            justify-content: center;
        }
        #updateBtn {
            min-width: 170px;
            justify-content: center;
        }
        #downloadParticlesBtn, #uploadParticlesBtn {
            cursor: pointer;
            justify-content: center;
        }
        #pauseBtnText {
            display: inline-block;
            min-width: 70px;
            text-align: center;
        }
        #closeBtn {
            position: fixed;
            top: 18px;
            right: 24px;
            background: #e74c3c;
            color: #fff;
            border: none;
            border-radius: 4px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            z-index: 1001;
            box-shadow: 0 2px 8px #0005;
            transition: background 0.2s;
            padding: 7px 18px;
            font-weight: 600;
            font-size: 1em;
            gap: 8px;
        }
        #closeBtn:hover {
            background: #c0392b;
        }
        #closeBtn .icon {
            width: 20px;
            height: 20px;
            display: inline-block;
        }
        #closeBtnText {
            font-size: 1em;
            color: #fff;
            font-weight: 600;
            display: inline-block;
        }
        .particles-actions-row {
            display: flex;
            align-items: center;
            gap: 12px;
            justify-content: center;
            width: 100%;
        }
        #uploadParticlesStatus {
            width: 100%;
            text-align: center;
            margin: 4px;
            color: #ffd369;
        }
        #overlay2 {
            padding-bottom: 0;
        }
    </style>
    <script type="importmap">
        {
            "imports": {
                "three": "https://cdn.jsdelivr.net/npm/three@0.177.0/build/three.module.js"
            }
        }
    </script>
</head>
<body>
<button id="closeBtn" title="Fermer l'application">
    <span id="closeBtnText">Fermer</span>
</button>
<div id="overlays-container">
    <div id="overlay">
        <h2>Paramètres Simulation</h2>
        <form id="settingsForm" autocomplete="off">        
            <div class="form-row">
                <label for="nb_particles" id="nb_particles_label">nbParticles</label>
                <span class="current-value" id="nb_particles_current"></span>
                <input type="number" name="nb_particles" id="nb_particles_input" placeholder="Modifier...">
            </div>
            <div class="form-row">
                <label for="current_time">currentTime</label>
                <span class="current-value" id="current_time_current"></span>
                <input type="number" step="0.1" name="current_time" id="current_time_input" placeholder="Modifier...">
            </div> 
            <div class="form-row">
                <label for="t_total">maxTime</label>
                <span class="current-value" id="t_total_current"></span>
                <input type="number" step="0.1" name="t_total" id="t_total_input" placeholder="Modifier...">
            </div>       
            <div class="form-row">
                <label for="dt">deltaTime</label>
                <span class="current-value" id="dt_current"></span>
                <input type="number" step="0.000001" name="dt" id="dt_input" placeholder="Modifier...">
            </div>
            <div class="form-actions">
                <button type="submit" id="updateBtn">
                    <span class="icon" id="updateIcon">
                        <svg viewBox="0 0 20 20" fill="#23272f" xmlns="http://www.w3.org/2000/svg" style="width:18px;height:18px;">
                            <path d="M10 2a8 8 0 1 1-7.446 5.032l1.857.742A6 6 0 1 0 10 4V2z"/>
                            <polygon points="2,2 6,2 6,6" fill="#23272f"/>
                        </svg>
                    </span>
                    Mettre à jour
                </button>
                <button type="button" id="pauseBtn">
                    <span id="pauseIcon" class="icon"></span>
                    <span id="pauseBtnText"></span>
                </button>
            </div>
        </form>
    </div>
    <div id="overlay3">
        <h2>Limites de la boîte de simulation</h2>
        <form id="boxForm" autocomplete="off">
            <div class="form-row">
                <label for="MIN_X">MIN_X</label>
                <span class="current-value" id="MIN_X_current"></span>
                <input type="number" step="0.1" name="MIN_X" id="MIN_X_input" placeholder="Modifier...">
            </div>
            <div class="form-row">
                <label for="MIN_Y">MIN_Y</label>
                <span class="current-value" id="MIN_Y_current"></span>
                <input type="number" step="0.1" name="MIN_Y" id="MIN_Y_input" placeholder="Modifier...">
            </div>
            <div class="form-row">
                <label for="MIN_Z">MIN_Z</label>
                <span class="current-value" id="MIN_Z_current"></span>
                <input type="number" step="0.1" name="MIN_Z" id="MIN_Z_input" placeholder="Modifier...">
            </div>
            <div class="form-row">
                <label for="MAX_X">MAX_X</label>
                <span class="current-value" id="MAX_X_current"></span>
                <input type="number" step="0.1" name="MAX_X" id="MAX_X_input" placeholder="Modifier...">
            </div>
            <div class="form-row">
                <label for="MAX_Y">MAX_Y</label>
                <span class="current-value" id="MAX_Y_current"></span>
                <input type="number" step="0.1" name="MAX_Y" id="MAX_Y_input" placeholder="Modifier...">
            </div>
            <div class="form-row">
                <label for="MAX_Z">MAX_Z</label>
                <span class="current-value" id="MAX_Z_current"></span>
                <input type="number" step="0.1" name="MAX_Z" id="MAX_Z_input" placeholder="Modifier...">
            </div>
            <div class="form-actions">
                <button type="submit" id="updateBoxBtn">
                    <span class="icon">
                        <svg viewBox="0 0 20 20" fill="#23272f" xmlns="http://www.w3.org/2000/svg" style="width:18px;height:18px;">
                            <path d="M10 2a8 8 0 1 1-7.446 5.032l1.857.742A6 6 0 1 0 10 4V2z"/>
                            <polygon points="2,2 6,2 6,6" fill="#23272f"/>
                        </svg>
                    </span>
                    Mettre à jour
                </button>
            </div>
        </form>
    </div>
    <div id="overlay2">
        <h2>Gestion Particles</h2>
        <div class="particles-actions-row">
            <button id="downloadParticlesBtn" type="button">
                <span class="icon">
                    <svg viewBox="0 0 20 20" fill="#23272f" xmlns="http://www.w3.org/2000/svg">
                        <path d="M10 2v10m0 0l-4-4m4 4l4-4" stroke="#23272f" stroke-width="2" fill="none"/>
                        <rect x="4" y="16" width="12" height="2" rx="1" fill="#23272f"/>
                    </svg>
                </span>
                Sauvegarder
            </button>
            <input type="file" id="uploadParticlesInput" accept=".json" style="display:none;">
            <button id="uploadParticlesBtn" type="button" id="sendBtn">
                <span class="icon">
                    <svg viewBox="0 0 20 20" fill="#23272f" xmlns="http://www.w3.org/2000/svg">
                        <path d="M10 18V8m0 0l-4 4m4-4l4 4" stroke="#23272f" stroke-width="2" fill="none"/>
                        <rect x="4" y="4" width="12" height="2" rx="1" fill="#23272f"/>
                    </svg>
                </span>
                Envoyer
            </button>
        </div>
        <div id="uploadParticlesStatus">&nbsp;</div>
        <script>
        document.getElementById('downloadParticlesBtn').onclick = function() {
            fetch('/api/particles').then(r => r.json()).then(data => {
                const blob = new Blob([JSON.stringify(data, null, 2)], {type: "application/json"});
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = "particles.json";
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }, 100);
            });
        };
        document.getElementById('uploadParticlesBtn').onclick = function() {
            document.getElementById('uploadParticlesInput').click();
        };
        document.getElementById('uploadParticlesInput').onchange = function(e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(evt) {
                try {
                    const json = JSON.parse(evt.target.result);
                    fetch('/api/particles', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify(json)
                    }).then(resp => {
                        if (resp.ok) {
                            document.getElementById('uploadParticlesStatus').textContent = "Import réussi";
                            fetchParticles();
                        } else {
                            document.getElementById('uploadParticlesStatus').textContent = "Erreur lors de l'import";
                        }
                        setTimeout(() => document.getElementById('uploadParticlesStatus').innerHTML = "&nbsp;", 3000);
                    });
                } catch (err) {
                    document.getElementById('uploadParticlesStatus').textContent = "Fichier invalide";
                    setTimeout(() => document.getElementById('uploadParticlesStatus').innerHTML = "&nbsp;", 3000);
                }
            };
            reader.readAsText(file);
            e.target.value = "";
        };
        </script>
    </div>
</div>
<canvas id="scene"></canvas>
<script type="module">
import * as THREE from 'three';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.177.0/examples/jsm/controls/OrbitControls.js';

let scene, camera, renderer, controls, particlesMesh = null, simBoxHelper = null, paused = false;
let particlesInterval = null, settingsInterval = null;
const readonlyFields = [];

function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
}

function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 1, 5000);
    camera.position.set(1500,1500,1500);

    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('scene'), antialias: true });
    resize();
    window.addEventListener('resize', resize);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 0, 0);
    controls.update();

    animate();
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

function updateParticles(particles) {
    if (particlesMesh) scene.remove(particlesMesh);
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particles.length * 3);
    particles.forEach((p, i) => {
        positions.set([p.x, p.y, p.z], i * 3);
    });
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ color: 0xffff00, size: 6 });
    particlesMesh = new THREE.Points(geometry, material);
    scene.add(particlesMesh);
}

function updateSimBox(box) {
    if (!box) return;
    if (simBoxHelper) {
        scene.remove(simBoxHelper);
    }
    const min = new THREE.Vector3(box.MIN_X, box.MIN_Y, box.MIN_Z);
    const max = new THREE.Vector3(box.MAX_X, box.MAX_Y, box.MAX_Z);
    const box3 = new THREE.Box3(min, max);
    simBoxHelper = new THREE.Box3Helper(box3, 0x00fffa);
    scene.add(simBoxHelper);

    const center = new THREE.Vector3();
    box3.getCenter(center);
    controls.target.copy(center);
    controls.update();
}

function fetchParticles() {
    fetch('/api/particles').then(r=>r.json()).then(data=>{
        updateParticles(data);
    });
}

function fetchSettings() {
    fetch('/api/settings').then(r=>r.json()).then(data=>{
        document.getElementById('dt_current').textContent = data.dt;
        document.getElementById('t_total_current').textContent = data.t_total;
        document.getElementById('nb_particles_current').textContent = data.nb_particles;
        document.getElementById('current_time_current').textContent = data.current_time;
        document.getElementById('dt_input').placeholder = data.dt;
        document.getElementById('t_total_input').placeholder = data.t_total;
        document.getElementById('nb_particles_input').placeholder = data.nb_particles;
        document.getElementById('current_time_input').placeholder = data.current_time;
        for (const key of ["dt", "t_total", "nb_particles", "current_time"]) {
            const input = document.getElementById(key + "_input");
            const label = document.getElementById(key + "_label");
            if (readonlyFields.includes(key)) {
                input.value = "";
                input.setAttribute("readonly", "readonly");
                input.style.background = "#393e46";
                input.style.color = "#888";
                if (label) label.classList.add("readonly-label");
            } else {
                input.removeAttribute("readonly");
                input.style.background = "";
                input.style.color = "";
                if (label) label.classList.remove("readonly-label");
            }
        }
        // Update box overlay fields
        for (const key of ["MIN_X", "MIN_Y", "MIN_Z", "MAX_X", "MAX_Y", "MAX_Z"]) {
            if (data[key] !== undefined) {
                document.getElementById(key + "_current").textContent = data[key];
                document.getElementById(key + "_input").placeholder = data[key];
            }
        }
        if (data.MIN_X !== undefined && data.MIN_Y !== undefined && data.MIN_Z !== undefined &&
            data.MAX_X !== undefined && data.MAX_Y !== undefined && data.MAX_Z !== undefined) {
            updateSimBox({
                MIN_X: data.MIN_X,
                MIN_Y: data.MIN_Y,
                MIN_Z: data.MIN_Z,
                MAX_X: data.MAX_X,
                MAX_Y: data.MAX_Y,
                MAX_Z: data.MAX_Z
            });
        }
        paused = data.paused;
        updatePauseButton(paused);

        if (paused) {
            if (particlesInterval) {
                clearInterval(particlesInterval);
                particlesInterval = null;
            }
            if (settingsInterval) {
                clearInterval(settingsInterval);
                settingsInterval = null;
            }
        } else {
            if (!particlesInterval) {
                particlesInterval = setInterval(fetchParticles, 200);
            }
            if (!settingsInterval) {
                settingsInterval = setInterval(fetchSettings, 1000);
            }
        }
    });
}

function updatePauseButton(paused) {
    const pauseBtnText = document.getElementById('pauseBtnText');
    const pauseIcon = document.getElementById('pauseIcon');
    if (paused) {
        pauseBtnText.textContent = "Reprendre";
        pauseIcon.innerHTML = `<svg viewBox="0 0 20 20" fill="#23272f" xmlns="http://www.w3.org/2000/svg"><polygon points="5,3 17,10 5,17"/></svg>`;
    } else {
        pauseBtnText.textContent = "Pause";
        pauseIcon.innerHTML = `<svg viewBox="0 0 20 20" fill="#23272f" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="3" width="4" height="14"/><rect x="12" y="3" width="4" height="14"/></svg>`;
    }
}

document.getElementById('settingsForm').onsubmit = function(e){
    e.preventDefault();
    const payload = {};
    if (!readonlyFields.includes("dt")) {
        const v = document.getElementById('dt_input').value;
        if (v !== "") payload.dt = parseFloat(v);
    }
    if (!readonlyFields.includes("t_total")) {
        const v = document.getElementById('t_total_input').value;
        if (v !== "") payload.t_total = parseFloat(v);
    }
    if (!readonlyFields.includes("current_time")) {
        const v = document.getElementById('current_time_input').value;
        if (v !== "") payload.current_time = parseFloat(v);
    }
    if (!readonlyFields.includes("nb_particles")) {
        const v = document.getElementById('nb_particles_input').value;
        if (v !== "") payload.nb_particles = parseInt(v);
    }
    if (Object.keys(payload).length === 0) return;
    fetch('/api/settings', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(payload)
    }).then(()=>{
        document.getElementById('dt_input').value = "";
        document.getElementById('t_total_input').value = "";
        document.getElementById('nb_particles_input').value = "";
        document.getElementById('current_time_input').value = "";
        fetchSettings();
    });
};

document.getElementById('boxForm').onsubmit = function(e){
    e.preventDefault();
    const payload = {};
    for (const key of ["MIN_X", "MIN_Y", "MIN_Z", "MAX_X", "MAX_Y", "MAX_Z"]) {
        const v = document.getElementById(key + "_input").value;
        if (v !== "") payload[key] = parseFloat(v);
    }
    if (Object.keys(payload).length === 0) return;
    fetch('/api/settings', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(payload)
    }).then(()=>{
        for (const key of ["MIN_X", "MIN_Y", "MIN_Z", "MAX_X", "MAX_Y", "MAX_Z"]) {
            document.getElementById(key + "_input").value = "";
        }
        fetchSettings();
    });
};

document.getElementById('pauseBtn').onclick = function(){
    fetch(paused ? '/api/resume' : '/api/pause', {method:'POST'}).then(()=>fetchSettings());
};
document.getElementById('closeBtn').onclick = function() {
    if (confirm("Voulez-vous vraiment fermer l'application ?")) {
        if (particlesInterval) clearInterval(particlesInterval);
        if (settingsInterval) clearInterval(settingsInterval);
        fetch('/api/stop', {method:'POST'}).then(()=>{
            document.body.innerHTML = "<h2 style='color:#fff;text-align:center;margin-top:20vh;'>Application arrêtée.</h2>";
        });
    }
};
init();
fetchSettings();
fetchParticles();
particlesInterval = setInterval(fetchParticles, 200);
settingsInterval = setInterval(fetchSettings, 1000);
</script>
</body>
</html>
"""

@app.route("/")
def index():
    return render_template_string(HTML)

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

    app.run(port=5000, debug=True)

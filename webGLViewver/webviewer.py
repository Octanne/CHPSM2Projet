from flask import Flask, render_template_string, request, jsonify
import requests

app = Flask(__name__)

API_URL = "http://localhost:8080"

HTML = """
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Visualisation N-Body 3D</title>
    <style>
        body { margin:0; overflow:hidden; background:#23272f; color:#f3f3f3; font-family: 'Segoe UI', Arial, sans-serif; }
        #overlay {
            position:fixed; top:20px; left:20px; background:rgba(34,40,49,0.97);
            padding:22px 28px 18px 28px; border-radius:12px; box-shadow:0 4px 24px #0008;
            min-width: 320px;
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
            min-width: 146px;
            justify-content: center;
        }
        #pauseBtnText {
            display: inline-block;
            min-width: 70px;
            text-align: center;
        }
        /* Nouveau style pour le bouton Fermer */
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
    </style>
</head>
<body>
<button id="closeBtn" title="Fermer l'application">
    <span class="icon">
        <svg viewBox="0 0 20 20" fill="#fff" xmlns="http://www.w3.org/2000/svg">
            <line x1="5" y1="5" x2="15" y2="15" stroke="#fff" stroke-width="2"/>
            <line x1="15" y1="5" x2="5" y2="15" stroke="#fff" stroke-width="2"/>
        </svg>
    </span>
    <span id="closeBtnText">Fermer</span>
</button>
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
            <input type="number" step="0.01" name="dt" id="dt_input" placeholder="Modifier...">
        </div>

        <div class="form-actions">
            <button type="submit">
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
<canvas id="scene"></canvas>
<script src="https://cdn.jsdelivr.net/npm/three@0.153.0/build/three.min.js"></script>
<script>
let scene, camera, renderer, particlesMesh = null;
let simBoxHelper = null;
let paused = false;

const readonlyFields = ["nb_particles"];

function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
}
function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 1, 5000);
    camera.position.set(1500,1500,1500);
    camera.lookAt(500,500,500);
    renderer = new THREE.WebGLRenderer({canvas:document.getElementById('scene'), antialias:true});
    resize();
    window.addEventListener('resize', resize);
    animate();
}
function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}
function updateParticles(particles) {
    if (particlesMesh) scene.remove(particlesMesh);
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    for (const p of particles) {
        positions.push(p.x, p.y, p.z);
    }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({color:0xffff00, size:6});
    particlesMesh = new THREE.Points(geometry, material);
    scene.add(particlesMesh);
}
function fetchParticles() {
    fetch('/api/particles').then(r=>r.json()).then(data=>{
        updateParticles(data);
    });
}
function updateSimBox(box) {
    if (!box) return;
    if (simBoxHelper) {
        scene.remove(simBoxHelper);
        simBoxHelper.geometry.dispose();
        simBoxHelper.material.dispose();
    }
    const min = new THREE.Vector3(box.MIN_X, box.MIN_Y, box.MIN_Z);
    const max = new THREE.Vector3(box.MAX_X, box.MAX_Y, box.MAX_Z);
    const box3 = new THREE.Box3(min, max);
    simBoxHelper = new THREE.Box3Helper(box3, 0x00fffa);
    scene.add(simBoxHelper);
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
document.getElementById('pauseBtn').onclick = function(){
    fetch(paused ? '/api/resume' : '/api/pause', {method:'POST'}).then(()=>fetchSettings());
};
document.getElementById('closeBtn').onclick = function() {
    if (confirm("Voulez-vous vraiment fermer l'application ?")) {
        fetch('/api/stop', {method:'POST'}).then(()=>{
            document.body.innerHTML = "<h2 style='color:#fff;text-align:center;margin-top:20vh;'>Application arrêtée.</h2>";
        });
    }
};
init();
fetchSettings();
fetchParticles();
setInterval(fetchParticles, 200);
setInterval(fetchSettings, 1000);
</script>
</body>
</html>
"""

@app.route("/")
def index():
    return render_template_string(HTML)

@app.route("/api/particles")
def api_particles():
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
    # Arrête proprement le serveur Flask
    request.post(f"{API_URL}/stop")
    shutdown = request.environ.get('werkzeug.server.shutdown')
    if shutdown is not None:
        shutdown()
    return "", 204

@app.route("/api/resume", methods=["POST"])
def api_resume():
    requests.post(f"{API_URL}/resume")
    return "", 204

if __name__ == "__main__":
    app.run(port=5000, debug=True)

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
        body { margin:0; overflow:hidden; background:#222; color:#eee; }
        #overlay { position:fixed; top:10px; left:10px; background:rgba(30,30,30,0.9); padding:15px; border-radius:8px; }
        label { display:block; margin-top:8px; }
        input[type=number] { width:80px; }
        button { margin-top:10px; }
    </style>
</head>
<body>
<div id="overlay">
    <form id="settingsForm">
        <label>dt: <input type="number" step="0.01" name="dt" id="dt"></label>
        <label>t_total: <input type="number" step="0.1" name="t_total" id="t_total"></label>
        <label>nb_particles: <input type="number" name="nb_particles" id="nb_particles"></label>
        <button type="submit">Mettre à jour</button>
    </form>
    <button id="pauseBtn">Pause</button>
    <span id="pausedState"></span>
</div>
<canvas id="scene"></canvas>
<script src="https://cdn.jsdelivr.net/npm/three@0.153.0/build/three.min.js"></script>
<script>
let scene, camera, renderer, particlesMesh = null;
let paused = false;

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
function fetchSettings() {
    fetch('/api/settings').then(r=>r.json()).then(data=>{
        document.getElementById('dt').value = data.dt;
        document.getElementById('t_total').value = data.t_total;
        document.getElementById('nb_particles').value = data.nb_particles;
        paused = data.paused;
        document.getElementById('pausedState').textContent = paused ? " (En pause)" : "";
        document.getElementById('pauseBtn').textContent = paused ? "Reprendre" : "Pause";
    });
}
document.getElementById('settingsForm').onsubmit = function(e){
    e.preventDefault();
    const dt = parseFloat(document.getElementById('dt').value);
    const t_total = parseFloat(document.getElementById('t_total').value);
    const nb_particles = parseInt(document.getElementById('nb_particles').value);
    fetch('/api/settings', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({dt, t_total, nb_particles})
    }).then(()=>fetchSettings());
};
document.getElementById('pauseBtn').onclick = function(){
    fetch(paused ? '/api/resume' : '/api/pause', {method:'POST'}).then(()=>fetchSettings());
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

@app.route("/api/resume", methods=["POST"])
def api_resume():
    requests.post(f"{API_URL}/resume")
    return "", 204

if __name__ == "__main__":
    app.run(port=5000, debug=True)

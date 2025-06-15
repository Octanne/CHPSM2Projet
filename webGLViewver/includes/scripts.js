import * as THREE from 'three';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.177.0/examples/jsm/controls/OrbitControls.js';

let scene, camera, renderer, controls, particlesMesh = null, simBoxHelper = null, paused = false;
let particlesInterval = null, settingsInterval = null, particleSize = 6;

function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
}

function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 1, 20000);
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
    const material = new THREE.PointsMaterial({ color: 0xffff00, size: particleSize });
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

function fetchParticles() {
    fetch('/api/particles').then(r=>r.json()).then(data=>{
        updateParticles(data);
    });
}

function fetchSettings() {
    fetch('/api/settings').then(r=>r.json()).then(data=>{
        document.getElementById('particle_size_current').textContent = particleSize;
        document.getElementById('dt_current').textContent = data.dt;
        document.getElementById('t_total_current').textContent = data.t_total;
        document.getElementById('nb_particles_current').textContent = data.nb_particles;
        document.getElementById('current_time_current').textContent = data.current_time;
        
        document.getElementById('particle_size_input').placeholder = particleSize;
        document.getElementById('dt_input').placeholder = data.dt;
        document.getElementById('t_total_input').placeholder = data.t_total;
        document.getElementById('nb_particles_input').placeholder = data.nb_particles;
        document.getElementById('current_time_input').placeholder = data.current_time;
        
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

        // Update pause state
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
    
// Event listeners for settings overlay submission
document.getElementById('settingsForm').onsubmit = function(e){
    e.preventDefault();
    const payload = {};
    
    const v1 = document.getElementById('particle_size_input').value;
    if (v1 !== "") {
        particleSize = parseFloat(v1);
        document.getElementById('particle_size_input').value = "";
        document.getElementById('particle_size_current').textContent = particleSize;
    }
    
    const v2 = document.getElementById('dt_input').value;
    if (v2 !== "") payload.dt = parseFloat(v2);
    
    const v3 = document.getElementById('t_total_input').value;
    if (v3 !== "") payload.t_total = parseFloat(v3);
    
    const v4 = document.getElementById('current_time_input').value;
    if (v4 !== "") payload.current_time = parseFloat(v4);
    
    const v5 = document.getElementById('nb_particles_input').value;
    if (v5 !== "") payload.nb_particles = parseInt(v5);
    
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
    
// Event listeners for box simu overlay submission
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

// Event listeners for pause/resume and close buttons
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

// Event listeners for download and upload buttons
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
            });
        } catch (err) {
            console.error("Erreur lors de l'import du fichier de particules :", err);
            document.getElementById('uploadParticlesStatus').textContent = "Fichier invalide";
        }
        // We clear the message after 3 seconds
        setTimeout(() => document.getElementById('uploadParticlesStatus').innerHTML = "&nbsp;", 3000);
    };
    reader.readAsText(file);
    e.target.value = "";
};

// Gestion du bouton show/hide GUI
const toggleGuiBtn = document.getElementById('toggleGuiBtn');
const toggleGuiBtnText = document.getElementById('toggleGuiBtnText');
let guiVisible = true;
toggleGuiBtn.onclick = function() {
    guiVisible = !guiVisible;
    if (guiVisible) {
        document.body.classList.remove('hide-gui');
        toggleGuiBtnText.textContent = "Cacher GUI";
    } else {
        document.body.classList.add('hide-gui');
        toggleGuiBtnText.textContent = "Afficher GUI";
    }
};

// Initialize the application
init();
// Fetch initial data
fetchSettings();
fetchParticles();
// Set intervals for periodic updates
particlesInterval = setInterval(fetchParticles, 200);
settingsInterval = setInterval(fetchSettings, 1000);
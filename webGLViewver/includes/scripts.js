import * as THREE from 'three';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.177.0/examples/jsm/controls/OrbitControls.js';

let scene, camera, renderer, controls, particlesMesh = null, simBoxHelper = null, paused = false, guiVisible = true;
let particlesInterval = null, settingsInterval = null, particleSize = 5;
let dontUpdateWhenPaused = false; // Set to true if you want to stop updates when paused
let particleAsMesh = true; // Use mesh for particles instead of points
let particleColor = 0xffff00; // Default color
let scaleEnabled = false; // Toggle for scale application

function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
}

function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 1, 20000);
    camera.position.set(1500,1500,1500);

    // Add lighting so MeshStandardMaterial is visible
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);
    
    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('scene'), antialias: true });
    resize();
    window.addEventListener('resize', resize);
    
    controls = new OrbitControls(camera, renderer.domElement);
    controls.minAzimuthAngle = -Infinity;
    controls.maxAzimuthAngle = Infinity;
    controls.minPolarAngle = 0;
    controls.maxPolarAngle = Math.PI;
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

let particlesMeshses = [];
function updateParticles(particles) {
    // We clean particlesMeshses
    if (particlesMesh) scene.remove(particlesMesh);
    if (particlesMeshses) {
        particlesMeshses.forEach(mesh => scene.remove(mesh));
    }
    // Appliquer l'échelle si activée
    let displayParticles = scaleEnabled
        ? particles.map(applyScaleToParticle)
        : particles;

    if (particleAsMesh) {
        particlesMeshses = [];
        const sphereGeometry = new THREE.SphereGeometry(particleSize, 16, 16);
        const sphereMaterial = new THREE.MeshStandardMaterial({ color: particleColor });
        displayParticles.forEach(p => {
            const mesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
            mesh.position.set(p.x, p.y, p.z);
            particlesMeshses.push(mesh);
            scene.add(mesh);
        });
    } else {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(displayParticles.length * 3);
        displayParticles.forEach((p, i) => {
            positions.set([p.x, p.y, p.z], i * 3);
        });
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const material = new THREE.PointsMaterial({ color: particleColor, size: particleSize });
        particlesMesh = new THREE.Points(geometry, material);

        scene.add(particlesMesh);
    }

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
        document.getElementById('dt_current').textContent = data.dt;
        document.getElementById('t_total_current').textContent = data.t_total;
        document.getElementById('nb_particles_current').textContent = data.nb_particles;
        document.getElementById('current_time_current').textContent = data.current_time;
        
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
        if (dontUpdateWhenPaused) {
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
        }
    });
}
    
// Event listeners for settings overlay submission
document.getElementById('settingsForm').onsubmit = function(e){
    e.preventDefault();
    const payload = {};
    
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
document.getElementById('toggleGuiBtn').onclick = function() {
    guiVisible = !guiVisible;
    const toggleGuiBtnText = document.getElementById('toggleGuiBtnText');
    if (guiVisible) {
        document.body.classList.remove('hide-gui');
        toggleGuiBtnText.textContent = "Cacher GUI";
    } else {
        document.body.classList.add('hide-gui');
        toggleGuiBtnText.textContent = "Afficher GUI";
    }
};

function updateRenderOverlayValues() {
    document.getElementById('render_particle_size_current').textContent = particleSize;
    document.getElementById('render_particle_color_current').textContent = '#' + particleColor.toString(16).padStart(6, '0');
    document.getElementById('render_type_current').textContent = particleAsMesh ? "Sphère" : "Points";
    document.getElementById('render_update_paused_current').textContent = dontUpdateWhenPaused ? "Non" : "Oui";
    // Update les valeurs des inputs avec les variables JS
    renderParticleSizeInput.placeholder = particleSize;
    renderParticleColorInput.placeholder = "#" + particleColor.toString(16).padStart(6, '0');
    renderTypeSelect.value = particleAsMesh ? "mesh" : "points";
    renderUpdatePausedCheckbox.checked = !dontUpdateWhenPaused;
}

// --- Overlay Render Controls ---
const renderParticleSizeInput = document.getElementById('render_particle_size');
const renderParticleColorInput = document.getElementById('render_particle_color');
const renderTypeSelect = document.getElementById('render_type');
const renderUpdatePausedCheckbox = document.getElementById('render_update_paused');
updateRenderOverlayValues();

// Application des paramètres uniquement lors du submit (bouton ou Entrée)
document.getElementById('renderForm').onsubmit = function(e) {
    e.preventDefault();
    // Appliquer les valeurs
    const sizeVal = parseFloat(renderParticleSizeInput.value);
    if (!isNaN(sizeVal)) particleSize = sizeVal;

    const colorVal = renderParticleColorInput.value;
    if (colorVal) particleColor = parseInt(colorVal.replace("#", "0x"));

    particleAsMesh = (renderTypeSelect.value === "mesh");
    dontUpdateWhenPaused = !renderUpdatePausedCheckbox.checked;

    updateRenderOverlayValues();
    fetchParticles();

    // On reset les valeurs des inputs
    renderParticleSizeInput.value = "";
    renderTypeSelect.value = particleAsMesh ? "mesh" : "points";
    renderUpdatePausedCheckbox.checked = !dontUpdateWhenPaused;

    // Gérer l'intervalle si MAJ si pause change
    if (dontUpdateWhenPaused && paused) {
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
};

// --- Gestion de l'échelle (scale) ---
let scaleParams = {
    xMin: 0, xMax: 1000,
    yMin: 0, yMax: 1000,
    zMin: 0, zMax: 1000
};

function applyScaleToParticle(p) {
    if (!scaleEnabled) return p;
    let np = { ...p };
    if (scaleParams.xMin !== null && scaleParams.xMax !== null) {
        np.x = (np.x - scaleParams.xMin) / (scaleParams.xMax - scaleParams.xMin) * 1000 - 500;
    }
    if (scaleParams.yMin !== null && scaleParams.yMax !== null) {
        np.y = (np.y - scaleParams.yMin) / (scaleParams.yMax - scaleParams.yMin) * 1000 - 500;
    }
    if (scaleParams.zMin !== null && scaleParams.zMax !== null) {
        np.z = (np.z - scaleParams.zMin) / (scaleParams.zMax - scaleParams.zMin) * 1000 - 500;
    }
    return np;
}

const toggleScaleBtn = document.getElementById('toggleScaleBtn');
const scaleXMinInput = document.getElementById('scale_x_min');
const scaleXMaxInput = document.getElementById('scale_x_max');
const scaleYMinInput = document.getElementById('scale_y_min');
const scaleYMaxInput = document.getElementById('scale_y_max');
const scaleZMinInput = document.getElementById('scale_z_min');
const scaleZMaxInput = document.getElementById('scale_z_max');
const scaleForm = document.getElementById('scaleForm');
const updateScaleBtn = document.getElementById('updateScaleBtn');

toggleScaleBtn.onclick = function() {
    scaleEnabled = !scaleEnabled;
    updateScaleOverlayInputs();
    fetchParticles();
};

function updateScaleOverlayInputs() {
    scaleXMinInput.value = scaleParams.xMin !== null ? scaleParams.xMin : '';
    scaleXMaxInput.value = scaleParams.xMax !== null ? scaleParams.xMax : '';
    scaleYMinInput.value = scaleParams.yMin !== null ? scaleParams.yMin : '';
    scaleYMaxInput.value = scaleParams.yMax !== null ? scaleParams.yMax : '';
    scaleZMinInput.value = scaleParams.zMin !== null ? scaleParams.zMin : '';
    scaleZMaxInput.value = scaleParams.zMax !== null ? scaleParams.zMax : '';
    // Ajout de l'icône dynamique
    if (scaleEnabled) {
        toggleScaleBtn.innerHTML = `<span class="icon">
            <svg viewBox="0 0 20 20" fill="#23272f" xmlns="http://www.w3.org/2000/svg">
                <line x1="5" y1="5" x2="15" y2="15" stroke="#23272f" stroke-width="2"/>
                <line x1="15" y1="5" x2="5" y2="15" stroke="#23272f" stroke-width="2"/>
            </svg>
        </span><span id="toggleScaleBtnText">Désactiver</span>`;
    } else {
        toggleScaleBtn.innerHTML = `<span class="icon">
            <svg viewBox="0 0 20 20" fill="#23272f" xmlns="http://www.w3.org/2000/svg">
                <polyline points="5,11 9,15 15,5" stroke="#23272f" stroke-width="2" fill="none"/>
            </svg>
        </span><span id="toggleScaleBtnText">Activer</span>`;
    }
}

function updateScaleFactorValues(e) {
    if (e) e.preventDefault();
    scaleParams.xMin = scaleXMinInput.value !== "" ? parseFloat(scaleXMinInput.value) : 0;
    scaleParams.xMax = scaleXMaxInput.value !== "" ? parseFloat(scaleXMaxInput.value) : 1000;
    scaleParams.yMin = scaleYMinInput.value !== "" ? parseFloat(scaleYMinInput.value) : 0;
    scaleParams.yMax = scaleYMaxInput.value !== "" ? parseFloat(scaleYMaxInput.value) : 1000;
    scaleParams.zMin = scaleZMinInput.value !== "" ? parseFloat(scaleZMinInput.value) : 0;
    scaleParams.zMax = scaleZMaxInput.value !== "" ? parseFloat(scaleZMaxInput.value) : 1000;
    updateScaleOverlayInputs();
    fetchParticles();
    console.log("Nouveau facteur d'échelle appliqué :", scaleParams);
}

// Correction : utiliser addEventListener pour onsubmit
scaleForm.onsubmit = function(e) {
    console.log("Formulaire d'échelle soumis");
    e.preventDefault();
    updateScaleFactorValues();
}
updateScaleBtn.onclick = updateScaleFactorValues;

// Initialisation des valeurs d'échelle à l'ouverture
updateScaleOverlayInputs();

// Initialize the application
init();
// Fetch initial data
fetchSettings();
fetchParticles();
// Set intervals for periodic updates
particlesInterval = setInterval(fetchParticles, 200);
settingsInterval = setInterval(fetchSettings, 1000);
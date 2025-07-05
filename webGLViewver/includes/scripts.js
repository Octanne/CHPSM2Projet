import * as THREE from 'three';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.177.0/examples/jsm/controls/OrbitControls.js';

let scene, camera, renderer, controls, particlesMesh = null, simBoxHelper = null, paused = false, guiVisible = true;
let particlesInterval = null, settingsInterval = null, particleSize = 5;
let dontUpdateWhenPaused = false; // Set to true if you want to stop updates when paused
let particleAsMesh = true; // Use mesh for particles instead of points
let particleColor = 0xffff00; // Default color
let scaleEnabled = false; // Toggle for scale application
let scaleParams = {
    xMin: 0, xMax: 1000,
    yMin: 0, yMax: 1000,
    zMin: 0, zMax: 1000
};
let realBoxSize = {
    xMin: -1, xMax: -1,
    yMin: -1, yMax: -1,
    zMin: -1, zMax: -1
};

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hoveredParticleId = null;
let selectedParticleId = null;
let latestParticlesData = [];
let trailLine = null;

let mediaRecorder = null;
let recordedChunks = [];
let isRecording = false;

let hiddenParticles = new Set();

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
    // Nettoyage mémoire des anciens objets
    if (particlesMesh) {
        scene.remove(particlesMesh);
        if (particlesMesh.geometry) particlesMesh.geometry.dispose();
        if (particlesMesh.material) particlesMesh.material.dispose();
        particlesMesh = null;
    }
    if (particlesMeshses) {
        particlesMeshses.forEach(mesh => {
            scene.remove(mesh);
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) mesh.material.dispose();
        });
        particlesMeshses = [];
    }
    let displayParticles = scaleEnabled
        ? particles.map(applyScaleToParticle)
        : particles;
    displayParticles = displayParticles.filter(p => !hiddenParticles.has(p.id));

    if (particleAsMesh) {
        particlesMeshses = [];
        const sphereMaterialDft = new THREE.MeshStandardMaterial({ color: particleColor });
        displayParticles.forEach((p, i) => {
            // Utilise la taille pré-calculée
            const size = p.displaySize || 8;
            const geometry = new THREE.SphereGeometry(size, 24, 24);
            const material = p.colorHex
                ? new THREE.MeshStandardMaterial({ color: p.colorHex })
                : sphereMaterialDft;
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(p.x, p.y, p.z);
            mesh.userData.particleId = p.id;
            scene.add(mesh);
            particlesMeshses.push(mesh);
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

let showSimBox = true; // Ajout d'un état pour afficher/cacher la boîte
function updateSimBox(box) {
    if (!box) return;
    if (simBoxHelper) {
        scene.remove(simBoxHelper);
        simBoxHelper = null;
    }
    if (!showSimBox) return; // Ne rien afficher si caché
    if (scaleEnabled) box = scaleParams; // Use scaleParams if scale is enabled
    const min = new THREE.Vector3(box.xMin, box.yMin, box.zMin);
    const max = new THREE.Vector3(box.xMax, box.yMax, box.zMax);
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
    const pauseIcon2 = document.getElementById('playIcon');
    const playBtn = document.getElementById('playBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    if (paused) {
        pauseBtnText.textContent = "Reprendre";
        pauseBtn.title = "Reprendre la simulation";
        playBtn.title = "Reprendre la simulation";
        pauseIcon.innerHTML = `<svg viewBox="0 0 20 20" fill="#23272f" xmlns="http://www.w3.org/2000/svg"><polygon points="5,3 17,10 5,17"/></svg>`;
        pauseIcon2.innerHTML = `<svg viewBox="0 0 20 20" fill="#23272f" xmlns="http://www.w3.org/2000/svg"><polygon points="5,3 17,10 5,17"/></svg>`;
    } else {
        pauseBtnText.textContent = "Pause";
        playBtn.title = "Mettre en pause la simulation";
        pauseBtn.title = "Mettre en pause la simulation";
        pauseIcon.innerHTML = `<svg viewBox="0 0 20 20" fill="#23272f" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="3" width="4" height="14"/><rect x="12" y="3" width="4" height="14"/></svg>`;
        pauseIcon2.innerHTML = `<svg viewBox="0 0 20 20" fill="#23272f" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="3" width="4" height="14"/><rect x="12" y="3" width="4" height="14"/></svg>`;
    }

    checkIfIntervalUpdateNeedToRegister();
}

function clearIntervals() {
    if (particlesInterval) {
        clearInterval(particlesInterval);
        particlesInterval = null;
    }
    if (settingsInterval) {
        clearInterval(settingsInterval);
        settingsInterval = null;
    }
}
function setIntervals() {
    if (!particlesInterval) {
        particlesInterval = setInterval(fetchParticles, 200);
    }
    if (!settingsInterval) {
        settingsInterval = setInterval(fetchSettings, 1000);
    }
}
function checkIfIntervalUpdateNeedToRegister() {
    if (!dontUpdateWhenPaused) return;
    if (paused) {
        clearIntervals();
    } else {
        setIntervals();
    }
}

function fetchParticles() {
    let url = '/api/particles';
    const reso = document.getElementById('history_resolution_current').textContent;
    if (reso && reso !== "Tout") url += '?history_resolution=' + encodeURIComponent(reso);
    fetch('/api/particles').then(r=>r.json()).then(data=>{
        // Calcul de la taille d'affichage pour chaque particule (une seule fois)
        if (!data[0]?.displaySize) {
            //  Calcule la taille brute pour chaque particule
            const rawSizes = data.map(p =>
                Math.cbrt((p.mass || 1) / (p.masseVolumique || 1))
            );
            // Trouve la taille brute maximale
            const maxRawSize = Math.max(...rawSizes, 1);
            //  Taille max d'affichage
            const maxDisplaySize = 15;
            const minDisplaySize = 5;
            data.forEach((p, i) => {
                // Taille relative, mais toujours la même pour chaque id
                p.displaySize = minDisplaySize + (rawSizes[i] / maxRawSize) * (maxDisplaySize - minDisplaySize);
            });
        }
        latestParticlesData = data;
        updateParticles(data);
        updateTrail(); 
    });
}


function fetchSettings() {
    fetch('/api/settings').then(r=>r.json()).then(data=>{
        document.getElementById('dt_current').textContent = data.dt;
        document.getElementById('dt_current').title = "Delta Time (dt) : " + data.dt;
        document.getElementById('t_total_current').textContent = data.t_total;
        document.getElementById('t_total_current').title = "Temps total de la simulation (t_total) : " + data.t_total;
        document.getElementById('nb_particles_current').textContent = data.nb_particles;
        document.getElementById('nb_particles_current').title = "Nombre de particules (nb_particles) : " + data.nb_particles;
        document.getElementById('current_time_current').textContent = data.current_time;
        document.getElementById('current_time_current').title = "Temps actuel de la simulation (current_time) : " + data.current_time;
        
        document.getElementById('dt_input').placeholder = data.dt;
        document.getElementById('t_total_input').placeholder = data.t_total;
        document.getElementById('nb_particles_input').placeholder = data.nb_particles;
        document.getElementById('current_time_input').placeholder = data.current_time;
        document.getElementById('history_resolution_current').textContent = data.history_resolution ?? "Tout";
        document.getElementById('history_resolution_current').title = "Nombre de points d'historique envoyés au client";
        document.getElementById('history_resolution_input').placeholder = data.history_resolution ?? "Tout";
        
        // Update box overlay fields
        for (const key of ["MIN_X", "MIN_Y", "MIN_Z", "MAX_X", "MAX_Y", "MAX_Z"]) {
            if (data[key] !== undefined) {
                document.getElementById(key + "_current").textContent = data[key];
                document.getElementById(key + "_current").title = key + " : " + data[key];
                document.getElementById(key + "_input").placeholder = data[key];
            }
        }
        if (data.MIN_X !== undefined && data.MIN_Y !== undefined && data.MIN_Z !== undefined &&
            data.MAX_X !== undefined && data.MAX_Y !== undefined && data.MAX_Z !== undefined) {
            // Only update if the box size has changed
            if (
            realBoxSize.xMin !== data.MIN_X ||
            realBoxSize.yMin !== data.MIN_Y ||
            realBoxSize.zMin !== data.MIN_Z ||
            realBoxSize.xMax !== data.MAX_X ||
            realBoxSize.yMax !== data.MAX_Y ||
            realBoxSize.zMax !== data.MAX_Z
            ) {
            realBoxSize = {
                xMin: data.MIN_X,
                yMin: data.MIN_Y,
                zMin: data.MIN_Z,
                xMax: data.MAX_X,
                yMax: data.MAX_Y,
                zMax: data.MAX_Z
            };
            updateSimBox(realBoxSize);
            
            }
        }
        // Update pause state
        paused = data.paused;
        updatePauseButton(paused);

        // Synchronisation des champs rewind
        const rewindMaxHistoryInput = document.getElementById('rewind_max_history_input');
        if (rewindMaxHistoryInput && document.activeElement !== rewindMaxHistoryInput) {
            rewindMaxHistoryInput.value = data.rewind_max_history ?? 5;
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

    const v6 = document.getElementById('history_resolution_input').value;
    if (v6 !== "") payload.history_resolution = parseInt(v6);
    
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
        document.getElementById('history_resolution_input').value = "";
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
document.getElementById('playBtn').onclick = function(){
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

document.getElementById('recordBtn').onclick = function() {
    if (!isRecording) {
        document.body.classList.add('hide-gui');
        const stream = renderer.domElement.captureStream(30);
        recordedChunks = [];
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
        mediaRecorder.ondataavailable = function(e) {
            if (e.data.size > 0) recordedChunks.push(e.data);
        };
        mediaRecorder.onstop = function() {
            document.body.classList.remove('hide-gui');
            const blob = new Blob(recordedChunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'simulation.webm';
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);
        };
        mediaRecorder.start();
        isRecording = true;
        // Passe en carré rouge
        document.getElementById('recordBtn').innerHTML = `<span id="recordIcon" style="display:inline-block;width:18px;height:18px;background:#e53935;vertical-align:middle;"></span>`;
    } else {
        mediaRecorder.stop();
        isRecording = false;
        // Reviens au cercle rouge
        document.getElementById('recordBtn').innerHTML = `<span id="recordIcon" style="display:inline-block;width:18px;height:18px;border-radius:50%;background:#e53935;vertical-align:middle;"></span>`;
    }
};


function downloadParticlesCurrentStates() {
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

let particlesUploadedSave = {};
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
            // We save by cloning the JSON to avoid modifying the original file
            particlesUploadedSave = JSON.parse(JSON.stringify(json));
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
    document.getElementById('render_particle_size_current').title = "Taille des particules (particleSize) : " + particleSize;
    document.getElementById('render_particle_color_current').textContent = '#' + particleColor.toString(16).padStart(6, '0');
    document.getElementById('render_particle_color_current').title = "Couleur des particules (particleColor) : #" + particleColor.toString(16).padStart(6, '0');
    document.getElementById('render_type_current').textContent = particleAsMesh ? "Sphère" : "Points";
    document.getElementById('render_type_current').title = "Type de rendu des particules (particleAsMesh) : " + (particleAsMesh ? "Sphère" : "Points");
    document.getElementById('render_update_paused_current').textContent = dontUpdateWhenPaused ? "Non" : "Oui";
    document.getElementById('render_update_paused_current').title = "Mettre à jour les particules lorsque la simulation est en pause (dontUpdateWhenPaused) : " + (dontUpdateWhenPaused ? "Non" : "Oui");
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
    checkIfIntervalUpdateNeedToRegister();
};

// --- Gestion de l'échelle (scale) ---
function applyScaleToParticle(p) {
    // Map p from realBoxSize to scaleParams for each axis
    let np = { ...p };
    function scale(val, minSrc, maxSrc, minDst, maxDst) {
        if (maxSrc - minSrc === 0) return minDst; // Avoid division by zero
        return ((val - minSrc) / (maxSrc - minSrc)) * (maxDst - minDst) + minDst;
    }
    np.x = scale(p.x, realBoxSize.xMin, realBoxSize.xMax, scaleParams.xMin, scaleParams.xMax);
    np.y = scale(p.y, realBoxSize.yMin, realBoxSize.yMax, scaleParams.yMin, scaleParams.yMax);
    np.z = scale(p.z, realBoxSize.zMin, realBoxSize.zMax, scaleParams.zMin, scaleParams.zMax);
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
    updateSimBox(realBoxSize);
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

function updateScaleFactorValues() {
    scaleParams.xMin = scaleXMinInput.value !== "" ? parseFloat(scaleXMinInput.value) : 0;
    scaleParams.xMax = scaleXMaxInput.value !== "" ? parseFloat(scaleXMaxInput.value) : 1000;
    scaleParams.yMin = scaleYMinInput.value !== "" ? parseFloat(scaleYMinInput.value) : 0;
    scaleParams.yMax = scaleYMaxInput.value !== "" ? parseFloat(scaleYMaxInput.value) : 1000;
    scaleParams.zMin = scaleZMinInput.value !== "" ? parseFloat(scaleZMinInput.value) : 0;
    scaleParams.zMax = scaleZMaxInput.value !== "" ? parseFloat(scaleZMaxInput.value) : 1000;
    updateScaleOverlayInputs();
    fetchParticles();
    updateSimBox(realBoxSize);
}

// Correction : utiliser addEventListener pour onsubmit
scaleForm.onsubmit = function(e) {
    e.preventDefault();
    updateScaleFactorValues();
}

document.getElementById('rewindBtn').onclick = function() {
    // Récupère la valeur de rewind_time et rewind_max_history depuis les inputs
    const rewindTimeInput = document.getElementById('rewind_time_input');
    const rewind_time = rewindTimeInput?.value ? parseFloat(rewindTimeInput.value) : 5.0;

    fetch('/api/rewind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rewind_time: rewind_time })
    }).then(() => {
        fetchSettings();
        fetchParticles();
    });
};

// Synchronisation de la taille max de l'historique à la modification du champ
document.getElementById('rewindForm').onsubmit = function(e) {
    e.preventDefault();
    const rewindMaxHistoryInput = document.getElementById('rewind_max_history_input');
    const val = parseFloat(rewindMaxHistoryInput.value);
    if (!isNaN(val)) {
        fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rewind_max_history: val })
        }).then(() => fetchSettings());
    }
};

// Initialisation des valeurs d'échelle à l'ouverture
updateScaleOverlayInputs();

// Ajout du bouton Afficher/Cacher la boîte de simulation
const toggleBoxBtn = document.getElementById('toggleBoxBtn');
const toggleBoxBtnText = document.getElementById('toggleBoxBtnText');
function updateToggleBoxBtnText() {
    toggleBoxBtnText.textContent = showSimBox ? "Invisible" : "Visible";
    toggleBoxBtn.title = showSimBox ? "Cacher la boîte de simulation" : "Afficher la boîte de simulation";
}
if (toggleBoxBtn) {
    toggleBoxBtn.onclick = function() {
        showSimBox = !showSimBox;
        updateToggleBoxBtnText();
        updateSimBox(realBoxSize);
    };
    updateToggleBoxBtnText();
}

// --- Drag & Drop pour l'overlay timeline ---
const overlayTimeline = document.getElementById('overlay-timeline');
let isDraggingTimeline = false;
let dragOffsetX = 0, dragOffsetY = 0;

overlayTimeline.addEventListener('mousedown', function(e) {
    // Seulement bouton gauche
    if (e.button !== 0) return;
    isDraggingTimeline = true;
    overlayTimeline.classList.add('dragging');
    // Calculer l'offset entre la souris et le coin supérieur gauche de l'overlay
    const rect = overlayTimeline.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;
    // Désactiver la transition CSS pour un déplacement fluide
    overlayTimeline.style.transition = 'none';
    // Pour éviter la sélection de texte
    document.body.style.userSelect = 'none';
});

document.addEventListener('mousemove', function(e) {
    if (!isDraggingTimeline) return;
    // Calculer la nouvelle position
    let left = e.clientX - dragOffsetX;
    let top = e.clientY - dragOffsetY;
    // Limiter dans la fenêtre
    left = Math.max(0, Math.min(window.innerWidth - overlayTimeline.offsetWidth, left));
    top = Math.max(0, Math.min(window.innerHeight - overlayTimeline.offsetHeight, top));
    overlayTimeline.style.left = left + 'px';
    overlayTimeline.style.top = top + 'px';
    overlayTimeline.style.right = 'auto';
    overlayTimeline.style.bottom = 'auto';
    overlayTimeline.style.transform = 'none';
    overlayTimeline.style.position = 'fixed';
});

document.getElementById('resetBtn').onclick = function() {
    if (confirm("Voulez-vous vraiment réinitialiser la simulation ? Cela effacera toutes les particules et l'historique.")) {
        if (particlesUploadedSave && Object.keys(particlesUploadedSave).length > 0) {
            // Si on a un fichier de particules uploadé, on le réutilise
            return fetch('/api/particles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(particlesUploadedSave)
            }).then(() => {
                // On recharge les paramètres par défaut
                fetchSettings();
                fetchParticles();
            });
        } else {
            // Sinon, on envoie une requête pour réinitialiser la simulation}
            fetch('/api/reset', { method: 'POST' })
                .then(() => {
                    // Sinon, on recharge les paramètres par défaut
                    // Option simple : recharge toute la page
                    location.reload();
                });
        }
    }
};

document.getElementById('showAllParticlesBtn').onclick = () => {
    hiddenParticles.clear();
    updateParticles(latestParticlesData);
    updateParticleList(latestParticlesData);
};
document.getElementById('hideAllParticlesBtn').onclick = () => {
    latestParticlesData.forEach(p => hiddenParticles.add(p.id));
    updateParticles(latestParticlesData);
    updateParticleList(latestParticlesData);
};

document.addEventListener('mouseup', function(e) {
    if (isDraggingTimeline) {
        isDraggingTimeline = false;
        overlayTimeline.classList.remove('dragging');
        overlayTimeline.style.transition = '';
        document.body.style.userSelect = '';
    }
});

function onPointerMove(event) {
    mouse.x = (event.clientX / renderer.domElement.clientWidth) * 2 - 1;
    mouse.y = - (event.clientY / renderer.domElement.clientHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(particlesMeshses);
    if (intersects.length > 0) {
        hoveredParticleId = intersects[0].object.userData.particleId;
        showParticleInfo(hoveredParticleId); 
    } else {
        hoveredParticleId = null;
        hideParticleInfo();
    }
    updateTrail();
}

function onPointerClick(event) {
    if (hoveredParticleId !== null) {
        selectedParticleId = hoveredParticleId;
        showParticleInfo(selectedParticleId);
        updateTrail();
    } else {
        selectedParticleId = null;
        hideParticleInfo();
        updateTrail();
    }
}

function showParticleInfo(id, x = null, y = null, clicked = false) {
    const p = latestParticlesData.find(ptc => ptc.id === id);
    if (!p) return;
    let html = `<b>Particule #${p.id}`;
    if (p.name) html += ` — <span style="color:#ffd369">${p.name}</span>`;
    html += `</b><br>`;
    html += `Masse : ${p.mass}<br>`;
    if (p.masseVolumique !== undefined) html += `Masse Vol. : ${p.masseVolumique}<br>`;
    html += `Position : (${p.x}, ${p.y}, ${p.z})<br>`;
    html += `Vitesse : (${p.vx}, ${p.vy}, ${p.vz})<br>`;
    if (clicked) html += "<i>(Sélectionnée)</i>";
    const popup = document.getElementById('particleInfoPopup');

    // Si x/y ne sont pas fournis, on projette la position 3D de la particule
    if (x === null || y === null) {
        // Crée un vecteur 3D pour la position de la particule
        const vector = new THREE.Vector3(p.x, p.y, p.z);
        vector.project(camera); // Projection dans l'espace écran normalisé
        // Conversion en pixels
        x = (vector.x * 0.5 + 0.5) * renderer.domElement.clientWidth;
        y = (-vector.y * 0.5 + 0.5) * renderer.domElement.clientHeight;
    }

    popup.innerHTML = html;
    popup.style.left = `${x + 16}px`;
    popup.style.top = `${y + 16}px`;
    popup.style.display = 'block';
}

function hideParticleInfo() {
    document.getElementById('particleInfoPopup').style.display = 'none';
}

function updateTrail() {
    // Retire l'ancien trail
    if (trailLine) {
        scene.remove(trailLine);
        trailLine.geometry.dispose();
        trailLine.material.dispose();
        trailLine = null;
    }
    // Affiche le trail pour la particule sélectionnée ou survolée
    let particleIdToShow = selectedParticleId ?? hoveredParticleId;
    if (particleIdToShow !== null && latestParticlesData) {
        const p = latestParticlesData.find(ptc => ptc.id === particleIdToShow);
        if (p?.history && p.history.length > 1) {
            const points = p.history.map(pos => new THREE.Vector3(pos.x, pos.y, pos.z));
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const material = new THREE.LineBasicMaterial({ color: 0xff0000 });
            trailLine = new THREE.Line(geometry, material);
            scene.add(trailLine);
        }
    }
}

function updateParticleList(particles) {
    const list = document.getElementById('particleList');
    if (!list) return;
    list.innerHTML = '';
    particles.forEach(p => {
        const row = document.createElement('div');
        row.className = 'particle-list-row';
        const isHidden = hiddenParticles.has(p.id);
        row.innerHTML = `
            <span style="color:#ffd369">#${p.id}</span>
            ${p.name ? ` <span style="color:#aaa;font-size:0.98em;">${p.name}</span>` : ''}
            <span class="eye-btn" data-id="${p.id}" style="float:right;cursor:pointer;margin-left:10px;">
                ${isHidden
                    ? `<svg width="18" height="18" viewBox="0 0 20 20" fill="#888"><path d="M2 10s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6zm8 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><line x1="4" y1="4" x2="16" y2="16" stroke="#e74c3c" stroke-width="2"/></svg>`
                    : `<svg width="18" height="18" viewBox="0 0 20 20" fill="#ffd369"><path d="M2 10s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6zm8 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/></svg>`
                }
            </span>
        `;
        row.onclick = (e) => {
            // Ne sélectionne pas si clic sur l'œil
            if (e.target.closest('.eye-btn')) return;
            selectedParticleId = p.id;
            showParticleInfo(p.id);
            updateTrail();
        };
        list.appendChild(row);
    });

    // Ajoute les listeners sur les yeux
    list.querySelectorAll('.eye-btn').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const id = parseInt(btn.getAttribute('data-id'));
            if (hiddenParticles.has(id)) hiddenParticles.delete(id);
            else hiddenParticles.add(id);
            updateParticles(latestParticlesData); // Met à jour l'affichage
            updateParticleList(latestParticlesData); // Rafraîchit la liste
        };
    });
}

// Met à jour la liste à chaque fetch de particules
function fetchAndDisplayParticleList() {
    fetch('/api/particles')
        .then(res => res.json())
        .then(data => {
            updateParticleList(data);
        });
}

// Appeler au chargement de la page et à chaque update
window.addEventListener('DOMContentLoaded', () => {
    fetchAndDisplayParticleList();
});
setInterval(fetchAndDisplayParticleList, 1000);

// Initialize the application
init();
// Fetch initial data
fetchSettings();
fetchParticles();
renderer.domElement.addEventListener('mousemove', onPointerMove);
renderer.domElement.addEventListener('click', onPointerClick);
// Set intervals for periodic updates
particlesInterval = setInterval(fetchParticles, 200);
settingsInterval = setInterval(fetchSettings, 1000);
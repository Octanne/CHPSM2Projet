import math
import json
import random

# Constantes réelles
G = 6.67430e-11  # m^3 kg^-1 s^-2
AU = 1.496e11    # 1 unité astronomique en mètres

# Soleil
sun_mass = 1.9885e30  # kg
sun_x = 0.0
sun_y = 0.0

# Données planètes : (demi-grand axe [m], masse [kg], angle_deg, nom, inclinaison [deg], masse volumique [kg/m^3], couleur)
planets_data = [
    # (a, mass, angle_deg, name, inclination_deg, masseVolumique, colorHex)
    (0.387 * AU, 3.3011e23,   0.0,   "Mercury", 7.0,   5427, "#ffcc00"),
    (0.723 * AU, 4.8675e24,  30.0,   "Venus", 3.39,    5243, "#ff9900"),
    (1.000 * AU, 5.97237e24, 60.0,   "Earth", 0.0,     5514, "#3399ff"),
    (1.524 * AU, 6.4171e23, 120.0,   "Mars", 1.85,     3933, "#ff3300"),
    (5.203 * AU, 1.8982e27, 180.0,   "Jupiter", 1.31,  1326, "#ff6600"),
    (9.537 * AU, 5.6834e26, 240.0,   "Saturn", 2.49,    687, "#ff9933"),
    (19.191 * AU, 8.6810e25, 300.0,  "Uranus", 0.77,   1271, "#66ccff"),
    (30.071 * AU, 1.02413e26, 330.0, "Neptune", 1.77,  1638, "#3399cc"),
]

def add_planet(r, mass, angle_deg, name, inclination_deg, mass_volumique=None, color_hex=None):
    angle = math.radians(angle_deg)
    inclination = math.radians(inclination_deg)
    px = sun_x + r * math.cos(angle)
    py = sun_y + r * math.sin(angle)
    pz = r * math.sin(inclination)
    v = math.sqrt(G * sun_mass / r)
    vx = -v * math.sin(angle)
    vy =  v * math.cos(angle)
    vz = 0.0
    return {
        "name": name,
        "x": px,
        "y": py,
        "z": pz,
        "vx": vx,
        "vy": vy,
        "vz": vz,
        "mass": mass,
        "masseVolumique": mass_volumique,
        "colorHex": color_hex
    }

def add_asteroid_belt(n_asteroids=100, r_min=2.1*AU, r_max=3.3*AU):
    asteroids = []
    for i in range(n_asteroids):
        r = random.uniform(r_min, r_max)
        angle = random.uniform(0, 2 * math.pi)
        inclination = random.uniform(-0.05, 0.05)  # petite variation Z
        mass = random.uniform(1e15, 1e20)  # masses réalistes d'astéroïdes
        px = sun_x + r * math.cos(angle)
        py = sun_y + r * math.sin(angle)
        pz = r * math.sin(inclination)
        v = math.sqrt(G * sun_mass / r)
        vx = -v * math.sin(angle)
        vy =  v * math.cos(angle)
        vz = 0.0
        asteroids.append({
            "name": f"Asteroid_{i}",
            "x": px,
            "y": py,
            "z": pz,
            "vx": vx,
            "vy": vy,
            "vz": vz,
            "mass": mass,
            "masseVolumique": 3000,
            "colorHex": "#888888"
        })
    return asteroids

def init_particles():
    particles = []
    particles.append({
        "name": "Sun",
        "x": sun_x,
        "y": sun_y,
        "z": 0.0,
        "vx": 0.0,
        "vy": 0.0,
        "vz": 0.0,
        "mass": sun_mass,
        "masseVolumique": 1408,
        "colorHex": "#ffff00"
    })
    for r, mass, angle, name, incl, masse_volumique, color_hex in planets_data:
        particles.append(add_planet(r, mass, angle, name, incl, masse_volumique, color_hex))
    particles.extend(add_asteroid_belt())
    return particles

if __name__ == "__main__":
    particles = init_particles()

    # Calcul des bornes de la boîte de simulation en tenant compte des orbites (rayons en mètres)
    planet_rs = [r for r, *_ in planets_data]
    planet_incls = [math.radians(incl) for *_, incl, _, _ in planets_data]
    ast_r_min = 2.1 * AU
    ast_r_max = 3.3 * AU
    ast_incl_max = 0.05  # radians

    r_max = max(max(planet_rs), ast_r_max)
    z_max_planets = [r * abs(math.sin(incl)) for r, incl in zip(planet_rs, planet_incls)]
    z_max_asteroids = ast_r_max * abs(math.sin(ast_incl_max))
    z_max = max(z_max_planets + [z_max_asteroids])

    # Décalage pour que tout soit positif
    offset_x = r_max
    offset_y = r_max
    offset_z = z_max*2

    # Décale toutes les particules
    for p in particles:
        p["x"] += offset_x
        p["y"] += offset_y
        p["z"] += offset_z

    # Affichage des bornes (tout positif)
    print(f"// BOX X: min=0.00e+00 m, max={2*r_max:.2e} m")
    print(f"// BOX Y: min=0.00e+00 m, max={2*r_max:.2e} m")
    print(f"// BOX Z: min=0.00e+00 m, max={2*z_max:.2e} m")

    print(json.dumps(particles, indent=2))

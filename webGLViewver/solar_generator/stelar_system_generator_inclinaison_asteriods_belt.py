import math
import json
import random

# Constants
G = 6.67430e-11  # gravitational constant (m^3 kg^-1 s^-2)
sun_mass = 1.0e11  # arbitrary mass unit, like your code
sun_x = 500.0
sun_y = 500.0

# Planets data: (radius, mass, angle_deg, name, inclination_deg, masseVolumique)
planets_data = [
    # (radius, mass, angle_deg, name, inclination_deg, masseVolumique)
    (50.0, 2.0e3,   0.0,   "Mercury", 0.0,   5427),   # kg/m^3
    (80.0, 3.0e3,  30.0,   "Venus", 3.39,    5243),
    (120.0, 4.0e3, 60.0,   "Earth", 0.0,     5514),
    (160.0, 6.0e3, 120.0,  "Mars", 0.0,      3933),
    (250.0, 8.0e3, 180.0,  "Jupiter", 0.0,   1326),
    (350.0, 5.0e3, 240.0,  "Saturn", 0.0,    687),
    (420.0, 4.0e3, 300.0,  "Uranus", 0.0,    1271),
    (460.0, 4.0e3, 330.0,  "Neptune", 0.0,   1638),
]

def add_planet(r, mass, angle_deg, name, inclination_deg, mass_volumique=None):
    angle = math.radians(angle_deg)
    inclination = math.radians(inclination_deg)
    px = sun_x + r * math.cos(angle)
    py = sun_y + r * math.sin(angle)
    pz = r * math.sin(inclination)+500.0

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
        "masseVolumique": mass_volumique
    }

def add_asteroid_belt(n_asteroids=100, r_min=180.0, r_max=240.0):
    asteroids = []
    for i in range(n_asteroids):
        r = random.uniform(r_min, r_max)
        angle = random.uniform(0, 2 * math.pi)
        inclination = random.uniform(-0.05, 0.05)  # small Z variation
        mass = random.uniform(0.1, 1.0)  # tiny mass

        px = sun_x + r * math.cos(angle)
        py = sun_y + r * math.sin(angle)
        pz = r * math.sin(inclination)+500.0

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
            "masseVolumique": 3000  # arbitrary density for asteroids
        })
    return asteroids

def init_particles():
    particles = []
    particles.append({
        "name": "Sun",
        "x": sun_x,
        "y": sun_y,
        "z": 500.0,
        "vx": 0.0,
        "vy": 0.0,
        "vz": 0.0,
        "mass": sun_mass,
        "masseVolumique": 1408  # arbitrary density for the Sun
    })
    for r, mass, angle, name, incl, masse_volumique in planets_data:
        particles.append(add_planet(r, mass, angle, name, incl, masse_volumique))
    particles.extend(add_asteroid_belt())
    return particles

if __name__ == "__main__":
    particles = init_particles()
    print(json.dumps(particles, indent=2))

import math
import json

# Constants
G = 6.67430e-11  # gravitational constant (m^3 kg^-1 s^-2)
sun_mass = 1.0e11  # arbitrary mass unit, like your code
sun_x = 500.0
sun_y = 500.0

# Planets data: (radius, mass, angle_deg, name)
planets_data = [
    (50.0, 2.0e3,   0.0,   "Mercury"),
    (80.0, 3.0e3,  30.0,   "Venus"),
    (120.0, 4.0e3, 60.0,   "Earth"),
    (160.0, 6.0e3, 120.0,  "Mars"),
    (250.0, 8.0e3, 180.0,  "Jupiter"),
    (350.0, 5.0e3, 240.0,  "Saturn"),
    (420.0, 4.0e3, 300.0,  "Uranus"),
    (460.0, 4.0e3, 330.0,  "Neptune"),
]

def add_planet(r, mass, angle_deg, name):
    angle = math.radians(angle_deg)
    px = sun_x + r * math.cos(angle)
    py = sun_y + r * math.sin(angle)
    # Orbital velocity magnitude for circular orbit
    v = math.sqrt(G * sun_mass / r)
    vx = -v * math.sin(angle)
    vy =  v * math.cos(angle)
    return {
        "name": name,
        "x": px,
        "y": py,
        "z": 500.0,
        "vx": vx,
        "vy": vy,
        "vz": 0.0,
        "mass": mass
    }

def init_particles():
    particles = []
    # Add Sun
    particles.append({
        "name": "Sun",
        "x": sun_x,
        "y": sun_y,
        "z": 500.0,
        "vx": 0.0,
        "vy": 0.0,
        "vz": 0.0,
        "mass": sun_mass
    })
    # Add planets
    for r, mass, angle, name in planets_data:
        particles.append(add_planet(r, mass, angle, name))
    return particles

if __name__ == "__main__":
    particles = init_particles()
    print(json.dumps(particles, indent=2))

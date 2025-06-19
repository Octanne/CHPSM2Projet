import math
import json
import random

# Constants
G = 6.67430e-11  # gravitational constant (m^3 kg^-1 s^-2)
sun_mass = 1.0e11  # arbitrary mass unit, like your code
sun_x = 500.0
sun_y = 500.0

# Planets data: (radius, mass, angle_deg, name, inclination_deg, masseVolumique, colorHex)
# Inclination is in degrees, mass_volumique is in kg/m^3
# Color is a hex string for visualization purposes
# You can add a color field if needed for visualization
planets_data = [
    # (radius, mass, angle_deg, name, inclination_deg, masseVolumique, colorHex)
    (50.0, 2.0e3,   0.0,   "Mercury", 0.0,   5427, "#ffcc00"),
    (80.0, 3.0e3,  30.0,   "Venus", 3.39,    5243, "#ff9900"),
    (120.0, 4.0e3, 60.0,   "Earth", 0.0,     5514, "#3399ff"),
    (160.0, 6.0e3, 120.0,  "Mars", 0.0,      3933, "#ff3300"),
    (250.0, 8.0e3, 180.0,  "Jupiter", 0.0,   1326, "#ff6600"),
    (350.0, 5.0e3, 240.0,  "Saturn", 0.0,    687, "#ff9933"),
    (420.0, 4.0e3, 300.0,  "Uranus", 0.0,    1271, "#66ccff"),
    (460.0, 4.0e3, 330.0,  "Neptune", 0.0,   1638, "#3399cc"),
]

def add_planet(r, mass, angle_deg, name, inclination_deg, mass_volumique=None, color_hex=None):
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
        "masseVolumique": mass_volumique,
        "colorHex": color_hex
    }

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
    for r, mass, angle, name, incl, masse_volumique, color_hex in planets_data:
        particles.append(add_planet(r, mass, angle, name, incl, masse_volumique, color_hex))
    return particles

if __name__ == "__main__":
    particles = init_particles()
    print(json.dumps(particles, indent=2))

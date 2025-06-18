#ifndef PARTICLE_H
#define PARTICLE_H

#include <iostream>
#include <cmath>
#include <deque>

// Structure de vecteur en 3D
struct Vector3D {
    float x, y, z;
    Vector3D() : x(0.f), y(0.f), z(0.f) {}
    Vector3D(float x, float y, float z) : x(x), y(y), z(z) {}

    Vector3D operator+(const Vector3D &other) const { return Vector3D(x + other.x, y + other.y, z + other.z); }
    Vector3D &operator+=(const Vector3D &other) { x += other.x; y += other.y; z += other.z; return *this; }
    Vector3D operator-(const Vector3D &other) const { return Vector3D(x - other.x, y - other.y, z - other.z); }
    Vector3D &operator-=(const Vector3D &other) { x -= other.x; y -= other.y; z -= other.z; return *this; }
    Vector3D operator*(float scalar) const { return Vector3D(x * scalar, y * scalar, z * scalar); }
    Vector3D &operator*=(float scalar) { x *= scalar; y *= scalar; z *= scalar; return *this; }
    Vector3D operator/(float scalar) const { return Vector3D(x / scalar, y / scalar, z / scalar); }
    Vector3D &operator/=(float scalar) { x /= scalar; y /= scalar; z /= scalar; return *this; }
    float norm() const { return std::sqrt(x * x + y * y + z * z); }
};
struct ParticleState {
    Vector3D position;
    Vector3D velocity;
    float time;
};
// Classe représentant une particule en 3D
class Particle {
    Vector3D position;
    Vector3D velocity;
    Vector3D acceleration;
    float mass;
    float masseVolumique;
    int id;
    static int id_counter; // Identifiant unique pour chaque particule
    std::deque<Vector3D> history;
    std::deque<ParticleState> state_history;
    
public:
    Particle();
    Particle(float x, float y, float z, float vx, float vy, float vz, float mass, float masseVolumique = 1.0f);
    ~Particle();

    // Accesseurs
    float x() const;
    float y() const;
    float z() const;
    float getMass() const;
    float getMasseVolumique() const;
    void setMasseVolumique(float v);
    int getId() const;
    Vector3D getPosition() const;
    Vector3D getVelocity() const;
    void saveState(float time);
    bool restoreState(float target_time);

    // Réinitialise l'accélération pour la nouvelle itération
    void resetAcceleration();
    // Ajoute l'accélération calculée
    void addAcceleration(const Vector3D &a);
    // Mise à jour de la vitesse : V_(i+1) = V_i + a_(i+1) × dt
    void updateVelocity(float dt);
    // Mise à jour de la position : P_(i+1) = P_i + V_(i+1) × dt
    void updatePosition(float dt);
    // Gestion des conditions aux bords (rebond) en 3D
    void checkBoundary();

    // Affichage 3D via OpenGL
    void drawGL() const;
};

#endif // PARTICLE_H
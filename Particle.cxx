// Classe représentant une particule en 3D
#include "Particle.hpp"

// Pour OpenGL sur macOS ou autres
#ifdef DISPLAY_VERSION

#ifdef __APPLE__
#include <OpenGL/glu.h>
#else
#include <GL/glu.h>
#endif

#endif

#include "MyRNG.hpp"

Particle::Particle() {
        position = Vector3D(MyRNG::get_coord_x(), MyRNG::get_coord_y(), MyRNG::get_coord_z());
        velocity = Vector3D(MyRNG::get_velocity_component(), MyRNG::get_velocity_component(), MyRNG::get_velocity_component());
        acceleration = Vector3D(0.f, 0.f, 0.f);
        mass = MyRNG::get_mass();
        masseVolumique = 1.0f;
        id = id_counter++;
        history.push_back(position);
}

Particle::Particle(float x, float y, float z, float vx, float vy, float vz, float mass, float masseVolumique, std::string colorHex)
    : position(x, y, z), velocity(vx, vy, vz), acceleration(0.f, 0.f, 0.f), mass(mass), masseVolumique(masseVolumique), id(id_counter++), colorHex(colorHex) {
    history.push_back(position);
}

std::ostream &operator<<(std::ostream &os, const Vector3D &v) {
    os << "(" << v.x << ", " << v.y << ", " << v.z << ")";
    return os;
}

Particle::~Particle() {}

// Accesseurs
float Particle::x() const { return position.x; }
float Particle::y() const { return position.y; }
float Particle::z() const { return position.z; }
float Particle::getMass() const { return mass; }
int Particle::getId() const { return id; }
Vector3D Particle::getPosition() const { return position; }
Vector3D Particle::getVelocity() const { return velocity; }
float Particle::getMasseVolumique() const { return masseVolumique; }
void Particle::setMasseVolumique(float v) { masseVolumique = v; }
std::string Particle::getColorHex() const { return colorHex; }
void Particle::setColorHex(const std::string &color) { colorHex = color; }

// Réinitialise l'accélération pour la nouvelle itération
void Particle::resetAcceleration() { acceleration = Vector3D(0.f, 0.f, 0.f); }
// Ajoute l'accélération calculée
void Particle::addAcceleration(const Vector3D &a) { acceleration += a; }
// Mise à jour de la vitesse : V_(i+1) = V_i + a_(i+1) × dt
void Particle::updateVelocity(float dt) { velocity += acceleration * dt; }
// Mise à jour de la position : P_(i+1) = P_i + V_(i+1) × dt
void Particle::updatePosition(float dt) {
    position += velocity * dt;
    history.push_back(position);
    if (history.size() > 200)
        history.pop_front();
}
// Gestion des conditions aux bords (rebond) en 3D
void Particle::checkBoundary() {
    if (position.x < X_MIN) { position.x = X_MIN; velocity.x = -velocity.x; }
    else if (position.x > X_MAX) { position.x = X_MAX; velocity.x = -velocity.x; }
    if (position.y < Y_MIN) { position.y = Y_MIN; velocity.y = -velocity.y; }
    else if (position.y > Y_MAX) { position.y = Y_MAX; velocity.y = -velocity.y; }
    if (position.z < Z_MIN) { position.z = Z_MIN; velocity.z = -velocity.z; }
    else if (position.z > Z_MAX) { position.z = Z_MAX; velocity.z = -velocity.z; }
}

// Affichage 3D via OpenGL
void Particle::drawGL() const {
    #ifdef DISPLAY_VERSION
    // Tracé de l'historique (ligne brisée en gris)
    glColor3f(0.5f, 0.5f, 0.5f);
    glBegin(GL_LINE_STRIP);
    for (const auto &pos : history) {
        glVertex3f(pos.x, pos.y, pos.z);
    }
    glEnd();
    // Tracé de la position actuelle (point noir)
    glColor3f(0.f, 0.f, 0.f);
    glPointSize(5.0f);
    glBegin(GL_POINTS);
        glVertex3f(position.x, position.y, position.z);
    glEnd();
    #endif
}

void Particle::saveState(float time, float rewind_max_history) {
    state_history.push_back({position, velocity, time});
    // On garde seulement les 5 dernières secondes
    while (rewind_max_history != -1 && !state_history.empty() && (time - state_history.front().time) > rewind_max_history) {
        state_history.pop_front();
    }
}

bool Particle::restoreState(float target_time) {
    if (state_history.empty()) return false;
    // Cherche le dernier état <= target_time
    for (auto it = state_history.rbegin(); it != state_history.rend(); ++it) {
        if (it->time <= target_time) {
            position = it->position;
            velocity = it->velocity;
            return true;
        }
    }
    // Si aucun état trouvé, restaure le plus ancien
    position = state_history.front().position;
    velocity = state_history.front().velocity;
    return false;
}

int Particle::id_counter = 0;
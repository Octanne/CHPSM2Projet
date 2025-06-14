#include "Octree.hpp"

// Pour OpenGL sur macOS ou autres
#ifdef __APPLE__
#include <OpenGL/glu.h>
#else
#include <GL/glu.h>
#endif

#include <cmath>
#include <cstdlib>

// Définition de la variable statique
std::vector<const Octree*> Octree::instances;

const float G = 6.67430e-11f; // Constante gravitationnelle
const float theta = 0.5f;     // Seuil d'approximation Barnes-Hut
const float epsilon = 0.001f; // Facteur d'adoucissement

const float epsilon_sq = epsilon * epsilon;
const float theta_sq = theta * theta;

Octree::Octree(float x, float y, float z, float width, float height, float depth, int capacity)
    : x(x), y(y), z(z), width(width), height(height), depth(depth), capacity(capacity),
        totalMass(0.f), centerOfMass(0.f, 0.f, 0.f) {}

Octree::~Octree() { clear(); }

void Octree::updateAttributes(float newX, float newY, float newZ, float newWidth, float newHeight, float newDepth, int newCapacity)
{
    x = newX;
    y = newY;
    z = newZ;
    width = newWidth;
    height = newHeight;
    depth = newDepth;
    capacity = newCapacity;

    // Réinitialisation des attributs de masse et centre de masse
    totalMass = 0.f;
    centerOfMass.x = 0.f;
    centerOfMass.y = 0.f;
    centerOfMass.z = 0.f;
}

// Vérifie si la particule se trouve dans le volume de l'octree
bool Octree::contains(const Particle *p) const {
    return (p->x() >= x && p->x() < x + width &&
            p->y() >= y && p->y() < y + height &&
            p->z() >= z && p->z() < z + depth);
}

// Découpe le volume en 8 sous-volumes (octants)
void Octree::subdivide() {
    float hw = width * 0.5f;
    float hh = height * 0.5f;
    float hd = depth * 0.5f;
    children[0] = new Octree(x, y, z, hw, hh, hd, capacity);
    children[1] = new Octree(x + hw, y, z, hw, hh, hd, capacity);
    children[2] = new Octree(x, y + hh, z, hw, hh, hd, capacity);
    children[3] = new Octree(x + hw, y + hh, z, hw, hh, hd, capacity);
    children[4] = new Octree(x, y, z + hd, hw, hh, hd, capacity);
    children[5] = new Octree(x + hw, y, z + hd, hw, hh, hd, capacity);
    children[6] = new Octree(x, y + hh, z + hd, hw, hh, hd, capacity);
    children[7] = new Octree(x + hw, y + hh, z + hd, hw, hh, hd, capacity);
}

// Insertion d'une particule dans l'octree
void Octree::insert(const Particle* p) {
    if (!contains(p))
        return;

    // Mise à jour du centre de masse
    Vector3D pPos = p->getPosition();
    float pMass = p->getMass();
    float newTotalMass = totalMass + pMass;
    centerOfMass = (centerOfMass * totalMass + pPos * pMass) / newTotalMass;
    totalMass = newTotalMass;

    if (children[0] == nullptr && particles.size() < static_cast<unsigned>(capacity)) {
        particles.push_back(p);
    } else {
        if (children[0] == nullptr) {
            subdivide();
            // Réinsertion des particules existantes dans les sous-volumes
            for (auto existing : particles) {
                int octant = getOctant(existing);
                if (octant != -1) {
                    children[octant]->insert(existing);
                }
            }
            particles.clear();
        }
        int octant = getOctant(p);
        if (octant != -1) {
            children[octant]->insert(p);
        }
    }
}

// Détermine dans quel octant se trouve une particule
int Octree::getOctant(const Particle* p) const {
    float midX = x + width * 0.5f;
    float midY = y + height * 0.5f;
    float midZ = z + depth * 0.5f;
    int oct = 0;
    if (p->x() >= midX) oct |= 1;
    if (p->y() >= midY) oct |= 2;
    if (p->z() >= midZ) oct |= 4;
    return oct;
}

// Calcule l'accélération sur une particule avec l'approximation Barnes-Hut
Vector3D Octree::computeAcceleration(const Particle &p) const {
    Vector3D acc(0.f, 0.f, 0.f);
    Vector3D pPos = p.getPosition();
    std::vector<const Octree*> stack;
    stack.reserve(64);
    stack.push_back(this);

    for (size_t i = 0; i < stack.size(); i++) {
        const Octree* node = stack[i];
        if (node->totalMass == 0.f)
            continue;

        float dx = node->centerOfMass.x - pPos.x;
        float dy = node->centerOfMass.y - pPos.y;
        float dz = node->centerOfMass.z - pPos.z;
        float dist_sq = dx * dx + dy * dy + dz * dz;
        float dist_sq_eps = dist_sq + epsilon_sq;

        if (node->children[0] != nullptr) { // Nœud interne
            float size = std::max(node->width, std::max(node->height, node->depth));
            if ((size * size) < (theta_sq * dist_sq_eps)) {
                float sqrt_dist = std::sqrt(dist_sq_eps);
                float invDistCube = G * node->totalMass / (dist_sq_eps * sqrt_dist);
                acc.x += dx * invDistCube;
                acc.y += dy * invDistCube;
                acc.z += dz * invDistCube;
            } else {
                for (int j = 0; j < 8; j++) {
                    if (node->children[j] != nullptr)
                        stack.push_back(node->children[j]);
                }
            }
        } else { // Nœud feuille
            if (node->particles.size() == 1 && node->particles[0] == &p)
                continue;
            float sqrt_dist = std::sqrt(dist_sq_eps);
            float invDistCube = G * node->totalMass / (dist_sq_eps * sqrt_dist);
            acc.x += dx * invDistCube;
            acc.y += dy * invDistCube;
            acc.z += dz * invDistCube;
        }
    }
    return acc;
}

// Libère la mémoire et réinitialise l'octree
void Octree::clear() {
    particles.clear();
    for (int i = 0; i < 8; i++) {
        if (children[i] != nullptr) {
            children[i]->clear();
            delete children[i];
            children[i] = nullptr;
        }
    }
    totalMass = 0.f;
    centerOfMass = Vector3D(0.f, 0.f, 0.f);
}

// We override the new operator to manage instances of Octree
void* Octree::operator new(std::size_t size) {
    if (!instances.empty()) {
        const Octree* instance = instances.back();
        instances.pop_back();
        return (void*)instance;
    }
    return ::operator new(size);
}

void Octree::operator delete(void* ptr) {
    instances.push_back(static_cast<const Octree*>(ptr));
}

// We to a static method to clear all instances for real deallocation
void Octree::clearInstances() {
    for (const Octree* instance : instances) {
        ::operator delete(const_cast<Octree*>(instance));
    }
    instances.clear();
}

// Affichage 3D de l'octree via OpenGL (affiche le volume sous forme de cube fil de fer)
void Octree::drawGL() const {
    glColor3f(0.f, 0.f, 1.f);
    float x0 = x, y0 = y, z0 = z;
    float x1 = x + width, y1 = y + height, z1 = z + depth;
    glBegin(GL_LINES);
        // Face inférieure
        glVertex3f(x0, y0, z0); glVertex3f(x1, y0, z0);
        glVertex3f(x1, y0, z0); glVertex3f(x1, y1, z0);
        glVertex3f(x1, y1, z0); glVertex3f(x0, y1, z0);
        glVertex3f(x0, y1, z0); glVertex3f(x0, y0, z0);
        // Face supérieure
        glVertex3f(x0, y0, z1); glVertex3f(x1, y0, z1);
        glVertex3f(x1, y0, z1); glVertex3f(x1, y1, z1);
        glVertex3f(x1, y1, z1); glVertex3f(x0, y1, z1);
        glVertex3f(x0, y1, z1); glVertex3f(x0, y0, z1);
        // Arêtes verticales
        glVertex3f(x0, y0, z0); glVertex3f(x0, y0, z1);
        glVertex3f(x1, y0, z0); glVertex3f(x1, y0, z1);
        glVertex3f(x1, y1, z0); glVertex3f(x1, y1, z1);
        glVertex3f(x0, y1, z0); glVertex3f(x0, y1, z1);
    glEnd();
    // Affichage récursif des sous-volumes
    if (children[0] != nullptr) {
        for (int i = 0; i < 8; i++) {
            if (children[i] != nullptr)
                children[i]->drawGL();
        }
    }
}
#ifndef OCTREE_H
#define OCTREE_H

#include <vector>

#include "Particle.hpp"

// Classe Octree pour Barnes-Hut en 3D
class Octree {
    float x, y, z, width, height, depth;
    int capacity;
    std::vector<const Particle*> particles; // Pointeurs vers des particules
    Octree* children[8] = {nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr};

    float totalMass;       // Masse totale dans ce volume
    Vector3D centerOfMass; // Centre de masse du volume
public:
    Octree(float x, float y, float z, float width, float height, float depth, int capacity);
    ~Octree();

    // Vérifie si la particule se trouve dans le volume de l'octree
    bool contains(const Particle *p) const;
    // Découpe le volume en 8 sous-volumes (octants)
    void subdivide();
    // Insertion d'une particule dans l'octree
    void insert(const Particle* p);
    // Détermine dans quel octant se trouve une particule
    int getOctant(const Particle* p) const;
    // Calcule l'accélération sur une particule avec l'approximation Barnes-Hut
    Vector3D computeAcceleration(const Particle &p) const;
    // Libère la mémoire et réinitialise l'octree
    void clear();
    // Affichage 3D de l'octree via OpenGL (affiche le volume sous forme de cube fil de fer)
    void drawGL() const;
};

#endif // OCTREE_H
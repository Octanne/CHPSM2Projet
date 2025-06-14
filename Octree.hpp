#ifndef OCTREE_H
#define OCTREE_H

#include <vector>

#include "Particle.hpp"

// Classe Octree pour Barnes-Hut en 3D
class Octree {
private:
    float x, y, z, width, height, depth;
    int capacity;
    std::vector<const Particle*> particles; // Pointeurs vers des particules
    Octree* children[8] = {nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr};

    float totalMass;       // Masse totale dans ce volume
    Vector3D centerOfMass; // Centre de masse du volume

    static std::vector<const Octree*> instances; // Pile pour la gestion des instances de l'octree
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
    // We update the attributes of the octree
    void updateAttributes(float newX, float newY, float newZ, float newWidth, float newHeight, float newDepth, int newCapacity);
    // We override the new operator to manage instances of Octree
    void* operator new(std::size_t size);
    // We override the delete operator to manage instances of Octree
    void operator delete(void* ptr);
    // We to a static method to clear all instances for real deallocation
    static void clearInstances();
};

#endif // OCTREE_H
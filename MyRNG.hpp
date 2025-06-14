#ifndef MYRNG_HPP
#define MYRNG_HPP

// Génération de nombres aléatoires avec Boost
#include <boost/random.hpp>
#include <boost/random/random_device.hpp>
#include <ctime>

// Définition des constantes de la boîte de simulation en 3D
extern float X_MIN;
extern float X_MAX;
extern float Y_MIN;
extern float Y_MAX;
extern float Z_MIN;
extern float Z_MAX;

constexpr float vitesseMin = 0.01f; // Vitesse minimale initiale
constexpr float vitesseMax = 5.0f;  // Vitesse maximale initiale
constexpr float massMin = 1.0f;     // Masse minimale
constexpr float massMax = 10000.0f; // Masse maximale

namespace MyRNG {
    float get_coord_x();
    float get_coord_y();
    float get_coord_z();
    float get_velocity_component();
    float get_mass();
    void updateMaxMin(float X_MIN, float X_MAX, float Y_MIN, float Y_MAX, float Z_MIN, float Z_MAX);
}

#endif // MYRNG_HPP

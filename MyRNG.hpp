#ifndef MYRNG_HPP
#define MYRNG_HPP

// Génération de nombres aléatoires avec Boost
#include <boost/random.hpp>
#include <boost/random/random_device.hpp>
#include <ctime>

// Définition des constantes de la boîte de simulation en 3D
constexpr float X_MIN = 0.0f;
constexpr float X_MAX = 1000.0f;
constexpr float Y_MIN = 0.0f;
constexpr float Y_MAX = 1000.0f;
constexpr float Z_MIN = 0.0f;
constexpr float Z_MAX = 1000.0f;

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
}

#endif // MYRNG_HPP

#include "MyRNG.hpp"

// Génération de nombres aléatoires avec Boost
namespace MyRNG {
#if BOOST_VERSION >= 104700
    boost::random::random_device rd;
    boost::random::mt19937 gen(rd());
#else
    boost::random::mt19937 gen(static_cast<unsigned>(std::time(0)));
#endif
    boost::random::uniform_real_distribution<float> uniformPosX(X_MIN, X_MAX);
    boost::random::uniform_real_distribution<float> uniformPosY(Y_MIN, Y_MAX);
    boost::random::uniform_real_distribution<float> uniformPosZ(Z_MIN, Z_MAX);
    boost::random::uniform_real_distribution<float> uniformVel(vitesseMin, vitesseMax);
    boost::random::uniform_real_distribution<float> uniformMass(massMin, massMax);

    float get_coord_x() { return uniformPosX(gen); }
    float get_coord_y() { return uniformPosY(gen); }
    float get_coord_z() { return uniformPosZ(gen); }
    float get_velocity_component() { return uniformVel(gen); }
    float get_mass() { return uniformMass(gen); }
}
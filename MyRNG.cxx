#include "MyRNG.hpp"

float X_MIN = 0.0f;
float X_MAX = 1000.0f;
float Y_MIN = 0.0f;
float Y_MAX = 1000.0f;
float Z_MIN = 0.0f;
float Z_MAX = 1000.0f;

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
    void updateMaxMin(float X_MIN, float X_MAX, float Y_MIN, float Y_MAX, float Z_MIN, float Z_MAX)
    {
        // Met à jour les valeurs minimales et maximales
        ::X_MIN = X_MIN;
        ::X_MAX = X_MAX;
        ::Y_MIN = Y_MIN;
        ::Y_MAX = Y_MAX;
        ::Z_MIN = Z_MIN;
        ::Z_MAX = Z_MAX;
        // Met à jour les distributions avec les nouvelles valeurs
        uniformPosX = boost::random::uniform_real_distribution<float>(X_MIN, X_MAX);
        uniformPosY = boost::random::uniform_real_distribution<float>(Y_MIN, Y_MAX);
        uniformPosZ = boost::random::uniform_real_distribution<float>(Z_MIN, Z_MAX);
    }
}
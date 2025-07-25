#ifndef APIREST_HPP
#define APIREST_HPP

#include <vector>
#include <mutex>
#include <thread>
#include <atomic>
#include "Particle.hpp"
#include "Octree.hpp"

#include "httplib.h"

struct SimulationSettings {
    float t_total;
    float dt;
    int nb_particles;
    float current_time;
    float rewind_max_history; // Durée maximale de l'historique de position des particules
    bool closed;
    float MAX_Y, MAX_X, MAX_Z;
    float MIN_Y, MIN_X, MIN_Z;
    float history_resolution;
};

class APIRest {
public:
    APIRest(Octree& tree, std::vector<Particle>& particles, SimulationSettings& settings, std::atomic<bool>& paused, std::mutex& mtx);
    void start(int port = 8080);
    void stop();

private:
    std::thread server_thread;
    std::atomic<bool> running;
    httplib::Server server;
    std::vector<Particle>& particles;
    SimulationSettings& settings;
    std::atomic<bool>& paused;
    std::mutex& mtx;
    Octree& tree;
};

#endif // APIREST_HPP
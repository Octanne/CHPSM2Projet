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
};

class APIRest {
public:
    APIRest(std::vector<Particle>& particles, SimulationSettings& settings, std::atomic<bool>& paused, std::mutex& mtx);
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
};

#endif // APIREST_HPP
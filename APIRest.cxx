#include "APIRest.hpp"

#include "nlohmann/json.hpp" // Ajoutez du header JSON (https://github.com/nlohmann/json)

using json = nlohmann::json;

APIRest::APIRest(std::vector<Particle>& particles, SimulationSettings& settings, std::atomic<bool>& paused, std::mutex& mtx)
    : particles(particles), settings(settings), paused(paused), mtx(mtx), running(false) {}

void APIRest::start(int port) {
    running = true;
    server_thread = std::thread([this, port]() {
        // GET /particles
        server.Get("/particles", [this](const httplib::Request&, httplib::Response& res) {
            std::lock_guard<std::mutex> lock(mtx);
            json j = json::array();
            for (const auto& p : particles) {
                j.push_back({
                    {"id", p.getId()},
                    {"x", p.x()},
                    {"y", p.y()},
                    {"z", p.z()},
                    {"vx", p.getVelocity().x},
                    {"vy", p.getVelocity().y},
                    {"vz", p.getVelocity().z},
                    {"mass", p.getMass()}
                });
            }
            res.set_content(j.dump(), "application/json");
        });

        // POST /particles
        server.Post("/particles", [this](const httplib::Request& req, httplib::Response& res) {
            std::lock_guard<std::mutex> lock(mtx);
            try {
                auto j = json::parse(req.body);
                particles.clear();
                for (const auto& jp : j) {
                    particles.emplace_back(
                        jp.value("x", 0.f), jp.value("y", 0.f), jp.value("z", 0.f),
                        jp.value("vx", 0.f), jp.value("vy", 0.f), jp.value("vz", 0.f),
                        jp.value("mass", 1.f)
                    );
                }
                res.status = 200;
            } catch (...) {
                res.status = 400;
            }
        });

        // GET /settings
        server.Get("/settings", [this](const httplib::Request&, httplib::Response& res) {
            std::lock_guard<std::mutex> lock(mtx);
            json j = {
                {"t_total", settings.t_total},
                {"dt", settings.dt},
                {"nb_particles", settings.nb_particles},
                {"paused", paused.load()}
            };
            res.set_content(j.dump(), "application/json");
        });

        // POST /settings
        server.Post("/settings", [this](const httplib::Request& req, httplib::Response& res) {
            std::lock_guard<std::mutex> lock(mtx);
            try {
                auto j = json::parse(req.body);
                if (j.contains("t_total")) settings.t_total = j["t_total"];
                if (j.contains("dt")) settings.dt = j["dt"];
                if (j.contains("nb_particles")) settings.nb_particles = j["nb_particles"];
                res.status = 200;
            } catch (...) {
                res.status = 400;
            }
        });

        // POST /pause
        server.Post("/pause", [this](const httplib::Request&, httplib::Response& res) {
            paused = true;
            res.status = 200;
        });

        // POST /resume
        server.Post("/resume", [this](const httplib::Request&, httplib::Response& res) {
            paused = false;
            res.status = 200;
        });

        server.listen("0.0.0.0", port);
    });
}

void APIRest::stop() {
    running = false;
    server.stop();
    if (server_thread.joinable())
        server_thread.join();
}

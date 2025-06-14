#include "APIRest.hpp"

#include "nlohmann/json.hpp" // Ajoutez du header JSON (https://github.com/nlohmann/json)

using json = nlohmann::json;

APIRest::APIRest(Octree& tree, std::vector<Particle>& particles, SimulationSettings& settings, std::atomic<bool>& paused, std::mutex& mtx)
    : tree(tree), particles(particles), settings(settings), paused(paused), mtx(mtx), running(false) {}

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
                printf("Received particles data: %s\n", j.dump().c_str());
                particles.clear();
                float min_x = std::numeric_limits<float>::max();
                float min_y = std::numeric_limits<float>::max();
                float min_z = std::numeric_limits<float>::max();
                float max_x = std::numeric_limits<float>::lowest();
                float max_y = std::numeric_limits<float>::lowest();
                float max_z = std::numeric_limits<float>::lowest();

                for (const auto& jp : j) {
                    float x = jp.value("x", 0.f);
                    float y = jp.value("y", 0.f);
                    float z = jp.value("z", 0.f);
                    particles.emplace_back(
                        x, y, z,
                        jp.value("vx", 0.f), jp.value("vy", 0.f), jp.value("vz", 0.f),
                        jp.value("mass", 1.f)
                    );
                    min_x = std::min(min_x, x);
                    min_y = std::min(min_y, y);
                    min_z = std::min(min_z, z);
                    max_x = std::max(max_x, x);
                    max_y = std::max(max_y, y);
                    max_z = std::max(max_z, z);
                }
                tree.clear(); // Clear the octree to reset it
                tree.updateAttributes(
                    min_x, min_y, min_z,
                    max_x - min_x, max_y - min_y, max_z - min_z,
                    1 // Capacity of the octree
                );
                settings.nb_particles = particles.size();
                settings.MIN_X = static_cast<int>(min_x);
                settings.MIN_Y = static_cast<int>(min_y);
                settings.MIN_Z = static_cast<int>(min_z);
                settings.MAX_X = static_cast<int>(max_x);
                settings.MAX_Y = static_cast<int>(max_y);
                settings.MAX_Z = static_cast<int>(max_z);
                settings.current_time = 0.f; // Reset current time
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
                {"paused", paused.load()},
                {"current_time", settings.current_time},
                {"closed", settings.closed},
                {"MAX_Y", settings.MAX_Y},
                {"MAX_X", settings.MAX_X},
                {"MAX_Z", settings.MAX_Z},
                {"MIN_Y", settings.MIN_Y},
                {"MIN_X", settings.MIN_X},
                {"MIN_Z", settings.MIN_Z}
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
                if (j.contains("nb_particles")) {
                    settings.nb_particles = j["nb_particles"];
                    particles.reserve(settings.nb_particles);
                    particles.clear();
                    for (int i = 0; i < settings.nb_particles; i++) {
                        particles.push_back(Particle());
                    }
                    // Optionnel : ajouter une particule massive au centre pour influencer les autres
                    particles.push_back(Particle(500.0f, 500.0f, 500.0f, 0.0f, 0.0f, 0.0f, 1e13));
                }
                if (j.contains("current_time")) settings.current_time = j["current_time"];
                if (j.contains("MAX_Y")) settings.MAX_Y = j["MAX_Y"];
                if (j.contains("MAX_X")) settings.MAX_X = j["MAX_X"];
                if (j.contains("MAX_Z")) settings.MAX_Z = j["MAX_Z"];
                if (j.contains("MIN_Y")) settings.MIN_Y = j["MIN_Y"];
                if (j.contains("MIN_X")) settings.MIN_X = j["MIN_X"];
                if (j.contains("MIN_Z")) settings.MIN_Z = j["MIN_Z"];
                tree.clear(); // Clear the octree to reset it
                // Mettre à jour l'octree avec les nouvelles dimensions
                tree.updateAttributes(
                    static_cast<float>(settings.MIN_X), static_cast<float>(settings.MIN_Y), static_cast<float>(settings.MIN_Z),
                    static_cast<float>(settings.MAX_X - settings.MIN_X), static_cast<float>(settings.MAX_Y - settings.MIN_Y), static_cast<float>(settings.MAX_Z - settings.MIN_Z),
                    1 // Capacity of the octree
                );
                res.status = 200;
            } catch (...) {
                res.status = 400;
            }
        });

        // POST /stop
        server.Post("/stop", [this](const httplib::Request&, httplib::Response& res) {
            settings.closed = true;
            res.status = 200;
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

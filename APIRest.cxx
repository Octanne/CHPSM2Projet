#include "APIRest.hpp"

#include "nlohmann/json.hpp" // Ajoutez du header JSON (https://github.com/nlohmann/json)
#include "MyRNG.hpp" // Pour la génération de nombres aléatoires

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
                float min_abs = std::numeric_limits<float>::max();
                float max_abs = std::numeric_limits<float>::lowest();

                for (const auto& jp : j) {
                    float x = jp.value("x", 0.f);
                    float y = jp.value("y", 0.f);
                    float z = jp.value("z", 0.f);
                    particles.emplace_back(
                        x, y, z,
                        jp.value("vx", 0.f), jp.value("vy", 0.f), jp.value("vz", 0.f),
                        jp.value("mass", 1.f)
                    );
                    // Mise à jour des valeurs minimales et maximales 
                    // min_abs est la valeur la plus basse parmi les x, y, z (en tenant compte des négatifs)
                    // max_abs est la valeur la plus haute parmi les x, y, z
                    min_abs = std::min({min_abs, x, y, z});
                    max_abs = std::max({max_abs, x, y, z});
                }
                tree.clear(); // Clear the octree to reset it
                tree.updateAttributes(
                    min_abs, min_abs, min_abs,
                    max_abs - min_abs, max_abs - min_abs, max_abs - min_abs,
                    1 // Capacity of the octree
                );
                // We add margin to the octree to avoid particles being too close to the edges (10% margin)
                min_abs -= 0.1f * (max_abs - min_abs);
                max_abs += 0.1f * (max_abs - min_abs);
                // Update simulation settings
                settings.nb_particles = particles.size();
                settings.MAX_Y = static_cast<int>(max_abs);
                settings.MAX_X = static_cast<int>(max_abs);
                settings.MAX_Z = static_cast<int>(max_abs);
                settings.MIN_Y = static_cast<int>(min_abs);
                settings.MIN_X = static_cast<int>(min_abs);
                settings.MIN_Z = static_cast<int>(min_abs);
                // Reset simulation settings
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
                if (j.contains("current_time")) settings.current_time = j["current_time"];
                bool update_bornes = false;
                if (j.contains("MAX_Y")) { settings.MAX_Y = j["MAX_Y"]; update_bornes = true; }
                if (j.contains("MAX_X")) { settings.MAX_X = j["MAX_X"]; update_bornes = true; }
                if (j.contains("MAX_Z")) { settings.MAX_Z = j["MAX_Z"]; update_bornes = true; }
                if (j.contains("MIN_Y")) { settings.MIN_Y = j["MIN_Y"]; update_bornes = true; }
                if (j.contains("MIN_X")) { settings.MIN_X = j["MIN_X"]; update_bornes = true; }
                if (j.contains("MIN_Z")) { settings.MIN_Z = j["MIN_Z"]; update_bornes = true; }
                if (update_bornes) {
                    MyRNG::updateMaxMin(
                        static_cast<float>(settings.MIN_X), static_cast<float>(settings.MAX_X),
                        static_cast<float>(settings.MIN_Y), static_cast<float>(settings.MAX_Y),
                        static_cast<float>(settings.MIN_Z), static_cast<float>(settings.MAX_Z)
                    );
                }
                if (j.contains("nb_particles")) {
                    settings.nb_particles = j["nb_particles"];
                    particles.reserve(settings.nb_particles);
                    particles.clear();
                    for (int i = 0; i < settings.nb_particles; i++) {
                        particles.push_back(Particle());
                    }
                    // Optionnel : ajouter une particule massive au centre pour influencer les autres
                    float center_x = (settings.MIN_X + settings.MAX_X) / 2.0f;
                    float center_y = (settings.MIN_Y + settings.MAX_Y) / 2.0f;
                    float center_z = (settings.MIN_Z + settings.MAX_Z) / 2.0f;
                    particles.push_back(Particle(center_x, center_y, center_z, 0.0f, 0.0f, 0.0f, 1e13));
                }
                tree.clear(); // Clear the octree to reset it
                // Mettre à jour les bornes de l'octree
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

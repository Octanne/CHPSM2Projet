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
                // On construit l'historique de positions
                json history = json::array();
                for (const auto& st : p.getStateHistory()) {
                    history.push_back({
                        {"x", st.position.x},
                        {"y", st.position.y},
                        {"z", st.position.z}
                    });
                }
                j.push_back({
                    {"id", p.getId()},
                    {"x", p.x()},
                    {"y", p.y()},
                    {"z", p.z()},
                    {"vx", p.getVelocity().x},
                    {"vy", p.getVelocity().y},
                    {"vz", p.getVelocity().z},
                    {"mass", p.getMass()},
                    {"masseVolumique", p.getMasseVolumique()},
                    {"colorHex", p.getColorHex()},
                    {"history", history} // Ajout de l'historique ici !
                });
            }
            res.set_content(j.dump(), "application/json");
        });

        server.Post("/rewind", [this](const httplib::Request& req, httplib::Response& res) {
            std::lock_guard<std::mutex> lock(mtx);
            auto j = json::parse(req.body);
            float rewind_delta = j.value("rewind_time", 5.0f);
            float rewind_time = std::max(0.f, settings.current_time - rewind_delta);
            for (auto& p : particles) {
                p.restoreState(rewind_time);
            }
            settings.current_time = rewind_time;
            res.status = 200;
        });

        server.Post("/reset", [this](const httplib::Request&, httplib::Response& res) {
            std::lock_guard<std::mutex> lock(mtx);

            // Réinitialiser toutes les particules
            for (auto& p : particles) {
                p = Particle(); // Remet la particule à un état neuf, random (si tu veux les remettre à des positions identiques à l'initialisation)
            }
            // Reset settings de temps
            settings.current_time = 0.f;
            // Effacer l'octree
            tree.clear();
            // Re-créer l'octree avec les bornes initiales
            tree.updateAttributes(
                settings.MIN_X, settings.MIN_Y, settings.MIN_Z,
                std::abs(settings.MAX_X - settings.MIN_X), 
                std::abs(settings.MAX_Y - settings.MIN_Y), 
                std::abs(settings.MAX_Z - settings.MIN_Z),
                1
            );

            paused = true; // Peut-être utile de mettre la simu en pause après reset

            res.status = 200;
        });

        // POST /particles
        server.Post("/particles", [this](const httplib::Request& req, httplib::Response& res) {
            std::lock_guard<std::mutex> lock(mtx);
            try {
                auto j = json::parse(req.body);
                printf("Received particles data: %s\n", j.dump().c_str());

                particles.clear();
                particles.reserve(j.size());

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
                    float mass = jp.value("mass", 1.f);
                    float masseVol = jp.value("masseVolumique", 1.f);
                    std::string colorHex = jp.value("colorHex", "");
                    particles.emplace_back(x, y, z, jp.value("vx", 0.f), jp.value("vy", 0.f), jp.value("vz", 0.f), mass, masseVol, colorHex);
                    min_x = std::min(min_x, x);
                    min_y = std::min(min_y, y);
                    min_z = std::min(min_z, z);
                    max_x = std::max(max_x, x);
                    max_y = std::max(max_y, y);
                    max_z = std::max(max_z, z);
                }

                // Calculate bounding cube
                float extent_x = max_x - min_x;
                float extent_y = max_y - min_y;
                float extent_z = max_z - min_z;
                float max_extent = std::max({extent_x, extent_y, extent_z});
                float margin = 0.025f * max_extent;
                float cube_size = max_extent + 2.f * margin;

                float center_x = (min_x + max_x) / 2.f;
                float center_y = (min_y + max_y) / 2.f;
                float center_z = (min_z + max_z) / 2.f;

                float origin_x = center_x - cube_size / 2.f;
                float origin_y = center_y - cube_size / 2.f;
                float origin_z = center_z - cube_size / 2.f;

                // Update octree with cubic box
                tree.clear();
                tree.updateAttributes(
                    origin_x, origin_y, origin_z,
                    cube_size, cube_size, cube_size,
                    1 // Capacity of the octree
                );

                // Update simulation settings
                settings.nb_particles = particles.size();
                float min_all = std::min({origin_x, origin_y, origin_z});
                float max_all = std::max({origin_x + cube_size, origin_y + cube_size, origin_z + cube_size});
                // Round down min_all and round up max_all to the nearest integer
                settings.MIN_X = settings.MIN_Y = settings.MIN_Z = std::floor(min_all);
                settings.MAX_X = settings.MAX_Y = settings.MAX_Z = std::ceil(max_all);
                settings.current_time = 0.f;
                // We update Max Min 
                MyRNG::updateMaxMin(
                        settings.MIN_X, settings.MAX_X, settings.MIN_Y, 
                        settings.MAX_Y, settings.MIN_Z, settings.MAX_Z
                );
                paused = true;
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
                {"rewind_max_history", settings.rewind_max_history},
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
                if (j.contains("rewind_max_history")) settings.rewind_max_history = j["rewind_max_history"];
                bool update_bornes = false;
                if (j.contains("MAX_Y")) { settings.MAX_Y = j["MAX_Y"]; update_bornes = true; }
                if (j.contains("MAX_X")) { settings.MAX_X = j["MAX_X"]; update_bornes = true; }
                if (j.contains("MAX_Z")) { settings.MAX_Z = j["MAX_Z"]; update_bornes = true; }
                if (j.contains("MIN_Y")) { settings.MIN_Y = j["MIN_Y"]; update_bornes = true; }
                if (j.contains("MIN_X")) { settings.MIN_X = j["MIN_X"]; update_bornes = true; }
                if (j.contains("MIN_Z")) { settings.MIN_Z = j["MIN_Z"]; update_bornes = true; }
                if (update_bornes) {
                    MyRNG::updateMaxMin(
                        settings.MIN_X, settings.MAX_X, settings.MIN_Y, 
                        settings.MAX_Y, settings.MIN_Z, settings.MAX_Z
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
                    particles.emplace_back(center_x, center_y, center_z, 0.0f, 0.0f, 0.0f, 1e13);
                }
                tree.clear(); // Clear the octree to reset it
                // Mettre à jour les bornes de l'octree
                tree.updateAttributes(
                    settings.MIN_X, settings.MIN_Y, settings.MIN_Z,
                    std::abs(settings.MAX_X - settings.MIN_X), 
                    std::abs(settings.MAX_Y - settings.MIN_Y), 
                    std::abs(settings.MAX_Z - settings.MIN_Z),
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

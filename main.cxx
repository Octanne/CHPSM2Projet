#include <iostream>
#include <iomanip>
#include <cmath>
#include <cstdlib>
#include <vector>
#include <stack>
#include <deque>
#include <mutex>
#include <atomic>

#include <omp.h>

// SFML et OpenGL
#ifdef DISPLAY_VERSION

#include <SFML/Window.hpp>
#include <SFML/OpenGL.hpp>

// Pour OpenGL sur macOS ou autres
#ifdef __APPLE__
#include <OpenGL/glu.h>
#else
#include <GL/glu.h>
#endif

#endif

// Inclusion de la structure Vector3D et Particle
#include "Particle.hpp"
#include "Octree.hpp"
#include "APIRest.hpp"

#include <boost/program_options.hpp>
#include <boost/chrono.hpp>
#include "MyRNG.hpp"

// Mise à jour de l'état d'une particule en utilisant l'octree
void updateParticleState(Particle &p, const Octree &tree, float dt) {
    p.resetAcceleration();
    p.addAcceleration(tree.computeAcceleration(p));
    p.updateVelocity(dt);
    p.updatePosition(dt);
    p.checkBoundary();
}

// Initialisation aléatoire des particules en 3D
std::vector<Particle> initParticles(int N) {
    std::vector<Particle> particles;
    particles.reserve(N);
    for (int i = 0; i < N; i++) {
        particles.push_back(Particle());
    }
    // Optionnel : ajouter une particule massive au centre pour influencer les autres
    particles.push_back(Particle(500.0f, 500.0f, 500.0f, 0.0f, 0.0f, 0.0f, 1e13));
    return particles;
}

int main(int argc, char *argv[]) {
    namespace po = boost::program_options;
    int N;
    bool display;
    bool drawOctreeBorders;
    float simulMaxTime;
    int portAPI;
    bool pausedD;
    po::options_description desc("Options autorisées");
    desc.add_options()
        ("help,h", "affiche ce message d'aide")
        ("port-api", po::value<int>(&portAPI)->default_value(8080), "port du serveur API REST")
        ("particles", po::value<int>(&N)->required(), "nombre de particules")
        ("pausedAtStart", po::value<bool>(&pausedD)->default_value(false), "simulation en pause au démarrage (true/false)")
        ("simulTime", po::value<float>(&simulMaxTime)->default_value(50.0f), "durée de la simulation en secondes (-1 pour infini)")
        ("display", po::value<bool>(&display)->default_value(false), "fenètre d'affichage SFML (true/false)")
        ("drawOctreeBorders", po::value<bool>(&drawOctreeBorders)->default_value(true), "afficher les bords de l'octree (true/false)");
    po::positional_options_description p;
    p.add("particles", 1).add("display", 1).add("drawOctreeBorders", 1);
    po::variables_map vm;
    try {
        po::store(po::command_line_parser(argc, argv).options(desc).positional(p).run(), vm);
        if (vm.count("help")) {
            std::cout << desc << "\n";
            return 0;
        }
        po::notify(vm);
    }
    catch (const po::error &ex) {
        std::cerr << ex.what() << "\n";
        return 1;
    }

    // Initialisation des particules
    std::vector<Particle> particles = initParticles(N);

    // Paramètres de simulation partagés
    SimulationSettings settings{simulMaxTime, 0.5, N, 0.f, false, Y_MAX, X_MAX, Z_MAX, Y_MIN, X_MIN, Z_MIN};
    std::mutex mtx;
    std::atomic<bool> paused(pausedD);
    std::atomic<bool> closed(false);

    // Initialisation de l'octree
    Octree tree(X_MIN, Y_MIN, Z_MIN, X_MAX - X_MIN, Y_MAX - Y_MIN, Z_MAX - Z_MIN, 1);

    // Lancer le serveur REST
    APIRest api(tree, particles, settings, paused, mtx);
    api.start(portAPI);

    if (!display) {
        printf("Simulation en mode headless pour %d secondes avec %d particules...\n", static_cast<int>(settings.t_total), N);
        while ((settings.current_time < settings.t_total || settings.t_total == -1) && !settings.closed) {
            if (!paused) {
                tree.clear();
                for (const auto &p : particles) {
                    tree.insert(&p);
                }
                #pragma omp parallel for 
                for (auto &p : particles) {
                    updateParticleState(p, tree, settings.dt);
                }
                settings.current_time += settings.dt;
            }

            while (!settings.closed && settings.current_time >= settings.t_total && settings.t_total != -1) {
                std::this_thread::sleep_for(std::chrono::milliseconds(500));
            }
        }
    }

    #ifdef DISPLAY_VERSION

    else {
        // Création d'une fenêtre SFML avec contexte OpenGL
        sf::Window window(sf::VideoMode(1000, 1000), "Simulation Particules 3D et Octree", sf::Style::Close, sf::ContextSettings(24));
        window.setVerticalSyncEnabled(true);

        // Configuration initiale d'OpenGL
        glEnable(GL_DEPTH_TEST);
        glDepthMask(GL_TRUE);
        glClearDepth(1.f);
        glClearColor(1.f, 1.f, 1.f, 1.f);

        // Paramètres de la caméra modifiables
        float camX = 1500.f, camY = 1500.f, camZ = 1500.f;
        float targetX = 500.f, targetY = 500.f, targetZ = 500.f;
        float fov = 60.f; // Champ de vision (zoom)

        float simulationTime = 0.f;
        for (const auto &p : particles) {
            tree.insert(&p);
        }

        // Boucle principale
        while (window.isOpen()) {
            sf::Event event;
            while (window.pollEvent(event)) {
                if (event.type == sf::Event::Closed)
                    window.close();

                // Gestion des entrées clavier pour déplacer la caméra
                if (event.type == sf::Event::KeyPressed) {
                    float moveSpeed = 20.f;
                    if (event.key.code == sf::Keyboard::Left) {
                        camX -= moveSpeed;
                        targetX -= moveSpeed;
                    }
                    if (event.key.code == sf::Keyboard::Right) {
                        camX += moveSpeed;
                        targetX += moveSpeed;
                    }
                    if (event.key.code == sf::Keyboard::Up) {
                        camY += moveSpeed;
                        targetY += moveSpeed;
                    }
                    if (event.key.code == sf::Keyboard::Down) {
                        camY -= moveSpeed;
                        targetY -= moveSpeed;
                    }
                    if (event.key.code == sf::Keyboard::A) {
                        camZ -= moveSpeed;
                        targetZ -= moveSpeed;
                    }
                    if (event.key.code == sf::Keyboard::Q) {
                        camZ += moveSpeed;
                        targetZ += moveSpeed;
                    }
                    // Zoom via clavier (+ / -)
                    if (event.key.code == sf::Keyboard::Add || event.key.code == sf::Keyboard::Equal) {
                        fov -= 1.f;
                        if (fov < 10.f) fov = 10.f;
                    }
                    if (event.key.code == sf::Keyboard::Subtract || event.key.code == sf::Keyboard::Dash) {
                        fov += 1.f;
                        if (fov > 120.f) fov = 120.f;
                    }
                }
                // Zoom via molette de souris
                if (event.type == sf::Event::MouseWheelScrolled) {
                    if (event.mouseWheelScroll.wheel == sf::Mouse::VerticalWheel) {
                        fov -= event.mouseWheelScroll.delta;
                        if (fov < 10.f) fov = 10.f;
                        if (fov > 120.f) fov = 120.f;
                    }
                }
            }

            // Mise à jour de la simulation
            if (!paused) {
                #pragma omp parallel for 
                for (auto &p : particles) {
                    updateParticleState(p, tree, settings.dt);
                }
                tree.clear();
                for (const auto &p : particles) {
                    tree.insert(&p);
                }
                simulationTime += settings.dt;
                if (simulationTime > settings.t_total)
                    simulationTime = 0.f;
            }

            // Configuration de la vue OpenGL
            glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
            glMatrixMode(GL_PROJECTION);
            glLoadIdentity();
            gluPerspective(fov, 1.f, 1.f, 5000.f);
            glMatrixMode(GL_MODELVIEW);
            glLoadIdentity();
            gluLookAt(camX, camY, camZ, targetX, targetY, targetZ, 0.f, 1.f, 0.f);

            // Affichage des particules
            for (const auto &p : particles) {
                p.drawGL();
            }
            // Affichage de l'octree si demandé
            if (drawOctreeBorders)
                tree.drawGL();

            window.display();
            sf::sleep(sf::milliseconds(10));
        }
    }

    #endif

    api.stop();
    // Nettoyage de l'octree
    Octree::clearInstances();
    return 0;
}

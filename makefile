# Compiler
CXX = g++
CXX_MPI = mpicxx

# Flags de compilation
CXXFLAGS = -Wall -g
CXXFLAGS_OMP = -fopenmp
CXXFLAGS_OPTI = -std=c++11 -g -O3 -march=native --fast-math -fno-omit-frame-pointer -funroll-loops 

# Flags de linkage
LDFLAGS_SFML = -lsfml-graphics -lsfml-window -lsfml-system -lGL -lGLU
LDFLAGS_BOOST = -lboost_program_options -lboost_chrono -lboost_random

# Nom de l'exécutable
EXEC = bin/main

# Cible par défaut
ifeq ($(MAKECMDGOALS),headless)
LDFLAGS_SFML :=
else
CXXFLAGS_OPTI += -DDISPLAY_VERSION=1
endif

all: $(EXEC)
headless: $(EXEC)

# Création de l'exécutable
$(EXEC): main.cxx obj/Particle.o obj/Octree.o obj/MyRNG.o obj/APIRest.o
	@mkdir -p bin
	$(CXX) $(CXXFLAGS_OPTI) -o $@ $^ $(LDFLAGS_BOOST) $(LDFLAGS_SFML) $(CXXFLAGS_OMP)

# Compilation des fichiers sources en objets
#obj/main.o: main.cxx MyRNG.hpp obj/Particle.o obj/Octree.o
#	@mkdir -p obj
#	$(CXX) $(CXXFLAGS_OPTI) -c $< -o $@ $(LDFLAGS_BOOST) $(LDFLAGS_SFML) $(CXXFLAGS_OMP)

obj/MyRNG.o: MyRNG.cxx MyRNG.hpp
	@mkdir -p obj
	$(CXX) $(CXXFLAGS_OPTI) -c $< -o $@ $(LDFLAGS_BOOST) $(LDFLAGS_SFML) $(CXXFLAGS_OMP)

obj/Particle.o: Particle.cxx Particle.hpp obj/MyRNG.o
	@mkdir -p obj
	$(CXX) $(CXXFLAGS_OPTI) -c $< -o $@ $(LDFLAGS_BOOST) $(LDFLAGS_SFML) $(CXXFLAGS_OMP)

obj/Octree.o: Octree.cxx Octree.hpp obj/Particle.o
	@mkdir -p obj
	$(CXX) $(CXXFLAGS_OPTI) -c $< -o $@ $(LDFLAGS_BOOST) $(LDFLAGS_SFML) $(CXXFLAGS_OMP)

obj/APIRest.o: APIRest.cxx APIRest.hpp httplib.h nlohmann/json.hpp
	@mkdir -p obj
	$(CXX) $(CXXFLAGS_OPTI) -c $< -o $@ $(LDFLAGS_BOOST) $(LDFLAGS_SFML) $(CXXFLAGS_OMP)

# Nettoyage
clean:
	rm -f bin/* obj/*.o

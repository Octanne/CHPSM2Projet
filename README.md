# CHPSM2Projet

## Setup Python Environment (pyEnv) with Flask and requests

1. **Create and activate a virtual environment:**

    ```bash
    python -m venv venv
    source venv/bin/activate
    ```

2. **Install Flask and requests:**

    ```bash
    pip install Flask requests
    ```

## Start the WebGL Server

1. **Navigate to the WebGL server directory:**

    ```bash
    cd webGLViewver
    ```

2. **Start the server (example using Flask):**

    ```bash
    python3 webviewer.py
    ```

## Compile, Make, and Run the Compute Server App

0. **Preparation ROMEO:**
    ```bash
    spack install patch
    spack load patch
    spack install boost@1.86.0 +program_options +chrono +random %aocc
    ```

1. **Compile the application:**

    For romeo :
    ```bash
    make headless romeo
    ```

    Else without romeo spack :
    ```bash
    make headless
    ```

2. **Run the compute server:**

    ```bash
    bin/main --particles 100 --port-api 8080
    ```
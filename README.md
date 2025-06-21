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

## Compile with Make the Compute Server

1. **Preparation for ROMEO:**
    ```bash
    romeo_load_x64cpu_env
    spack install patch
    spack load patch
    spack install boost@1.86.0 +program_options +chrono +random %aocc
    spack load boost@1.86.0 +program_options +chrono +random %aocc
    ```

2. **Compile the application:**

    On ROMEO:
    ```bash
    make headless romeo
    ```

    Else without ROMEO spack:
    ```bash
    make headless
    ```

## Start the Compute Server

1. **Launching the compute server:**

   On ROMEO :
   ```bash
   romeo_load_x64cpu_env
   spack load boost@1.86.0 +program_options +chrono +random %aocc
   export LD_LIBRARY_PATH=$(spack location -i boost@1.86.0 +program_options +chrono +random %aocc)/lib:$LD_LIBRARY_PATH
   bin/main --particles 100 --port-api 8080
   ```
    
   Else without ROMEO spack :
   ```bash
   bin/main --particles 100 --port-api 8080
   ```

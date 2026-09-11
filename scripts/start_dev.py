#!/usr/bin/env python3
"""ShopMind startup script — starts both backend and frontend."""
import subprocess
import sys
import os

def main():
    backend_dir = os.path.join(os.path.dirname(__file__), 'backend')
    frontend_dir = os.path.join(os.path.dirname(__file__), 'frontend')

    print("=" * 60)
    print("  ShopMind AI Platform — Development Server")
    print("=" * 60)
    print()
    print("Starting services...")
    print("  Backend:  http://localhost:8000")
    print("  Frontend: http://localhost:5173")
    print("  API Docs: http://localhost:8000/api/docs")
    print()
    print("Press Ctrl+C to stop all services.")
    print()

    # Backend
    backend_env = {**os.environ, "PYTHONPATH": backend_dir}
    backend_proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--reload", "--host", "0.0.0.0", "--port", "8000"],
        cwd=backend_dir,
        env=backend_env,
    )

    # Frontend
    frontend_proc = subprocess.Popen(
        ["npm", "run", "dev"],
        cwd=frontend_dir,
        shell=True,
    )

    try:
        backend_proc.wait()
    except KeyboardInterrupt:
        print("\nShutting down...")
        backend_proc.terminate()
        frontend_proc.terminate()


if __name__ == "__main__":
    main()

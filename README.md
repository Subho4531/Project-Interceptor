# Project Interceptor

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://github.com/codespaces/new)

Development environment for **Project Interceptor**, pre-configured for GitHub Codespaces and VS Code Dev Containers.

## 🛠️ Environment Features

- **Base OS**: Ubuntu 22.04 LTS (`devcontainers/base`) with Zsh & Oh My Zsh
- **Python**: Python 3.11 with `pip`, tools, and Ruff linting/formatting
- **Node.js**: LTS release with NPM / PNPM / Yarn support
- **Docker-in-Docker**: Container-in-container workflows supported
- **GitHub CLI**: `gh` pre-installed and authenticated inside Codespaces
- **Pre-configured Extensions**:
  - Python & Pylance (`ms-python.python`, `ms-python.vscode-pylance`)
  - Ruff (`charliermarsh.ruff`)
  - Prettier & ESLint (`esbenp.prettier-vscode`, `dbaeumer.vscode-eslint`)
  - GitLens (`eamodio.gitlens`)
  - Error Lens (`usernamehw.errorlens`)
  - Docker (`ms-azuretools.vscode-docker`)

## 🚀 Quick Start

### In GitHub Codespaces
1. Push this repository to GitHub.
2. Click **Code** > **Codespaces** > **Create codespace on main**.
3. The environment will automatically build and run `.devcontainer/init-codespace.sh`.

### In Local VS Code (Dev Containers)
1. Ensure [Docker Desktop](https://www.docker.com/) is running.
2. Install the **Dev Containers** extension (`ms-vscode-remote.remote-containers`).
3. Press `F1` / `Ctrl+Shift+P` and choose **Dev Containers: Reopen in Container**.

## 📁 Project Structure

```
├── .devcontainer/
│   ├── devcontainer.json      # Codespace container configuration
│   └── init-codespace.sh      # Post-create initialization script
├── .gitignore
├── .env.example
└── README.md
```

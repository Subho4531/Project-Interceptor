#!/usr/bin/env bash
set -e

# ==============================================================================
# Project Interceptor - Codespace Initialization Script
# Executed automatically on container creation via devcontainer.json postCreateCommand
# ==============================================================================

echo "🚀 [Codespace Init] Initializing Project Interceptor environment..."

# 1. System diagnostics
echo "📦 Kernel: $(uname -srm)"
echo "🐍 Python: $(python3 --version 2>/dev/null || echo 'Not installed')"
echo "🟢 Node:   $(node --version 2>/dev/null || echo 'Not installed')"
echo "🐙 Git:    $(git --version 2>/dev/null || echo 'Not installed')"

# 2. Environment file setup
if [ ! -f ".env" ] && [ -f ".env.example" ]; then
    echo "⚙️ Creating .env from .env.example..."
    cp .env.example .env
fi

# 3. Python package setup
if [ -f "requirements.txt" ]; then
    echo "📦 Installing Python requirements..."
    pip install --upgrade pip
    pip install -r requirements.txt
elif [ -f "pyproject.toml" ]; then
    echo "📦 Installing Python project via pip..."
    pip install -e . || pip install .
fi

# 4. Node.js package setup
if [ -f "package.json" ]; then
    echo "📦 Installing Node dependencies..."
    if [ -f "pnpm-lock.yaml" ]; then
        pnpm install
    elif [ -f "yarn.lock" ]; then
        yarn install
    else
        npm install
    fi
fi

# 5. Make scripts executable
if [ -d "scripts" ]; then
    chmod +x scripts/*.sh 2>/dev/null || true
fi

echo "✅ [Codespace Init] Environment ready! Happy coding!"

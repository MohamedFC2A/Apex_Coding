#!/bin/bash

# Apex Coding IDE - Quick Start Script
# This script sets up and starts the development environment

set -e

echo "🚀 Apex Coding IDE - Quick Start"
echo "=================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please visit https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v)
echo "✅ Node.js $NODE_VERSION found"
echo ""

# Check dependencies
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo "✅ Dependencies installed"
    echo ""
fi

# Verify .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found"
    echo "Creating .env from template..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "✅ .env created from .env.example"
    else
        echo "❌ No .env.example found. Create .env manually."
        exit 1
    fi
    echo ""
fi

echo "📋 Configuration:"
echo "   - Frontend URL: http://localhost:5173"
echo "   - Backend URL: http://localhost:3001"
echo "   - Preview: Simple Live Preview (built-in, no external provider)"
echo ""

echo "✨ Starting development servers..."
echo "   Press Ctrl+C to stop"
echo ""

npm run dev


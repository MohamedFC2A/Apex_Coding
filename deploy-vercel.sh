#!/bin/bash

# Vercel Deployment Script for Apex Coding

echo "🚀 Deploying Apex Coding to Vercel..."

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null
then
    echo "❌ Vercel CLI not found. Installing..."
    npm install -g vercel
fi

# Set environment variables
echo "📝 Setting environment variables..."

vercel env add DEEPSEEK_API_KEY production
vercel env add DEEPSEEK_BASE_URL production
vercel env add DEEPSEEK_MODEL production
vercel env add DEEPSEEK_THINKING_MODEL production
vercel env add NEXT_PUBLIC_BACKEND_URL production
vercel env add VITE_DEEPSEEK_API_KEY production
vercel env add VITE_DEEPSEEK_BASE_URL production
vercel env add VITE_DEEPSEEK_MODEL production
vercel env add VITE_DEEPSEEK_THINKING_MODEL production

echo "✅ Environment variables configured"

# Deploy to Vercel
echo "🚀 Deploying to production..."
vercel --prod

echo "✅ Deployment complete!"
echo "🌐 Visit your site at: https://apex-coding.vercel.app"

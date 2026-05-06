#!/bin/bash

echo "🚀 Setting up Proxy Manager Development Environment"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Start services
echo "📦 Starting MySQL and Redis..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check if MySQL is ready
echo "🔍 Checking MySQL connection..."
until docker exec proxy-manager-mysql mysqladmin ping -h"localhost" --silent; do
    echo "Waiting for MySQL..."
    sleep 2
done

# Check if Redis is ready
echo "🔍 Checking Redis connection..."
until docker exec proxy-manager-redis redis-cli ping; do
    echo "Waiting for Redis..."
    sleep 2
done

echo "✅ Services are ready!"

# Setup environment
if [ ! -f .env ]; then
    echo "📝 Creating .env file from .env.example..."
    cp .env.example .env
    echo "⚠️  Please update .env file with your configuration"
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Database setup
echo "🗄️ Setting up database..."
cd libs/db
npx prisma generate
npx prisma migrate dev --name init
cd ../..

echo "🎉 Development environment is ready!"
echo ""
echo "Next steps:"
echo "1. Update .env file if needed"
echo "2. Run 'npm run dev' to start all services"
echo "3. Visit http://localhost:3000 for dashboard"
echo "4. API is available at http://localhost:3001"
echo ""
echo "To stop services: docker-compose down"

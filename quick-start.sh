#!/bin/bash

# =====================================================
# RESEARCHAI - QUICK START SCRIPT
# Automated setup for local development
# =====================================================

set -e  # Exit on error

echo "🚀 ResearchAI Quick Start"
echo "================================"
echo ""

# Check if running from project root
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# =====================================================
# 1. CHECK PREREQUISITES
# =====================================================

echo "📋 Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    echo "   Install from: https://nodejs.org/"
    exit 1
fi
echo "✅ Node.js $(node --version)"

# Check npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed"
    exit 1
fi
echo "✅ npm $(npm --version)"

# Check Docker (optional)
if command -v docker &> /dev/null; then
    echo "✅ Docker $(docker --version | cut -d ' ' -f3 | cut -d ',' -f1)"
    DOCKER_AVAILABLE=true
else
    echo "⚠️  Docker not found (optional - can run without it)"
    DOCKER_AVAILABLE=false
fi

# Check Redis
if command -v redis-cli &> /dev/null; then
    echo "✅ Redis $(redis-cli --version | cut -d ' ' -f2)"
    REDIS_AVAILABLE=true
else
    echo "⚠️  Redis not found locally"
    REDIS_AVAILABLE=false
fi

echo ""

# =====================================================
# 2. INSTALL DEPENDENCIES
# =====================================================

echo "📦 Installing backend dependencies..."
cd backend
npm install
cd ..
echo "✅ Backend dependencies installed"
echo ""

# =====================================================
# 3. SETUP ENVIRONMENT
# =====================================================

echo "⚙️  Setting up environment..."

if [ ! -f "backend/.env" ]; then
    echo "Creating .env file from template..."
    cp backend/.env.example backend/.env
    echo "✅ Created backend/.env"
    echo ""
    echo "⚠️  IMPORTANT: Edit backend/.env and add your credentials:"
    echo "   - SUPABASE_URL"
    echo "   - SUPABASE_SERVICE_ROLE_KEY"
    echo "   - SUPABASE_ANON_KEY"
    echo "   - CEREBRAS_API_KEY (or use sandbox mode)"
    echo ""
    read -p "Press Enter when you've updated backend/.env..."
else
    echo "✅ backend/.env already exists"
fi

echo ""

# =====================================================
# 4. START SERVICES
# =====================================================

echo "🔧 Choose how to start services:"
echo "1) Docker Compose (recommended)"
echo "2) Local (requires Redis running)"
echo "3) Skip (I'll start manually)"
read -p "Enter choice [1-3]: " choice

case $choice in
    1)
        if [ "$DOCKER_AVAILABLE" = true ]; then
            echo "🐳 Starting services with Docker Compose..."
            docker-compose up -d
            echo "✅ Services started:"
            echo "   - Backend: http://localhost:3000"
            echo "   - Redis: localhost:6379"
            echo "   - Y.js WebSocket: ws://localhost:1234"
            echo ""
            echo "View logs: docker-compose logs -f"
        else
            echo "❌ Docker is not available"
            exit 1
        fi
        ;;
    2)
        # Check if Redis is running
        if ! redis-cli ping &> /dev/null; then
            echo "⚠️  Redis is not running!"
            echo ""
            echo "Start Redis in a new terminal:"
            echo "   redis-server"
            echo ""
            read -p "Press Enter when Redis is running..."
        fi
        
        echo "🚀 Starting backend..."
        cd backend
        npm start &
        BACKEND_PID=$!
        echo "✅ Backend started (PID: $BACKEND_PID)"
        echo "   URL: http://localhost:3000"
        echo ""
        echo "To stop: kill $BACKEND_PID"
        ;;
    3)
        echo "⏭️  Skipping service startup"
        ;;
    *)
        echo "Invalid choice"
        exit 1
        ;;
esac

echo ""

# =====================================================
# 5. DATABASE SETUP
# =====================================================

echo "💾 Database Setup"
echo "================================"
echo ""
echo "Run the migration in Supabase SQL Editor:"
echo "1. Open: https://app.supabase.com/project/_/sql"
echo "2. Copy: COMPLETE_DATABASE_MIGRATION.sql"
echo "3. Paste and run in SQL Editor"
echo ""
echo "Create Storage buckets:"
echo "1. Go to: https://app.supabase.com/project/_/storage/buckets"
echo "2. Create bucket: 'chart-exports' (public)"
echo "3. Create bucket: 'paper-pdfs' (private)"
echo ""
read -p "Press Enter when database is setup..."

echo ""

# =====================================================
# 6. RUN TESTS (OPTIONAL)
# =====================================================

echo "🧪 Would you like to run tests?"
read -p "Run tests? [y/N]: " run_tests

if [[ $run_tests =~ ^[Yy]$ ]]; then
    echo ""
    echo "To run tests, you need:"
    echo "1. A JWT token from your app"
    echo "2. A workspace ID"
    echo ""
    read -p "Enter JWT token: " jwt_token
    read -p "Enter workspace ID: " workspace_id
    
    export TEST_JWT_TOKEN="$jwt_token"
    export TEST_WORKSPACE_ID="$workspace_id"
    
    echo ""
    echo "Running tests..."
    cd backend
    npm test -- tests/services.test.js
    cd ..
    
    echo ""
    echo "✅ Tests complete!"
fi

echo ""

# =====================================================
# 7. FINAL INSTRUCTIONS
# =====================================================

echo "✅ Setup Complete!"
echo "================================"
echo ""
echo "Backend is running at: http://localhost:3000"
echo ""
echo "📚 Next steps:"
echo ""
echo "1. Frontend Integration (2-3 hours):"
echo "   cd frontend"
echo "   npm install y-websocket y-protocols lodash jsondiffpatch"
echo "   # Copy hooks from FRONTEND_INTEGRATION_GUIDE.md"
echo ""
echo "2. Test API:"
echo "   Import ResearchAI_Postman_Collection.json into Postman"
echo "   Or: curl http://localhost:3000/health"
echo ""
echo "3. View Documentation:"
echo "   - DEPLOYMENT_GUIDE.md - Complete setup guide"
echo "   - FRONTEND_INTEGRATION_GUIDE.md - Frontend examples"
echo "   - INTEGRATION_DELIVERY_SUMMARY.md - What's included"
echo ""
echo "4. Monitor Services:"
if [ "$DOCKER_AVAILABLE" = true ] && [ "$choice" = "1" ]; then
    echo "   docker-compose logs -f backend"
    echo "   docker-compose ps"
fi
echo ""
echo "🎉 Ready to build! Happy coding!"
echo ""

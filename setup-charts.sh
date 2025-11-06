#!/bin/bash

# Chart Generation Setup Script
# Run this to install missing packages and verify implementation

echo "🎨 Setting up Chart Generation & Network Analysis..."

# Install backend chart rendering package
echo "📦 Installing chartjs-node-canvas..."
cd backend
npm install chartjs-node-canvas@4.1.6

if [ $? -eq 0 ]; then
    echo "✅ chartjs-node-canvas installed successfully"
else
    echo "❌ Failed to install chartjs-node-canvas"
    echo "💡 Try: sudo apt-get install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev"
    exit 1
fi

cd ..

# Verify frontend packages
echo "🔍 Verifying frontend packages..."
cd frontend
if npm list recharts > /dev/null 2>&1; then
    echo "✅ recharts installed"
else
    echo "❌ recharts missing - installing..."
    npm install recharts@3.2.0
fi

if npm list react-force-graph > /dev/null 2>&1; then
    echo "✅ react-force-graph installed"
else
    echo "❌ react-force-graph missing - installing..."
    npm install react-force-graph@1.48.1
fi

cd ..

# Check database
echo "🗄️ Checking database tables..."
if [ -n "$DATABASE_URL" ]; then
    if psql "$DATABASE_URL" -c "SELECT 1 FROM chart_exports LIMIT 1;" > /dev/null 2>&1; then
        echo "✅ chart_exports table exists"
    else
        echo "⚠️ chart_exports table missing"
        echo "💡 Run: psql \$DATABASE_URL -f MISSING_TABLES.sql"
    fi
    
    if psql "$DATABASE_URL" -c "SELECT 1 FROM humanizer_logs LIMIT 1;" > /dev/null 2>&1; then
        echo "✅ humanizer_logs table exists"
    else
        echo "⚠️ humanizer_logs table missing"
        echo "💡 Run: psql \$DATABASE_URL -f MISSING_TABLES.sql"
    fi
else
    echo "⚠️ DATABASE_URL not set - skipping database check"
fi

# Check environment variables
echo "🔑 Checking environment variables..."
cd backend
if [ -f .env ]; then
    if grep -q "CEREBRAS_API_KEY" .env; then
        echo "✅ CEREBRAS_API_KEY configured"
    else
        echo "⚠️ CEREBRAS_API_KEY missing in .env"
    fi
    
    if grep -q "GEMINI_API_KEY" .env; then
        echo "✅ GEMINI_API_KEY configured"
    else
        echo "⚠️ GEMINI_API_KEY missing in .env"
    fi
    
    if grep -q "SUPABASE_URL" .env; then
        echo "✅ SUPABASE_URL configured"
    else
        echo "⚠️ SUPABASE_URL missing in .env"
    fi
else
    echo "❌ .env file not found in backend/"
fi

cd ..

echo ""
echo "🎉 Setup complete! Chart generation features are ready."
echo ""
echo "📋 Quick Test Checklist:"
echo "1. Start backend: cd backend && npm run dev"
echo "2. Start frontend: cd frontend && npm run dev"
echo "3. Navigate to workspace → Visual Analytics tab"
echo "4. Click 'Citation Trend' button"
echo "5. Check job status updates"
echo "6. Verify chart appears in results"
echo ""
echo "📖 Full documentation: CHART_AND_NETWORK_IMPLEMENTATION_COMPLETE.md"
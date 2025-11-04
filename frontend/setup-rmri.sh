#!/bin/bash

# RMRI Frontend Setup Script
# Installs all required dependencies for RMRI components

echo "🚀 Setting up RMRI Frontend Components..."
echo ""

# Navigate to frontend directory
cd "$(dirname "$0")"

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo "❌ package.json not found. Are you in the frontend directory?"
    exit 1
fi

echo "📦 Installing dependencies..."
echo ""

# Install core dependencies
npm install --save \
  framer-motion@^10.16.0 \
  @supabase/auth-helpers-react@^0.4.0 \
  @supabase/supabase-js@^2.38.0 \
  axios@^1.6.0 \
  react-force-graph-2d@^1.25.0 \
  @heroicons/react@^2.0.18

# Check if installation was successful
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Dependencies installed successfully!"
    echo ""
    echo "📝 Next steps:"
    echo "  1. Create .env file with:"
    echo "     VITE_API_URL=http://localhost:3000"
    echo "     VITE_SUPABASE_URL=your-supabase-url"
    echo "     VITE_SUPABASE_ANON_KEY=your-anon-key"
    echo ""
    echo "  2. Set up Supabase Storage bucket 'research-papers'"
    echo ""
    echo "  3. Run: npm run dev"
    echo ""
    echo "📖 See RMRI_COMPONENTS_GUIDE.md for full documentation"
else
    echo ""
    echo "❌ Installation failed. Please check errors above."
    exit 1
fi

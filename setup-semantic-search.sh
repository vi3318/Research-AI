#!/bin/bash

# ResearchAI Semantic Search Setup Script
# Run this script to verify your setup is complete

echo "🚀 ResearchAI Semantic Search Setup Verification"
echo "=================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check 1: HuggingFace API Key
echo "📝 Step 1: Checking HuggingFace API Key..."
if grep -q "HUGGINGFACE_API_KEY=hf_" backend/.env 2>/dev/null; then
    echo -e "${GREEN}✅ HuggingFace API key found in .env${NC}"
else
    echo -e "${YELLOW}⚠️  HuggingFace API key not set properly${NC}"
    echo "   Get your free API key from: https://huggingface.co/settings/tokens"
    echo "   Then update backend/.env with: HUGGINGFACE_API_KEY=hf_your_key_here"
fi
echo ""

# Check 2: Redis running
echo "🔴 Step 2: Checking Redis server..."
if redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Redis is running${NC}"
else
    echo -e "${YELLOW}⚠️  Redis is not running${NC}"
    echo "   Install: brew install redis"
    echo "   Start: redis-server"
fi
echo ""

# Check 3: Dependencies installed
echo "📦 Step 3: Checking backend dependencies..."
if [ -f "backend/node_modules/@huggingface/inference/package.json" ]; then
    echo -e "${GREEN}✅ @huggingface/inference installed${NC}"
else
    echo -e "${RED}❌ @huggingface/inference NOT installed${NC}"
    echo "   Run: cd backend && npm install"
fi

if [ -f "backend/node_modules/cheerio/package.json" ]; then
    echo -e "${GREEN}✅ cheerio installed${NC}"
else
    echo -e "${RED}❌ cheerio NOT installed${NC}"
    echo "   Run: cd backend && npm install"
fi

if [ -f "backend/node_modules/xml2js/package.json" ]; then
    echo -e "${GREEN}✅ xml2js installed${NC}"
else
    echo -e "${RED}❌ xml2js NOT installed${NC}"
    echo "   Run: cd backend && npm install"
fi
echo ""

# Check 4: Backend files exist
echo "📂 Step 4: Checking backend files..."
FILES=(
    "backend/src/services/paperScrapers.js"
    "backend/src/services/paperEmbeddings.js"
    "backend/src/services/paperQueue.js"
    "backend/src/controllers/semanticSearchController.js"
    "backend/src/routes/semanticSearchRoutes.js"
)

all_files_exist=true
for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅ $file${NC}"
    else
        echo -e "${RED}❌ $file NOT FOUND${NC}"
        all_files_exist=false
    fi
done
echo ""

# Check 5: Frontend files exist
echo "🎨 Step 5: Checking frontend files..."
if [ -f "frontend/src/pages/SemanticSearch.tsx" ]; then
    echo -e "${GREEN}✅ frontend/src/pages/SemanticSearch.tsx${NC}"
else
    echo -e "${RED}❌ SemanticSearch.tsx NOT FOUND${NC}"
fi
echo ""

# Check 6: SQL migration file exists
echo "🗄️  Step 6: Checking SQL migration..."
if [ -f "CREATE_SEMANTIC_PAPERS_TABLE.sql" ]; then
    echo -e "${GREEN}✅ CREATE_SEMANTIC_PAPERS_TABLE.sql found${NC}"
    echo "   Remember to run this in Supabase SQL Editor!"
else
    echo -e "${RED}❌ CREATE_SEMANTIC_PAPERS_TABLE.sql NOT FOUND${NC}"
fi
echo ""

# Summary
echo "=================================================="
echo "📋 NEXT STEPS:"
echo "=================================================="
echo ""
echo "1. Get HuggingFace API Key:"
echo "   Visit: https://huggingface.co/settings/tokens"
echo "   Update backend/.env: HUGGINGFACE_API_KEY=hf_your_key"
echo ""
echo "2. Run SQL Migration:"
echo "   • Open Supabase SQL Editor"
echo "   • Copy contents of CREATE_SEMANTIC_PAPERS_TABLE.sql"
echo "   • Run the script"
echo ""
echo "3. Start Redis:"
echo "   redis-server"
echo ""
echo "4. Start Backend:"
echo "   cd backend && npm run dev"
echo ""
echo "5. Test Semantic Search:"
echo "   • Open app in browser"
echo "   • Go to Semantic Search page"
echo "   • Enter query: 'machine learning for drug discovery'"
echo "   • Click Search"
echo ""
echo "✨ Good luck!"

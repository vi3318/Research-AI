#!/bin/bash
cd /Users/vidharia/Documents/Projects/capstone/researchAI/backend
echo "Current directory: $(pwd)"
echo "Environment file exists: $(test -f .env && echo 'YES' || echo 'NO')"
echo "Starting ResearchAI backend server..."
node src/index.js

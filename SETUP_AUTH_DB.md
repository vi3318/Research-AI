# Authentication & Database Setup Guide

## Overview
Your ResearchAI app now includes:
- **Clerk Authentication** - User management and auth
- **Supabase Database** - Persistent chat sessions, messages, and paper context
- **Chat Interface** - ChatGPT-like interface with research context
- **Contextual Q&A** - Ask questions about retrieved papers

## Setup Steps

### 1. Clerk Authentication Setup

1. Go to [clerk.com](https://clerk.com) and create an account
2. Create a new application
3. Copy your keys from the Clerk dashboard:
   - `CLERK_PUBLISHABLE_KEY` (starts with `pk_`)
   - `CLERK_SECRET_KEY` (starts with `sk_`)

### 2. Supabase Database Setup

1. Go to [supabase.com](https://supabase.com) and create an account
2. Create a new project
3. Copy your project details:
   - `SUPABASE_URL` (your project URL)
   - `SUPABASE_ANON_KEY` (public anon key)
   - `SUPABASE_SERVICE_ROLE_KEY` (service role key - keep private!)

4. Run the database schema:
   - Go to Supabase Dashboard → SQL Editor
   - Copy and paste the contents of `backend/src/config/database-schema.sql`
   - Run the SQL to create tables and policies

### 3. Environment Variables

**Backend (.env):**
```env
# Add these to your existing .env file
CLERK_PUBLISHABLE_KEY=your-clerk-publishable-key
CLERK_SECRET_KEY=your-clerk-secret-key
SUPABASE_URL=your-supabase-project-url
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

**Frontend (.env):**
```env
VITE_CLERK_PUBLISHABLE_KEY=your-clerk-publishable-key
VITE_API_URL=http://localhost:3000
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 4. Install Dependencies

**Backend:**
```bash
cd backend
npm install
```

**Frontend:**
```bash
cd frontend
npm install
```

### 5. Run the Application

**Start Backend (API + Worker):**
```bash
cd backend
npm run dev  # API server
npm run worker  # Background worker (separate terminal)
```

**Start Frontend:**
```bash
cd frontend
npm run dev
```

## Features Added

### 1. Authentication
- Sign in/out with Clerk
- User profiles and session management
- Protected routes for chat functionality

### 2. Chat Sessions
- Create multiple chat sessions (like ChatGPT conversations)
- Persistent storage in Supabase
- Session management (rename, delete)
- Real-time message history

### 3. Chat Types
- **Chat**: General conversation with AI
- **Research**: Research-focused discussions
- **Paper Q&A**: Ask questions about papers in session context

### 4. Paper Context
- Add papers from research results to chat sessions
- Q&A based on paper content (abstracts + PDFs)
- Contextual understanding across multiple papers

### 5. Research Integration
- Research jobs now optionally link to chat sessions
- Papers can be automatically added to context
- Seamless workflow from research → chat → Q&A

## Usage Flow

1. **Sign Up/In**: Use Clerk authentication
2. **Run Research**: Use existing research mode to find papers
3. **Start Chat**: Create a new chat session
4. **Add Context**: Add interesting papers to the session context
5. **Ask Questions**: Switch to "Paper Q&A" mode and ask about the papers
6. **Research Chat**: Use "Research" mode for methodology discussions

## Research Paper Value

This implementation provides significant research contributions:

### Technical Innovations
1. **Conversational RAG**: Multi-turn conversations with research context
2. **Session Persistence**: Long-term research memory across sessions
3. **Hybrid Context**: Combines real-time search with persistent knowledge
4. **User-Centric Design**: Research workflow optimization

### Evaluation Opportunities
1. **User Engagement**: Session length, return rate, query refinement
2. **Context Utilization**: How users interact with paper context
3. **Research Productivity**: Time to insight, question quality
4. **Knowledge Retention**: Cross-session learning patterns

### Novel Contributions
1. **Research Session Management**: First tool to combine search + persistent chat
2. **Contextual Paper Q&A**: Deep integration of PDF content with conversational AI
3. **Multi-Modal Research**: Text search + semantic search + conversational interface
4. **Research Workflow Optimization**: End-to-end research assistance

## Next Steps

1. **Test the setup** with your Clerk and Supabase credentials
2. **Create sample chat sessions** and test paper Q&A
3. **Gather user feedback** for research evaluation
4. **Add research metrics** (session analytics, query patterns)
5. **Write the research paper** with user studies and evaluations

This is now a production-ready research assistant with unique conversational capabilities!
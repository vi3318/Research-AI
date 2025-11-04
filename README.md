# ResearchAI - Collaborative Research Platform

A powerful collaborative research platform that combines AI-powered paper analysis, real-time collaborative document editing, and intelligent text humanization. Built for researchers, students, and academic teams.

------------------------------------------------------------------------

## 🌟 Key Features

### 📚 Research & Analysis
- **AI-Powered Research**: Expands research queries into relevant topics using Gemini API
- **Scholar Integration**: Scrapes Google Scholar for academic papers
- **Smart Citations**: Automatic citation management with IEEE format
- **Paper Pinning**: Organize important papers by workspace

### ✍️ Collaborative Editing
- **Real-time Collaboration**: Google Docs-style editing with Y.js CRDT
- **TipTap Editor**: Rich formatting with 18+ extensions
- **IEEE Templates**: Pre-structured academic paper templates
- **Version Control**: Automatic snapshots and manual revision points
- **Live Cursors**: See collaborators' positions in real-time

### 🤖 AI Features
- **Text Humanizer**: Transform AI-generated text to sound natural
- **Multiple Providers**: Cerebras LLaMA 3.1, HuggingFace BART
- **Usage Logging**: Track all humanization requests
- **Smart Detection**: AI detection score with improvement metrics

### 👥 Workspace Management
- **Team Workspaces**: Create collaborative research environments
- **Role-Based Access**: Owner, Editor, Viewer, Commenter roles
- **Member Management**: Invite and manage team members
- **Activity Tracking**: Monitor workspace activity

------------------------------------------------------------------------

## 🚀 Getting Started

### Prerequisites

-   **Node.js** (v14 or later)
-   **npm** or **yarn**
-   **Supabase Account** (for database & auth)
-   **Redis** (for job queue)
-   **API Keys**:
    - Google Gemini API key (required)
    - Cerebras API key (optional, for humanizer)
    - HuggingFace API key (optional, for humanizer)

### Redis Installation

-   **Windows**: Download from [GitHub releases](https://github.com/microsoftarchive/redis/releases), use WSL2, or Docker:
    ```bash
    docker run --name redis -p 6379:6379 -d redis
    ```

-   **macOS**:
    ```bash
    brew install redis
    brew services start redis
    ```

-   **Linux (Ubuntu/Debian)**:
    ```bash
    sudo apt update
    sudo apt install redis-server
    sudo systemctl start redis-server
    ```

Verify Redis: `redis-cli ping` → should return `PONG`

### Backend Setup

1.  **Navigate to backend directory**:
    ```bash
    cd backend
    ```

2.  **Install dependencies**: 
    ```bash     
    npm install
    ```

3.  **Configure environment variables**:
    Create a `.env` file in the `backend/` directory:
    ```bash
    # Supabase (Required)
    SUPABASE_URL=https://your-project.supabase.co
    SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
    SUPABASE_ANON_KEY=your-anon-key
    
    # Gemini API (Required)
    GEMINI_API_KEY=your-gemini-api-key
    
    # AI Humanizer (Optional)
    CEREBRAS_API_KEY=your-cerebras-key
    HF_API_KEY=your-huggingface-key
    
    # Redis
    REDIS_URL=redis://localhost:6379
    
    # Server
    PORT=3000
    NODE_ENV=development
    ```

4.  **Apply database schemas**:
    - Go to Supabase Dashboard → SQL Editor
    - Run these files in order:
      1. `USERS_TABLE_FIX.sql`
      2. `WORKSPACE_SCHEMA_CLEAN.sql`
      3. `COLLABORATIVE_DOCUMENTS_SCHEMA_CLEAN.sql`
      4. `MISSING_TABLES.sql`

5.  **Start the backend**:
    ```bash
    npm run dev  # Development with auto-reload
    # or
    npm start    # Production
    ```

### Frontend Setup

1.  **Navigate to frontend directory**:
    ```bash
    cd frontend
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Configure environment variables**:
    Create `.env.local` in the `frontend/` directory:
    ```bash
    VITE_API_URL=http://localhost:3000
    VITE_SUPABASE_URL=https://your-project.supabase.co
    VITE_SUPABASE_ANON_KEY=your-anon-key
    ```

4.  **Start the frontend**:
    ```bash
    npm run dev
    ```

5.  **Open in browser**: `http://localhost:5173`

### WebSocket Server (Y.js Collaboration)

The collaboration server runs separately on port 1234:

```bash
cd backend
node collaboration-server.js
```

------------------------------------------------------------------------

## 📖 API Documentation

See [API.md](./API.md) for complete API reference including:
- Workspace management
- Document CRUD operations
- Pin/unpin papers
- Text humanization
- Authentication & permissions

### Quick Example: Create a Document

```bash
curl -X POST http://localhost:3000/api/documents/create \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workspace_id": "workspace-uuid",
    "title": "My Research Paper",
    "type": "ieee"
  }'
```

------------------------------------------------------------------------

## 🗄️ Database Schema

### Core Tables

**workspaces** - Team research environments
```sql
id UUID, name TEXT, description TEXT, owner_id TEXT, settings JSONB
```

**documents** - Collaborative documents
```sql
id UUID, workspace_id UUID, title TEXT, type TEXT, owner_id TEXT
```

**document_content** - Document data with Y.js state
```sql
id UUID, document_id UUID, content JSONB, yjs_state BYTEA, version INTEGER
```

**document_collaborators** - Access control
```sql
id UUID, document_id UUID, user_id TEXT, role TEXT
```

**workspace_papers** - Pinned papers
```sql
id UUID, workspace_id UUID, paper_id UUID, added_by TEXT, notes TEXT, tags TEXT[]
```

**humanizer_logs** - AI humanization tracking
```sql
id UUID, user_id TEXT, input_text TEXT, output_text TEXT, provider TEXT
```

**chart_exports** - Visualization exports
```sql
id UUID, workspace_id UUID, type TEXT, params JSONB, image_url TEXT
```

See SQL files for complete schemas with RLS policies and triggers.

------------------------------------------------------------------------------------------------------------------------------------------------

## 📚 Legacy Research API

The original research assistant functionality is still available:

### **Start a Research Job**

-   **POST** `/api/research`
-   **Description**: Initiates a new research job.
-   **Request Body**:
    ```json     
    {       
        "query": "Your research query here"     
    }
    ```
-   **Response** (202 Accepted):
    ```json     
    {       
        "jobId": "a-unique-uuid",       
        "status": "queued",       
        "message": "Research job has been queued"     
    }
    ```

### **Check Job Status**

-   **GET** `/api/research/status/:jobId`
-   **Description**: Checks the status of a research job.
-   **Response** (200 OK):
    ```json     
    {       
        "jobId": "a-unique-uuid",       
        "status": "processing",       
        "progress": 50,       
        "createdAt": "2023-10-27T10:00:00.000Z",       
        "updatedAt": "2023-10-27T10:05:00.000Z"     
    }
    ```

### **Get Research Results**

-   **GET** `/api/research/results/:jobId`
-   **Description**: Retrieves the results of a completed job.
-   **Response** (200 OK): A JSON object containing the original query, expanded topics, a list of papers for each topic, and a detailed analysis.

------------------------------------------------------------------------

## Using the API with cURL

-   **Start a job**:

    ``` bash
    curl -X POST http://localhost:3000/api/research       
    -H "Content-Type: application/json"       
    -d '{"query": "The impact of AI on modern education"}'
    ```

-   **Check status**:

    ``` bash
    curl -X GET http://localhost:3000/api/research/status/your-job-id
    ```

-   **Get results**:

    ``` bash
    curl -X GET http://localhost:3000/api/research/results/your-job-id
    ```

------------------------------------------------------------------------

## Available Scripts

-   `npm run dev`: Starts the server in development mode.
-   `npm start`: Starts the server in production mode.
-   `npm run quickstart`: An interactive script to help with initial setup.
-   `npm run test-api`: A script to test the API endpoints.
-   `npm run test-redis`: Checks the connection to your Redis server.
-   `npm run setup`: Sets up Playwright.

------------------------------------------------------------------------

## Troubleshooting

### Debugging

To enable debug logs, you can set the `DEBUG` environment variable.

-   **PowerShell**:

    ``` powershell
    $env:DEBUG="researchai:*"
    ```

-   **Linux/macOS**:

    ``` bash
    export DEBUG="researchai:*"
    ```

You can also specify particular modules to debug, for example:
`export DEBUG="researchai:controller,researchai:gemini"`.

### Common Issues

-   **Redis Connection Errors**: If you encounter errors like
    `Redis connection to 127.0.0.1:6379 failed`, ensure that your Redis server is running and that the `REDIS_URL` in your `.env` file is correctly configured.

-   **Google Scholar Scraping**: If you run into CAPTCHA errors, you may need to try a different IP address (using a VPN or proxy), reduce how often you make requests, or change the user agent in `scholarScraperService.js`.

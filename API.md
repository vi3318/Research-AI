# ResearchAI Backend API Documentation

Complete API reference for the ResearchAI collaborative research platform.

## Table of Contents
- [Authentication](#authentication)
- [Workspaces](#workspaces)
- [Documents](#documents)
- [Pin/Unpin Papers](#pinunpin-papers)
- [Humanizer](#humanizer)
- [Error Handling](#error-handling)

---

## Authentication

All endpoints (except health checks) require JWT authentication via Supabase.

### Headers
```
Authorization: Bearer <SUPABASE_JWT_TOKEN>
Content-Type: application/json
```

### Getting a Token
```javascript
const { data: { session } } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password'
});
const token = session.access_token;
```

---

## Workspaces

### List User Workspaces
Get all workspaces the user has access to.

**Endpoint:** `GET /api/workspaces`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "My Research Project",
      "description": "Research on AI collaboration",
      "owner_id": "user-id",
      "settings": {},
      "created_at": "2025-11-03T10:00:00Z",
      "updated_at": "2025-11-03T10:00:00Z",
      "workspace_users": {
        "role": "owner"
      }
    }
  ]
}
```

### Create Workspace
Create a new workspace.

**Endpoint:** `POST /api/workspaces`

**Body:**
```json
{
  "name": "My New Workspace",
  "description": "Optional description",
  "settings": {}
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "My New Workspace",
    "owner_id": "user-id",
    "created_at": "2025-11-03T10:00:00Z"
  }
}
```

### Get Workspace Details
Get detailed information about a workspace.

**Endpoint:** `GET /api/workspaces/:id`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "My Workspace",
    "members": [
      {
        "user_id": "user-id",
        "role": "owner",
        "email": "user@example.com",
        "name": "John Doe"
      }
    ]
  }
}
```

---

## Documents

### Create Document
Create a new collaborative document.

**Endpoint:** `POST /api/documents/create`

**Body:**
```json
{
  "workspace_id": "workspace-uuid",
  "title": "My IEEE Paper",
  "type": "ieee"
}
```

**Types:**
- `ieee` - Pre-structured IEEE format paper
- `blank` - Empty document

**Response:**
```json
{
  "success": true,
  "document": {
    "id": "doc-uuid",
    "workspace_id": "workspace-uuid",
    "title": "My IEEE Paper",
    "type": "ieee",
    "owner_id": "user-id",
    "created_at": "2025-11-03T10:00:00Z"
  },
  "content": {
    "id": "content-uuid",
    "document_id": "doc-uuid",
    "content": { /* TipTap JSON */ },
    "version": 1
  }
}
```

### Get Document
Retrieve document with content and collaborators.

**Endpoint:** `GET /api/documents/:id`

**Response:**
```json
{
  "success": true,
  "document": {
    "id": "doc-uuid",
    "title": "My IEEE Paper",
    "type": "ieee",
    "content": {
      "type": "doc",
      "content": [/* TipTap nodes */]
    },
    "collaborators": [
      {
        "user_id": "user-id",
        "role": "owner",
        "users": {
          "email": "user@example.com",
          "name": "John Doe"
        }
      }
    ]
  }
}
```

### Save Document
Update document content.

**Endpoint:** `POST /api/documents/:id/update`

**Body:**
```json
{
  "content": {
    "type": "doc",
    "content": [/* TipTap JSON */]
  }
}
```

**Response:**
```json
{
  "success": true,
  "content": {
    "id": "content-uuid",
    "version": 2,
    "updated_at": "2025-11-03T10:05:00Z"
  }
}
```

### Add Collaborator
Invite a user to collaborate on a document.

**Endpoint:** `POST /api/documents/:id/add-collaborator`

**Body:**
```json
{
  "user_id": "user-id-to-invite",
  "role": "editor"
}
```

**Roles:**
- `owner` - Full control (delete, manage collaborators)
- `editor` - Edit content, invite collaborators
- `viewer` - Read-only access
- `commenter` - Can view and comment

**Response:**
```json
{
  "success": true,
  "collaborator": {
    "id": "collab-uuid",
    "document_id": "doc-uuid",
    "user_id": "invited-user-id",
    "role": "editor"
  }
}
```

### Get Document Revisions
List all saved versions of a document.

**Endpoint:** `GET /api/documents/:id/revisions`

**Response:**
```json
{
  "success": true,
  "revisions": [
    {
      "id": "revision-uuid",
      "revision_number": 3,
      "content_snapshot": {/* TipTap JSON */},
      "created_by": "user-id",
      "change_summary": "Updated methodology section",
      "created_at": "2025-11-03T09:00:00Z",
      "users": {
        "name": "John Doe"
      }
    }
  ]
}
```

### Create Revision
Manually create a version snapshot.

**Endpoint:** `POST /api/documents/:id/create-revision`

**Body:**
```json
{
  "change_summary": "Major revision - added results"
}
```

**Response:**
```json
{
  "success": true,
  "revision": {
    "id": "revision-uuid",
    "revision_number": 4,
    "created_at": "2025-11-03T10:30:00Z"
  }
}
```

### Delete Document
Permanently delete a document (owner only).

**Endpoint:** `DELETE /api/documents/:id`

**Response:**
```json
{
  "success": true,
  "message": "Document deleted successfully"
}
```

### List Workspace Documents
Get all documents in a workspace.

**Endpoint:** `GET /api/documents/workspace/:workspaceId`

**Response:**
```json
{
  "success": true,
  "documents": [
    {
      "id": "doc-uuid",
      "title": "My IEEE Paper",
      "type": "ieee",
      "owner": {
        "name": "John Doe",
        "email": "john@example.com"
      },
      "updated_at": "2025-11-03T10:00:00Z"
    }
  ]
}
```

---

## Pin/Unpin Papers

### Pin Paper to Workspace
Add a paper to workspace's pinned collection.

**Endpoint:** `POST /api/workspaces/:id/pin`

**Permissions:** Owner or Editor

**Body:**
```json
{
  "paper_id": "paper-uuid",
  "notes": "Important for methodology section",
  "tags": ["machine-learning", "nlp"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "pin-uuid",
    "workspace_id": "workspace-uuid",
    "paper_id": "paper-uuid",
    "added_by": "user-id",
    "notes": "Important for methodology section",
    "tags": ["machine-learning", "nlp"],
    "added_at": "2025-11-03T10:00:00Z"
  },
  "message": "Paper pinned successfully"
}
```

### Unpin Paper from Workspace
Remove a paper from workspace's pinned collection.

**Endpoint:** `DELETE /api/workspaces/:id/unpin`

**Permissions:** Owner or Editor

**Body:**
```json
{
  "paper_id": "paper-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Paper unpinned successfully"
}
```

### List Pinned Papers
Get all papers pinned to a workspace.

**Endpoint:** `GET /api/workspaces/:id/pins`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "pin-uuid",
      "paper_id": "paper-uuid",
      "notes": "Important for methodology",
      "tags": ["ml", "nlp"],
      "added_at": "2025-11-03T10:00:00Z",
      "papers": {
        "id": "paper-uuid",
        "title": "Attention Is All You Need",
        "authors": ["Vaswani et al."],
        "abstract": "We propose a new...",
        "publication_date": "2017-06-12",
        "url": "https://arxiv.org/abs/1706.03762",
        "doi": "10.48550/arXiv.1706.03762"
      }
    }
  ],
  "count": 1
}
```

---

## Humanizer

### Humanize Text
Transform AI-generated text to sound more natural and human-written.

**Endpoint:** `POST /api/humanize`

**Authentication:** Required (JWT)

**Body:**
```json
{
  "text": "The implementation of artificial intelligence algorithms...",
  "workspace_id": "workspace-uuid",
  "provider": "cerebras"
}
```

**Providers:**
- `cerebras` - Cerebras LLaMA 3.1 (fast, requires `CEREBRAS_API_KEY`)
- `huggingface` - HuggingFace BART (requires `HF_API_KEY`)
- Fallback: Rule-based transformation (no API key needed)

**Limits:**
- Max tokens: ~2000 (≈8000 characters)
- Longer text will return 400 error

**Response:**
```json
{
  "success": true,
  "humanized_text": "When implementing AI algorithms...",
  "ai_detection_score": 35,
  "original_length": 245,
  "humanized_length": 248,
  "improvement_score": 65,
  "processing_time_ms": 1234,
  "provider": "cerebras"
}
```

**AI Detection Score:**
- 0-30: Very human-like
- 31-60: Moderately human-like
- 61-100: Still detectable as AI-generated

**Database Logging:**
All humanizer requests are logged to `humanizer_logs` table including:
- Input/output text
- Provider and model used
- Token counts
- Processing time
- Success/error status

---

## Error Handling

### Standard Error Response
```json
{
  "success": false,
  "message": "Human-readable error message",
  "error": "Technical error details"
}
```

### Common HTTP Status Codes

**400 Bad Request**
- Missing required fields
- Invalid input format
- Text exceeds token limit

**401 Unauthorized**
- Missing or invalid JWT token
- Token expired

**403 Forbidden**
- User lacks permission for action
- Not a workspace member
- Insufficient role (e.g., viewer trying to edit)

**404 Not Found**
- Document/workspace doesn't exist
- Resource deleted

**500 Internal Server Error**
- Database error
- External API failure (Cerebras, HuggingFace)
- Unexpected server error

### Example Error Responses

**Missing Authentication:**
```json
{
  "success": false,
  "message": "Authentication required"
}
```

**Insufficient Permissions:**
```json
{
  "success": false,
  "message": "Only owners and editors can pin papers"
}
```

**Resource Not Found:**
```json
{
  "success": false,
  "message": "Document not found"
}
```

**Validation Error:**
```json
{
  "success": false,
  "message": "paper_id is required"
}
```

---

## Environment Variables

Required environment variables for full functionality:

```bash
# Supabase (Required)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# AI Providers (Optional - at least one recommended)
CEREBRAS_API_KEY=your-cerebras-key
HF_API_KEY=your-huggingface-key

# Server
PORT=3000
NODE_ENV=production
```

---

## Rate Limits

Currently no rate limits enforced. Consider implementing:
- Humanizer: 100 requests/hour per user
- Documents: 1000 requests/hour per user
- Workspaces: 100 requests/hour per user

---

## Changelog

### v1.1.0 (2025-11-03)
- ✅ Added pin/unpin paper endpoints
- ✅ Enhanced humanizer with JWT auth
- ✅ Added humanizer database logging
- ✅ Created document service layer
- ✅ Added chart_exports and humanizer_logs tables

### v1.0.0 (2025-11-01)
- Initial release
- Workspace management
- Collaborative document editing
- Real-time collaboration (Y.js)
- Version control and revisions

---

## Support

For issues or questions:
- GitHub Issues: [ResearchAI Issues](https://github.com/vi3318/Research-AI/issues)
- Email: support@researchai.com

# 🚀 Quick Collaboration Testing Guide

## Test 1: Content Persistence (Single User)

### Steps:
1. Create a new IEEE template or blank document
2. Type some content: "This is my research paper"
3. Wait for auto-save (5 seconds) - see "Saved" indicator
4. **Switch to another browser tab** (Gmail, YouTube, etc.)
5. **Switch back** to the document tab
6. ✅ **Expected**: Content still there!
7. **Reload the page** (Cmd+R or Ctrl+R)
8. ✅ **Expected**: Content still there!

**This confirms:** Content persistence is working

---

## Test 2: Real-Time Collaboration (Two Users)

### Prerequisites:
- Two user accounts with different emails
- Two browsers OR two computers OR incognito + normal browser

### Setup (User A - Document Owner):
1. Login as User A
2. Create IEEE template document
3. Type something: "Introduction to AI"
4. Click **Share** button (top right)
5. Enter User B's email
6. Select role: "Editor"
7. Click Add
8. ✅ User B should appear in collaborators list

### Test Collaboration (User B - Collaborator):
1. Login as User B in different browser/incognito
2. Open the shared document (should appear in "My Documents")
3. You should see the "Introduction to AI" content

### Test Live Updates:
1. **User A**: Type "Abstract: This paper discusses..."
2. **Wait 5 seconds** (auto-save happens)
3. **User B**: Watch for toast notification "Document updated by collaborator"
4. **User B**: Content should now show the new text

### Test Reverse (B → A):
1. **User B**: Type "Keywords: AI, Machine Learning"
2. **Wait 5 seconds**
3. **User A**: Should see "Document updated by collaborator"
4. **User A**: Content now includes keywords

### Test Title Sync:
1. **User A**: Click document title, rename to "My AI Paper"
2. **User B**: Should see "Document title updated by collaborator"
3. **User B**: Title now shows "My AI Paper"

---

## Test 3: Remove Collaborator

### User A (Owner):
1. Click **Share** button
2. Find User B in collaborators list
3. **Hover** over User B's card
4. Click **X button** (red, appears on hover)
5. Confirm removal
6. ✅ User B should disappear from list

### User B (Former Collaborator):
1. Try to access the document
2. ✅ **Expected**: Should get "Access denied" or document disappears

---

## Expected Behavior

### ✅ What Works:
- Content persists across tab switches
- Content persists across page reloads
- Content persists across browser restarts
- Multiple users can edit same document
- Changes sync between users (1-2 second delay)
- Title updates sync between users
- Remove collaborator works
- Auto-save every 5 seconds
- Offline editing with sync queue

### ⏳ What's Delayed (Normal):
- Changes appear after 1-2 seconds (not instant)
- This is because we use database polling, not WebSocket CRDT
- Still excellent for research paper collaboration!

### ❌ What Doesn't Work Yet:
- Live cursors showing where collaborator is typing
- Instant updates (<100ms) - requires Y.js server
- "User X is typing..." indicators

---

## Troubleshooting

### Problem: Content disappears after tab switch
**Solution**: 
- Make sure document saved (see "Saved" indicator)
- Check browser console for errors (F12)
- Refresh page - should load from database

### Problem: Collaborator not seeing updates
**Checklist**:
- ✅ Wait 5 seconds for auto-save
- ✅ Collaborator has "Editor" role (not Viewer)
- ✅ Both users have internet connection
- ✅ Check browser console for errors
- ✅ Try manual refresh on collaborator's browser

### Problem: Can't add collaborator
**Checklist**:
- ✅ Email is valid format (user@example.com)
- ✅ User exists in system (they must have created account)
- ✅ Not adding yourself
- ✅ Internet connection working

### Problem: Share button not appearing
**Checklist**:
- ✅ You are the document owner
- ✅ Document has been saved
- ✅ You're logged in

---

## For Demo/Presentation

### Demo Script (2 minutes):

**Setup** (30 seconds):
1. "I'll create a new research paper using our IEEE template"
2. "Notice the auto-formatting and structure"

**Share** (30 seconds):
3. "Now I'll share this with my colleague"
4. "I enter their email and give them Editor permissions"
5. "They can now access this document from their account"

**Collaborate** (1 minute):
6. "Watch as I type in the Introduction section"
7. [Type some content]
8. "After a few seconds, my colleague sees my changes"
9. [Switch to collaborator screen]
10. "Here's their view - the content automatically synced"
11. "They can type too, and I'll see their changes"

**Key Points to Mention**:
- ✅ "Uses Supabase Realtime for live synchronization"
- ✅ "Content persists even if browser crashes"
- ✅ "Works offline - changes sync when reconnected"
- ✅ "Role-based permissions for security"
- ✅ "Auto-save every 5 seconds to prevent data loss"

---

## Technical Notes

### Auto-Save Timing:
```
User types → Wait 5 seconds → Save to database → Broadcast update → Other users receive
```

### Database Schema:
```sql
documents table:
  - last_edited_by: tracks who made last change
  - updated_at: timestamp for change detection

document_content table:
  - content: JSONB with full editor state
  - last_edited_by: prevents self-reloading
```

### Real-Time Channels:
```typescript
Channel: document:{documentId}
Listens to:
  - documents table UPDATE events
  - document_content table UPDATE events
  - presence sync (who's online)
```

---

## Success Criteria ✅

Your collaboration is working if:
- [x] Content persists after tab switch
- [x] Content persists after page reload
- [x] Can add collaborator by email
- [x] Collaborator can see document
- [x] Changes sync between users (1-2 sec)
- [x] Can remove collaborator
- [x] Auto-save works (every 5 sec)
- [x] Offline editing queues changes

**All checked? You're ready to submit! 🎉**

# 🧪 Quick Test: Real-Time Collaboration

## Prerequisites
- 2 different email accounts (e.g., alice@test.com, bob@test.com)
- 2 browsers OR 1 browser normal + 1 incognito window

---

## Test 1: Share Document (30 seconds)

### User A (Owner):
1. ✅ Login
2. ✅ Create IEEE template OR blank document
3. ✅ Type something: "Test Document"
4. ✅ Click **Share** button (top right toolbar)
5. ✅ Enter User B's email
6. ✅ Select role: **Editor**
7. ✅ Click **Add**
8. ✅ See "1 Collaborator • Real-time sync active" badge

### User B (Collaborator):
1. ✅ Login in second browser
2. ✅ Document appears in "My Documents"
3. ✅ Click to open
4. ✅ See "Test Document" content

**Expected:**
- ✅ ONE toast: "Document ready - Real-time collaboration enabled"
- ✅ NO "single-user mode" message
- ✅ Blue badge showing "1 Collaborator • Real-time sync active"

---

## Test 2: Real-Time Sync (1 minute)

### User A types:
```
Introduction:
This is a test of real-time collaboration.
```

### Wait 5 seconds (auto-save delay)

### User B should see:
- ✅ Toast: "Document updated by collaborator"
- ✅ Content appears automatically
- ✅ "Saved ✓" indicator

### Now User B types:
```
Methods:
We tested with two users simultaneously.
```

### Wait 5 seconds

### User A should see:
- ✅ Toast: "Document updated by collaborator"
- ✅ Methods section appears
- ✅ No content loss or conflicts

---

## Test 3: Simultaneous Editing (1 minute)

### Both users type at the SAME TIME:

**User A:**
```
Abstract: AI research
```

**User B:**
```
Keywords: Machine Learning, NLP
```

### Wait 10 seconds (both auto-saves complete)

### Both users should see:
- ✅ BOTH changes present
- ✅ No overwrites
- ✅ Y.js CRDT merged automatically
- ✅ Document has Abstract AND Keywords

---

## Test 4: Content Persistence (30 seconds)

### User A:
1. ✅ Switch to different browser tab (Gmail, YouTube)
2. ✅ Switch back to document tab
3. ✅ Content still there!
4. ✅ Reload page (Cmd+R / Ctrl+R)
5. ✅ Content still there!
6. ✅ Close browser, reopen
7. ✅ Content still there!

**Expected:**
- ✅ ONE toast on reload: "Document ready - Real-time collaboration enabled"
- ✅ Content fully restored from database

---

## Test 5: Remove Collaborator (30 seconds)

### User A (Owner):
1. ✅ Click **Share** button
2. ✅ See User B in collaborators list
3. ✅ Hover over User B's card
4. ✅ Click **X** button (red, appears on hover)
5. ✅ Confirm removal
6. ✅ User B disappears from list
7. ✅ Badge now gone (no collaborators)

### User B:
1. ✅ Try to access document
2. ✅ Should get access denied or document disappears

---

## ✅ Success Criteria

Your collaboration is working perfectly if:

- [x] **Share works:** Can add collaborator by email
- [x] **Sync works:** Changes appear in 1-2 seconds
- [x] **Both directions:** A→B and B→A both sync
- [x] **No conflicts:** Simultaneous edits merge correctly
- [x] **Persistence:** Content survives tab switch/reload
- [x] **One toast:** Only "Document ready - Real-time collaboration enabled"
- [x] **Badge shows:** "X Collaborators • Real-time sync active"
- [x] **Remove works:** Can remove collaborator
- [x] **Auto-save:** "Saved ✓" appears after typing stops

---

## 🐛 If Something's Wrong

### Collaborator not seeing updates:
1. Wait full 5 seconds for auto-save
2. Check "Saved ✓" indicator appears
3. Refresh collaborator's browser
4. Check internet connection
5. Open browser console (F12) - look for errors

### Multiple toasts appearing:
1. Hard refresh (Cmd+Shift+R / Ctrl+Shift+R)
2. Clear browser cache
3. Should be fixed in latest code

### Content disappearing:
1. Check auto-save completed ("Saved ✓")
2. Refresh page
3. Should reload from database
4. Should be fixed in latest code

### "Single-user mode" message:
1. Hard refresh browser
2. Should be removed in latest code

---

## 🎯 Quick Demo Script

**For presentation/submission:**

1. "I'll create a research paper and share it with my colleague"
   - Create document
   - Add collaborator

2. "Watch as I type - my colleague sees it in real-time"
   - Type content
   - Show collaborator screen updating

3. "They can edit too - our changes merge automatically"
   - Collaborator types
   - Show your screen updating
   - Point out CRDT conflict resolution

4. "Notice the collaboration badge and auto-save status"
   - Point to "1 Collaborator • Real-time sync active"
   - Point to "Saved ✓" indicator

5. "Works offline - changes sync when reconnected"
   - Mention offline queue feature

**Done in 2 minutes!** 🎉

---

## 📱 Testing Shortcuts

### Quick Setup:
```
Browser 1: localhost:5173 (User A - alice@test.com)
Browser 2: Incognito (User B - bob@test.com)
```

### Quick Test:
```
1. A creates IEEE doc → shares to B
2. A types "Hello" → wait 5 sec → B sees it
3. B types "World" → wait 5 sec → A sees it
4. Both type simultaneously → both see merged result
```

### Expected Time:
- Setup: 1 minute
- Test sync: 1 minute  
- **Total: 2 minutes to verify everything works!**

---

## ✅ You're Done!

If all tests pass, your **real-time collaboration is production-ready**! 🚀

Features working:
- ✅ Multi-user editing
- ✅ Real-time sync (1-2 sec)
- ✅ Conflict resolution (Y.js CRDT)
- ✅ Content persistence
- ✅ Share/remove collaborators
- ✅ Auto-save
- ✅ Offline support

**Ready for submission tomorrow! 🎊**

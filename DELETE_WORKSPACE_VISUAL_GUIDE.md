# 🎨 Delete Workspace Feature - Visual Guide

## UI Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    WORKSPACE LIST PAGE                      │
│                                                             │
│  ┌──────────────────┐  ┌──────────────────┐               │
│  │  Workspace 1     │  │  Workspace 2     │               │
│  │                  │  │                  │  [HOVER]       │
│  │  Research AI     │  │  ML Project      │               │
│  │  5 members       │  │  3 members       │               │
│  │                  │  │              🗑️  │ ← Delete icon  │
│  │  [Member]        │  │  [Owner]         │   appears      │
│  └──────────────────┘  └──────────────────┘               │
│                             ↓ CLICK DELETE                  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   CONFIRMATION MODAL                        │
│  ┌───────────────────────────────────────────────────────┐ │
│  │                    🚨                                  │ │
│  │                                                        │ │
│  │              Delete Workspace?                        │ │
│  │                                                        │ │
│  │   Are you sure you want to delete this workspace?    │ │
│  │   This action cannot be undone. All documents,       │ │
│  │   notes, and data will be permanently deleted.       │ │
│  │                                                        │ │
│  │   ┌──────────┐         ┌──────────────────┐          │ │
│  │   │  Cancel  │         │ Delete Workspace │          │ │
│  │   └──────────┘         └──────────────────┘          │ │
│  │                                                        │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              ↓ CLICK DELETE
┌─────────────────────────────────────────────────────────────┐
│                    DELETING STATE                           │
│  ┌───────────────────────────────────────────────────────┐ │
│  │                    🚨                                  │ │
│  │                                                        │ │
│  │              Delete Workspace?                        │ │
│  │                                                        │ │
│  │   Are you sure you want to delete this workspace?    │ │
│  │   This action cannot be undone.                      │ │
│  │                                                        │ │
│  │   ┌──────────┐         ┌──────────────────┐          │ │
│  │   │  Cancel  │         │ ⟳ Deleting...    │          │ │
│  │   │ DISABLED │         │    LOADING       │          │ │
│  │   └──────────┘         └──────────────────┘          │ │
│  │                                                        │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              ↓ SUCCESS
┌─────────────────────────────────────────────────────────────┐
│                   WORKSPACE LIST PAGE                       │
│                                                             │
│  ┌──────────────────┐                                      │
│  │  Workspace 1     │  ← Workspace 2 is gone!             │
│  │                  │                                      │
│  │  Research AI     │  ┌────────────────────────────────┐ │
│  │  5 members       │  │ ✅ Workspace deleted           │ │
│  │                  │  │    successfully                │ │
│  │  [Member]        │  └────────────────────────────────┘ │
│  └──────────────────┘  ← Toast notification               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Color Scheme

### Delete Button (Normal State):
- Icon Color: `text-gray-400` (#9CA3AF)
- Background: Transparent
- Hover Icon: `text-red-600` (#DC2626)
- Hover Background: `bg-red-50` (#FEF2F2)
- Visibility: `opacity-0` (hidden) → `opacity-100` (visible on hover)

### Confirmation Modal:
- Backdrop: `bg-black/50` with `backdrop-blur-sm`
- Modal Background: `bg-white` (#FFFFFF)
- Warning Icon Background: `bg-red-100` (#FEE2E2)
- Warning Icon Color: `text-red-600` (#DC2626)

### Buttons:
- **Cancel Button:**
  - Background: Transparent
  - Border: `border-gray-300` (#D1D5DB)
  - Text: `text-gray-700` (#374151)
  - Hover: `hover:bg-gray-50` (#F9FAFB)

- **Delete Button:**
  - Background: `bg-red-600` (#DC2626)
  - Text: `text-white` (#FFFFFF)
  - Hover: `hover:bg-red-700` (#B91C1C)

---

## Hover States

### Workspace Card:
```
DEFAULT:
┌────────────────────┐
│  Workspace Name    │
│  Description       │
│  Stats             │
│  [Owner]           │
└────────────────────┘

HOVER (Owner):
┌────────────────────┐
│  Workspace Name 🗑️│ ← Delete icon fades in
│  Description       │
│  Stats             │
│  [Owner]           │
└────────────────────┘

HOVER (Non-Owner):
┌────────────────────┐
│  Workspace Name    │ ← No delete icon
│  Description       │
│  Stats             │
│  [Member]          │
└────────────────────┘
```

---

## Animation Timeline

### Modal Opening:
```
0ms:    opacity: 0, scale: 0.95
200ms:  opacity: 1, scale: 1
```

### Modal Closing:
```
0ms:    opacity: 1, scale: 1
200ms:  opacity: 0, scale: 0.95
```

### Delete Icon:
```
0ms:    opacity: 0
200ms:  opacity: 1 (on hover)
```

---

## Responsive Breakpoints

### Mobile (< 640px):
```
┌─────────────────┐
│   Workspace 1   │
│                 │
│   Research AI   │
│   5 members  🗑️│
│                 │
│   [Owner]       │
└─────────────────┘

Modal: Full width with padding
```

### Tablet (640px - 1024px):
```
┌─────────────┐  ┌─────────────┐
│ Workspace 1 │  │ Workspace 2 │
│             │  │          🗑️│
│ Research AI │  │ ML Project  │
│ 5 members   │  │ 3 members   │
│             │  │             │
│ [Member]    │  │ [Owner]     │
└─────────────┘  └─────────────┘

Modal: Max-width 448px
```

### Desktop (> 1024px):
```
┌──────────┐  ┌──────────┐  ┌──────────┐
│ Work 1   │  │ Work 2🗑️│  │ Work 3   │
│          │  │          │  │          │
│ Research │  │ ML Proj  │  │ Data Sci │
│ 5 mem    │  │ 3 mem    │  │ 7 mem    │
│          │  │          │  │          │
│ [Member] │  │ [Owner]  │  │ [Admin]  │
└──────────┘  └──────────┘  └──────────┘

Modal: Max-width 448px, centered
```

---

## Icon Reference

### Trash2 Icon (Delete):
```
  ____
 |    |  ← Lid
 |    |
 | || |  ← Trash can with vertical lines
 |____|
```
- Size: `h-4 w-4` (16px × 16px)
- Stroke width: 2px
- Source: `lucide-react`

### X Icon (Close Modal):
```
 \  /
  \/
  /\
 /  \
```
- Size: `h-5 w-5` (20px × 20px)
- Stroke width: 2px
- Source: `lucide-react`

### AlertTriangle Icon (Warning):
```
    /\
   /  \
  /    \
 / !    \
/_______\
```
- Size: `h-8 w-8` (32px × 32px)
- Fill: Red (#DC2626)
- Background circle: Red-100 (#FEE2E2)
- Source: `lucide-react`

---

## Interactive States

### Delete Button States:
1. **Hidden** (default) - `opacity-0`
2. **Visible** (on card hover) - `opacity-100`
3. **Hover** (on button hover) - Red icon + red background
4. **Active** (on click) - Scale down slightly

### Modal Button States:
1. **Default** - Normal colors
2. **Hover** - Darker background
3. **Active** - Pressed effect
4. **Disabled** (during deletion) - Reduced opacity, no pointer events

### Card States:
1. **Default** - White background, light shadow
2. **Hover** - Larger shadow, delete icon appears
3. **Deleting** - Stays visible until success
4. **Deleted** - Removed from DOM instantly

---

## Toast Notification

### Success Toast:
```
┌────────────────────────────────────┐
│ ✅ Workspace deleted successfully  │
└────────────────────────────────────┘
```
- Position: Top-center
- Duration: 3 seconds
- Background: Green
- Icon: Check mark

### Error Toast:
```
┌────────────────────────────────────┐
│ ❌ Failed to delete workspace      │
└────────────────────────────────────┘
```
- Position: Top-center
- Duration: 5 seconds
- Background: Red
- Icon: X mark

---

## Accessibility Features

### Keyboard Navigation:
- Tab to delete button
- Enter/Space to click
- Tab to modal buttons
- ESC to close modal (optional enhancement)

### Screen Reader:
- Delete button: "Delete workspace"
- Modal title: "Delete Workspace?"
- Modal message: Full warning text
- Buttons: "Cancel" / "Delete Workspace"

### Focus States:
- Delete button: Blue outline on focus
- Modal buttons: Blue outline on focus
- Modal backdrop: Click to close

---

## Component Structure

```
WorkspaceList.tsx
├── State Management
│   ├── workspaces (array)
│   ├── currentUserId (string | null)
│   ├── deleteModalOpen (boolean)
│   ├── workspaceToDelete (string | null)
│   └── isDeleting (boolean)
│
├── Functions
│   ├── getCurrentUser()
│   ├── loadWorkspaces()
│   ├── handleDeleteClick()
│   ├── handleDeleteConfirm()
│   └── handleDeleteCancel()
│
└── Render
    ├── Header
    ├── Search Bar
    ├── Workspace Grid
    │   └── WorkspaceCard (×N)
    │       └── Delete Button (conditional)
    └── DeleteConfirmModal

DeleteConfirmModal.tsx
├── Props
│   ├── isOpen
│   ├── onClose
│   ├── onConfirm
│   ├── title
│   ├── message
│   ├── confirmText
│   ├── cancelText
│   └── isDeleting
│
└── Render
    ├── Backdrop (click to close)
    └── Modal
        ├── Close Button (X)
        ├── Warning Icon
        ├── Title
        ├── Message
        └── Action Buttons
            ├── Cancel
            └── Delete (with loading state)
```

---

## Data Flow

```
User Action → Component State → Supabase → Database → UI Update

1. User hovers card
   ↓
2. isOwner check
   ↓
3. Show delete button
   ↓
4. User clicks delete
   ↓
5. setWorkspaceToDelete(id)
   ↓
6. setDeleteModalOpen(true)
   ↓
7. Modal renders
   ↓
8. User clicks confirm
   ↓
9. setIsDeleting(true)
   ↓
10. supabase.delete()
    ↓
11. Cascade delete (workspace_users, documents)
    ↓
12. Update local state (filter out deleted)
    ↓
13. setIsDeleting(false)
    ↓
14. setDeleteModalOpen(false)
    ↓
15. Show success toast
    ↓
16. Card disappears from grid
```

---

## File Sizes

- `DeleteConfirmModal.tsx`: ~4 KB
- `WorkspaceList.tsx` (updated): +2 KB
- Total added: ~6 KB

---

## Browser Compatibility

- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

---

*Visual Guide - November 3, 2025*

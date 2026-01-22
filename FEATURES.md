# Features

This document tracks implemented features in Kino, organized by major feature area.

---

## Authentication & Users

### Authentication
- GitHub OAuth via Better Auth
- Session management with sign-in/sign-out flows
- Redirect preservation through auth flow (`?redirect=` param)

### User Profiles
- Username, display name, and avatar
- Profile editing and picture uploads (Cloudflare R2)
- Super admin role support (`system:admin`)
- Public profile pages (`/profile/$username`)

---

## Organizations

### Organization Management
- Create and update organizations
- Slug-based routing (`/@{org}`)
- Organization settings page

### Organization Membership
- Role-based access: `admin`, `editor`, `viewer`
- Automatic project member sync on org role changes

---

## Projects

### Project Management
- Create projects within organizations
- Visibility settings: public, private, archived
- Slug-based routing (`/@{org}/$project`)
- Project settings and configuration

### Project Membership
- Role-based permissions: `admin`, `org:admin`, `org:editor`, `viewer`
- Member assignment and management
- Permission-based UI (edit controls hidden for viewers)

### Default Content
- Auto-created feedback boards on project creation (Bugs, Improvements, Feature Requests)

---

## Feedback System

### Feedback Items
- Create feedback with title and initial comment
- Rich text editor (TipTap/ProseMirror)
- Full-text search on title and content
- Pagination with board filtering
- Slug-based detail pages

### Feedback Status
- Statuses: `open`, `in-progress`, `paused`, `completed`, `closed`
- Status changes logged as events
- Colored status icons throughout UI

### Feedback Boards
- Custom boards per project
- Board icons and names
- Move feedback between boards
- Cascade delete (feedback deleted with board)

### Feedback Assignment
- Assign to team members with edit permissions
- Assignment changes logged as events
- AssigneeSwitcher component with dropdown

### Feedback Upvotes
- Toggle upvote/un-upvote
- Optimistic UI updates with rollback on error
- Upvote count displayed on cards and detail page
- Unauthenticated users redirected to sign-in
- Aggregate-based counting (`@convex-dev/aggregate`)

### Comments
- Post comments on feedback
- Edit own comments
- Rich text with markdown support
- Permalink to specific comments (hash-based scroll)
- **Draft persistence**: Unsubmitted comments saved to localStorage (debounced)

### Comment Reactions
- Emoji reactions on comments
- Toggle reactions (add/remove)
- Reaction counts with user tracking

### Answer Marking
- Mark a comment as the official answer
- Visual distinction for answered feedback

### Event Timeline
- Track: status changes, board moves, assignments, answer marking
- Event coalescing within 60-second windows
- Actor information displayed

---

## Feedback Detail Page

### Header
- Title with status icon
- Creation time and upvote count
- Upvote button

### Sidebar

#### Collapsible Sections
- Sections: Details, People, Labels, Related
- Collapse state persisted in localStorage
- Hover states on section headers
- Section icons (Settings, Users, Tag, Link)

#### Details Section
- Status switcher (dropdown with colored icons)
- Board switcher (dropdown)
- Priority (placeholder)
- Due date (placeholder)

#### People Section
- Assignee switcher (dropdown)
- Author with link to profile
- Watchers (placeholder)

#### Labels Section
- Label badges with colors (placeholder)
- Add label button (placeholder)

#### Related Section
- Linked feedback items (placeholder)
- Link related feedback button (placeholder)

### Main Content
- First comment (original post) with author badge
- Comments timeline with events interspersed
- Comment form with draft persistence

---

## UI Components

### Switcher Components
- `StatusSwitcher`: Outline button with colored status icon dropdown
- `BoardSwitcher`: Outline button with board icon dropdown
- `AssigneeSwitcher`: Outline button with avatar dropdown
- `UpvoteButton`: Toggle button with optimistic updates, compact variant available

### Editor
- TipTap-based markdown editor
- Blockquote insertion
- Submit shortcut support
- Borderless variant for inline use

---

## Global Features

### Data Persistence
- Sidebar collapse state in localStorage
- Comment drafts in localStorage (keyed by org/project/feedback slug)

### Real-time Updates
- TanStack Query + Convex integration
- Optimistic updates with error rollback

### Permissions
- Multi-level access control (org → project → feedback)
- UI adapts based on permissions (edit controls hidden for viewers)

---

## Infrastructure

### Backend
- Convex serverless functions
- Zod schemas with `zodToConvex` conversion
- Trigger system for cascade operations
- TableAggregate for efficient counting

### Storage
- Cloudflare R2 for file uploads
- Signed URLs for secure access

### Deployment
- Cloudflare Workers
- TanStack Start (React meta-framework)

---

## Planned / Placeholder Features

These features have UI placeholders but are not yet implemented:

- [ ] Priority levels for feedback
- [ ] Due dates for feedback
- [ ] Labels/tags system
- [ ] Watchers/subscribers
- [ ] Related feedback linking
- [ ] View counts

---

## Changelog

### January 2025

**Feedback Upvotes**
- Toggle upvote system with optimistic updates
- Aggregate-based counting for performance
- Upvote button on cards and detail page

**Sidebar Redesign**
- Collapsible sections with localStorage persistence
- Simplified design (border-b headers, no cards)
- Hover states on collapse triggers
- Section icons

**Switcher Components**
- AssigneeSwitcher with outline button and dropdown
- StatusSwitcher updated with colored icons
- BoardSwitcher updated with outline variant

**Comment Drafts**
- localStorage persistence for unsubmitted comments
- Keyed by org/project/feedback slug
- 500ms debounce on saves
- Auto-clear on submit

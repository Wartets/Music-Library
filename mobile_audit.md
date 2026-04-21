# Mobile UX Audit (April 21, 2026)

## Scope checked
- Global mobile navigation (`src/components/layout/MobileTabBar.tsx`)
- Global layout spacing/safe area (`src/components/layout/AppLayout.tsx`)
- Mobile playback controls (`src/components/layout/PlayerBar.tsx`)
- Primary mobile list browsing flow (`src/components/library/LibraryBrowser.tsx`)

## Problems found

### 1) Missing global search entry point on mobile
- **Where:** `src/components/layout/MobileTabBar.tsx`, `src/components/layout/Sidebar.tsx`
- **Problem:** Global library search exists only in desktop sidebar. On mobile, sidebar is hidden and there is no direct search action from the tab bar.
- **Impact:** Core discovery flow is harder/impossible from phone unless user manually navigates to specific filtered views.
- **Fix plan:** Add a mobile search input/action in the "More" sheet that sets global query and navigates to `SearchResults`.
- **Status:** Resolved
- **Applied fix:** Added "Search library" input + Go action in mobile "More" sheet, wired to `setSearchQuery(...)` and `onNavigate('SearchResults', { query, sourceView })`.
- **Files:** `src/components/layout/MobileTabBar.tsx`, `src/components/layout/AppLayout.tsx`

### 2) "More" sheet can become cramped on small-height phones
- **Where:** `src/components/layout/MobileTabBar.tsx`
- **Problem:** The "More" sheet has fixed layout without constrained max height + internal scrolling.
- **Impact:** Some actions may be harder to reach on short screens / landscape.
- **Fix plan:** Add max-height and internal scroll region with safe bottom spacing.
- **Status:** Resolved
- **Applied fix:** Added `max-h` + `overflow-y-auto` to More views grid so short-height phones can still access all actions.
- **Files:** `src/components/layout/MobileTabBar.tsx`

### 3) Mobile compact player bar touch area is too tight in compact mode
- **Where:** `src/components/layout/PlayerBar.tsx`
- **Problem:** Compact mode height and stacked utility controls can feel cramped, especially with all controls present.
- **Impact:** Reduced touch comfort and possible crowding on smaller phones.
- **Fix plan:** Slightly rebalance compact mobile height and utility row spacing while keeping all controls.
- **Status:** Resolved
- **Applied fix:** Rebalanced compact/non-compact mobile player bar heights and increased utility control touch targets + slider width.
- **Files:** `src/components/layout/PlayerBar.tsx`

---

## Execution order
1. Fix missing mobile global search entry point.
2. Make "More" sheet robust on short-height devices.
3. Rebalance compact mobile player bar touch comfort.
4. Run build + diagnostics.
5. Mark all items resolved here.

## Resolution summary
- All listed mobile issues in this audit have been fixed.
- Build validation and diagnostics are required after patch application.

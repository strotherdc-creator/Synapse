# Today's Plan — Merge & Completion Plan

## What This Document Is

A step-by-step implementation plan for merging Daily Routine into Today's Plan and completing all missing functionality. **No code will be written until this plan is approved.**

---

## Current State (Problems)

| Issue | Root Cause |
|-------|-----------|
| "From Your Coaching" shows garbage ("I'm stuck help me write it") | Pulls any saved answer regardless of length/quality; user hasn't completed modules |
| "Content to Share" says "Post/send your social post" with no actual content | User hasn't picked a topic yet, and the system doesn't default to one |
| Daily Routine and Today's Plan are separate pages | Two pages doing overlapping things confuses the doctor |
| No way to pick 3 daily commitments | The system assigns 3 random cards instead of letting the doctor choose |
| No curriculum completion reminder | Doctor doesn't know what's left to finish |
| Topic-based content not showing | Plan was cached before topic selection; also no default topic assigned |

---

## Target State (What the Doctor Sees)

### Page: "Today's Plan" (replaces both Today's Plan AND Daily Routine)

**Section 1: Streak & Progress Bar**
- Current streak (days), best streak, today's completion count
- Same streak/progress logic from Daily Routine (reused)

**Section 2: Lyle's Recommendation (from WWLD stats)**
- One priority action based on their trend state
- Tied to their stats — e.g., "Your new patients are breaking — ask for a referral today"
- This is the existing Lyle card, unchanged

**Section 3: Pick Your 3 Daily Actions**
- Doctor sees a menu of action categories and picks 3 (minimum) to commit to today
- Categories:
  - 📱 **Post to social media** — shows their topic-based post with copy button + visual guidance
  - 🎬 **Make a short video** — shows topic-based video script (30-60 sec bullet points)
  - 🤝 **Ask for a referral** — shows their referral trigger line (from topic or modules)
  - 📞 **Outreach to a patient** — recall/check-in/follow-up prompt
  - 🏘️ **Community connection** — connect with a local business or referral source
  - 📚 **Complete a curriculum lesson** — links to their next incomplete module
  - 💬 **Ask the AI Coach** — links to the Lyle-based AI chat
- Once they pick 3, those become their checkboxes for the day
- They can change their picks until they check one off

**Section 4: Today's Checklist (their 3 picks)**
- Each picked action expands to show the actual content:
  - Social post → full text + copy button + photo/video/AI image suggestion
  - Video → bullet point script + topic
  - Referral → their referral trigger line + intro script
  - Patient outreach → suggested message template
  - Community → suggested connection approach
  - Curriculum → direct link to next lesson
  - AI Coach → link to /chat
- Check them off as they complete them → streak updates

**Section 5: Curriculum Reminder (bottom)**
- Shows incomplete modules with progress bars
- "Complete your modules for fully customized content"
- Links directly to each incomplete module

---

## Data Flow

```
Doctor opens /today
  → Check: has topic selected?
    → No: auto-assign "general_corrective" as default (not blank)
    → Yes: use their topic
  → Check: has modules completed?
    → Yes: pull their real positioning, one-liners, referral language
    → No: use pre-built topic content
  → Check: has 3 actions picked today?
    → No: show the action picker
    → Yes: show their checklist with expanded content
  → Lyle card: always shows (from WWLD stats)
  → Curriculum reminder: always shows if modules incomplete
```

---

## Server Changes

### 1. New procedure: `engagement.pickDailyActions`
- Input: `{ actions: string[] }` (array of 3+ action category keys)
- Saves to `growth_actions` table with source="picked"
- Returns the saved actions with their expanded content

### 2. Modified: `buildDailyActions` function
- Remove the current "guess 3 actions" logic
- Instead: if doctor has picked actions today → return those
- If not picked yet → return empty (frontend shows picker)
- Lyle recommendation is separate (always shown regardless)

### 3. New procedure: `engagement.getActionContent`
- Input: `{ actionKey: string }` (e.g., "social_post", "video", "referral_ask")
- Returns the expanded content for that action type:
  - social_post → topic-based post text + visual guidance
  - video → topic-based video script
  - referral_ask → referral trigger line + intro
  - patient_outreach → message template
  - community → connection approach
  - curriculum → next incomplete module info
  - ai_coach → just a link

### 4. New procedure: `engagement.getCurriculumReminder`
- Returns list of incomplete modules with progress percentages

### 5. Reuse existing: `routine.toggleTask` and `routine.getStreak`
- Keep the streak system — just wire it to the new picked actions

---

## Frontend Changes

### 1. Rewrite `TodaysGrowthPlan.tsx`
- Remove the current 3-card layout
- Add: streak bar (from DailyRoutine)
- Add: Lyle recommendation (keep existing card)
- Add: action picker (if not yet picked today)
- Add: checklist with expanded content (after picking)
- Add: curriculum reminder section at bottom

### 2. Remove Daily Routine from navigation
- Remove `/routine` route from App.tsx
- Remove "Daily Routine" from sidebar in DashboardLayout.tsx
- Keep the routine router on the server (streak logic still used)

### 3. Default topic assignment
- If user has no topic selected → auto-assign "general_corrective" on first load
- This ensures content always shows (never blank)

---

## Files Changed

| File | Change |
|------|--------|
| `server/engagement/router.ts` | Add `pickDailyActions`, `getActionContent`, `getCurriculumReminder`; rewrite `buildDailyActions` |
| `client/src/pages/TodaysGrowthPlan.tsx` | Full rewrite with sections above |
| `client/src/App.tsx` | Remove `/routine` route |
| `client/src/components/DashboardLayout.tsx` | Remove "Daily Routine" nav item |
| `shared/schema.ts` | No changes needed (existing tables sufficient) |
| `server/engagement/migrations.ts` | No changes needed |

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Breaking the streak system | Keep `routine.toggleTask` and `routine.getStreak` — just call them from the new page |
| Blank content if no topic | Auto-assign "general_corrective" as default |
| Losing Daily Routine data | Don't delete the route immediately — just remove from nav. Old data persists. |
| TypeScript errors | Check after each file change, not at the end |

---

## Build Order

1. Server: add `pickDailyActions`, `getActionContent`, `getCurriculumReminder` procedures
2. Server: add auto-default topic logic (assign "general_corrective" if none selected)
3. Frontend: rewrite TodaysGrowthPlan.tsx with all 5 sections
4. Frontend: remove Daily Routine from nav (keep route as fallback)
5. TypeScript check after each step
6. Final build + push

---

## Approval Needed

Does this match what you described? Specifically:
- Doctor picks 3 actions from a menu each morning
- Those become their daily checklist
- Each action expands to show the actual content (post text, video script, referral line, etc.)
- Lyle recommendation is always visible
- Curriculum reminder at the bottom
- Streak carries over from the old Daily Routine system

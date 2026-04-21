# Chat Section Overhaul — Implementation Plan

## Context
The Muazaf Copilot chat section has three issues: a platform freeze bug after the first AI reply, a weak "agentic" UX (no live accordion steps panel), and toolbar options (`Doc`, `+Sources`) scraped from another platform that don't match Muazaf's features. This plan fixes the freeze, adds a live accordion steps panel with a right-side desktop layout and modal on mobile, replaces the toolbar with platform-specific options, and polishes the full chat UI/UX using the existing design system.

---

## Current Behavior / Issues

1. **Freeze Bug**: After the first AI reply finishes streaming, the platform completely locks. Nothing is clickable until hard refresh.
2. **No live steps panel**: `TaskTimeline` is basic and inline. No side panel, no rich accordion, no streaming step details.
3. **Wrong toolbar options**: `Doc` chip and `+Sources` popover (with "Meetings", "Webpages", file uploads) are copied from another product. Not relevant to Muazaf.
4. **UI is underdeveloped**: Start page is sparse, message bubbles are plain, no streaming cursor, no gradient AI icon.

---

## Root Cause — Freeze Bug

In `useCopilot.js`, `runPlan()` is fire-and-forget with no concurrency guard. If the user sends a second message before the first finishes (or if any internal async race occurs), two concurrent `runPlan` pipelines mutate the same DataStore simultaneously. This corrupts the message state, causing React to enter a bad render cycle that locks the UI.

**No guard exists** — `send` can be called multiple times, there is no `isStreaming` check, no try/finally reset.

---

## Relevant Files (read)

| File | Role |
|---|---|
| `ui/src/lib/copilot/useCopilot.js` | Core send hook — freeze source |
| `ui/src/lib/copilot/scripts.js` | Task runner (fire-and-forget) |
| `ui/src/app/chat/[id]/page.js` | Conversation page layout |
| `ui/src/app/chat/[id]/page.module.css` | Flex column layout (needs grid) |
| `ui/src/components/chat/Composer.js` | Input + toolbar (Doc/Sources to remove) |
| `ui/src/components/chat/Composer.module.css` | Composer styles |
| `ui/src/components/chat/TaskTimeline.js` | Inline task list (kept for mobile) |
| `ui/src/components/chat/MessageBubble.js` | Message renderer |
| `ui/src/components/chat/MessageBubble.module.css` | Bubble styles |
| `ui/src/components/chat/SuggestedPrompts.js` | Start page prompt buttons |
| `ui/src/app/chat/page.js` | Start page |
| `ui/src/app/chat/page.module.css` | Start page styles |
| `ui/src/components/ui/Modal.js` | Existing modal (reuse for mobile step detail) |

---

## Files to Modify / Create

**Modify:**
- `ui/src/lib/copilot/useCopilot.js`
- `ui/src/app/chat/[id]/page.js`
- `ui/src/app/chat/[id]/page.module.css`
- `ui/src/components/chat/Composer.js`
- `ui/src/components/chat/Composer.module.css`
- `ui/src/components/chat/MessageBubble.js`
- `ui/src/components/chat/MessageBubble.module.css`
- `ui/src/components/chat/SuggestedPrompts.js`
- `ui/src/components/chat/SuggestedPrompts.module.css`
- `ui/src/app/chat/page.js`
- `ui/src/app/chat/page.module.css`

**Create:**
- `ui/src/components/chat/StepsPanel.js`
- `ui/src/components/chat/StepsPanel.module.css`

**No changes to:** DataStore.js, scripts.js, dispatcher.js, Modal.js, TaskTimeline.js (kept as-is for mobile inline use)

---

## Step-by-Step Implementation Plan

### Phase 1 — Fix Freeze Bug (do first, isolated)

**`useCopilot.js`**
- Add `const isStreamingRef = useRef(false)` and `const [isStreaming, setIsStreaming] = useState(false)`
- At top of `send`: if `isStreamingRef.current === true`, return early (no-op)
- Set `isStreamingRef.current = true` and `setIsStreaming(true)` before `runPlan`
- Replace `.catch()` chain with full `try/catch/finally`: reset both ref and state in `finally`
- Return `{ send, startAndNavigate, isStreaming }` from hook

**`ui/src/app/chat/[id]/page.js`**
- Destructure `isStreaming` from `useCopilot()`
- Pass `disabled={isStreaming}` to `<Composer>`

**`Composer.js`**
- Accept `disabled` prop (default `false`)
- Apply `disabled` to `<textarea>` and `<button>` elements
- Add `className` conditional for `.composerDisabled` on the outer `.wrap`
- When `disabled`, show "Thinking…" as placeholder text

**`Composer.module.css`**
- Add `.composerDisabled { opacity: 0.65; pointer-events: none; }`

---

### Phase 2 — StepsPanel Component (new, desktop right panel + mobile modal)

**`StepsPanel.js`** — New component
```
Props: { tasks, isOpen, onToggle }
```
- Internal state: `expandedIds` (Set) — which step IDs are expanded
- `toggleStep(id)` — add/remove from Set
- Renders a `<aside>` with:
  - **Panel header**: "Steps" title + step count badge + `PanelRightClose`/`PanelRightOpen` toggle button
  - **Empty state**: icon + "No steps yet. Start a conversation to see the AI's work here."
  - **Steps list**: `<ol>` of accordion items

**Each step item**:
- Header row: status dot + label + elapsed time + chevron (rotates on open)
- Accordion body using `grid-template-rows: 0fr → 1fr` CSS trick for smooth animation
- Body content: reasoning text, tool calls block (mono font), output text
- Status dot: `pending`=gray circle, `running`=blue pulsing ring (`@keyframes pulseRing`), `done`=green check, `failed`=red X
- Supports multiple steps open simultaneously

**Auto-scroll**: `useEffect` on `tasks.length` — if panel container scroll is within 200px of bottom, scroll to bottom

**`StepsPanel.module.css`** — New file
- `.panel`: full height, `width: 100%`, `overflow-y: auto`, padding
- `.panelHeader`: sticky top, flex, border-bottom
- `.toggleBtn`: icon-only button, `var(--radius-md)`, hover background
- `.emptyState`: centered, color: `var(--color-text-tertiary)`
- `.stepItem`: border-bottom `var(--color-border-subtle)`
- `.stepHeader`: flex, cursor pointer, padding `var(--space-3) var(--space-4)`, hover `var(--color-action-ghost-bg-hover)`, `transition: background 150ms`
- `.statusDot`: 8px circle, colored by status modifier classes
- `.running .statusDot`: `@keyframes pulseRing` animation on `box-shadow`
- `.chevron`: `transition: transform 200ms cubic-bezier(0.16, 1, 0.3, 1)`; `.chevronOpen`: `transform: rotate(90deg)`
- `.stepBody`: `display: grid; grid-template-rows: 0fr; transition: grid-template-rows 300ms cubic-bezier(0.16, 1, 0.3, 1)`
- `.stepBodyOpen`: `grid-template-rows: 1fr`
- `.stepBodyInner`: `overflow: hidden`
- `.stepContent`: padding, flex column, gap
- `.toolCallBlock`: `font-family: var(--font-mono)`, `font-size: var(--text-body-sm)`, bg `var(--color-bg-tertiary)`, `border-radius: var(--radius-md)`, border, padding
- `.countBadge`: small pill, `var(--color-bg-tertiary)`, `font-size: var(--text-caption)`

**`ui/src/app/chat/[id]/page.js`** — Restructure layout
- Add state: `const [stepsPanelOpen, setStepsPanelOpen] = useState(true)`
- Compute `activeTasks` via `useMemo`: find last assistant message with `tasks.length > 0`, return its tasks (or `[]`)
- Import and render `<StepsPanel tasks={activeTasks} isOpen={stepsPanelOpen} onToggle={() => setStepsPanelOpen(v => !v)} />`
- Wrap page in `.page` with grid class, add `.stepsClosed` class when `!stepsPanelOpen`
- Structure:
  ```
  <div className={`${styles.page} ${!stepsPanelOpen ? styles.stepsClosed : ''}`}>
    <header className={styles.header}>…</header>
    <div className={styles.scroll}><MessageList /></div>
    <div className={styles.composerDock}><Composer disabled={isStreaming} /></div>
    <aside className={styles.stepsCol}><StepsPanel … /></aside>
  </div>
  ```

**`ui/src/app/chat/[id]/page.module.css`** — Two-column grid
```css
.page {
  display: grid;
  grid-template-columns: 1fr;
  grid-template-rows: auto 1fr auto;
  height: 100vh;
  overflow: hidden;
  transition: grid-template-columns 300ms cubic-bezier(0.16, 1, 0.3, 1);
}
/* desktop: add steps column */
@media (min-width: 1025px) {
  .page { grid-template-columns: 1fr 340px; }
  .page.stepsClosed { grid-template-columns: 1fr 0px; }
  .stepsCol {
    grid-column: 2;
    grid-row: 1 / 4;
    border-left: 1px solid var(--color-border-subtle);
    overflow: hidden;
    height: 100vh;
    position: sticky;
    top: 0;
  }
}
@media (max-width: 1024px) {
  .stepsCol { display: none; }
}
.header { grid-column: 1; grid-row: 1; … }
.scroll { grid-column: 1; grid-row: 2; overflow-y: auto; }
.composerDock { grid-column: 1; grid-row: 3; … }
```

**Mobile step detail**: `TaskTimeline.js` already uses `ReasoningModal` — keep that as-is. On mobile the `.stepsCol` is hidden; users see inline `TaskTimeline` within each `MessageBubble`.

---

### Phase 3 — Composer Toolbar Redesign

**`Composer.js`** — Remove scraped options, add platform-specific ones

**Remove**: `docChipOn`, `SourcesPopover` import, `sourcesOpen`, `webSearch` states and their JSX

**Add 4 new toolbar items** (all as internal state + popover components defined in same file):

1. **`@` Context Mention** — `AtSign` icon. State: `mentionOpen` + `selectedMentions[]`. Opens small popover listing `data.projects` + `data.agents` + `data.knowledgeSources` from `useData()`. Selected items appear as dismissable chips in a `.mentionChipsRow` above the textarea. On send, chip labels prepended to message text.

2. **Run Mode toggle** — `Zap` icon. State: `runMode` boolean. Chip toggles between "Chat" (default, gray) and "Execute" (active, uses `chipActive` class). When `runMode=true`, visually distinguished. Passed through `onSend({ text, runMode })` (extend onSend signature).

3. **Knowledge** — `BookOpen` icon. State: `knowledgeOpen` + `selectedKnowledge`. Popover lists `data.knowledgeSources` from `useData()`. Single-select. Shows selected source name as chip label.

4. **Tools** — `Wrench` icon. State: `toolsOpen` + `selectedTools[]`. Popover lists `data.tools.filter(t => t.installed)`. Multi-select with checkmark. Count badge on chip when >0 selected.

5. **ModelSelector** — Keep unchanged, stays on right.

**Toolbar layout**: `@Context` | `Run Mode` | `Knowledge` | `Tools` | `[spacer]` | `ModelSelector`

**Popovers** styled identically using a shared `.popover` class (positioned `bottom: calc(100% + 8px)` above trigger, `--shadow-modal`, `--radius-lg`, min-width 220px, max-height 260px, overflow-y auto). Each popover item uses `.popoverItem` with hover `var(--color-action-ghost-bg-hover)`.

**`Composer.module.css`** additions:
- `.composerDisabled` (from Phase 1)
- `.mentionChipsRow` — flex row, wrap, gap `--space-1`, padding bottom `--space-2`
- `.mentionChip` — small pill, bg `var(--color-bg-tertiary)`, border, close button
- `.popover` — positioned absolute, white bg, shadow, border, radius, z-index 50
- `.popoverSection` — section heading in caption style
- `.popoverItem` — flex row, padding, hover bg
- `.popoverItemSelected` — checkmark shown, slightly highlighted

---

### Phase 4 — UI/UX Polish

**`MessageBubble.js`**
- AI icon: change background from `--color-bg-tertiary` to gradient: add inline style `style={{ background: 'var(--gradient-purple)', color: 'white' }}` or add `.aiIconGradient` class
- Streaming cursor: after `renderBlocks()`, when `message.status === 'streaming' && message.content`, render `<span className={styles.cursor} aria-hidden="true" />`
- Keep `pendingDots` only when `status === 'streaming' && !message.content`
- User bubble: add border `1px solid var(--color-border-subtle)` for definition

**`MessageBubble.module.css`**
- `.aiIcon`: update to `background: var(--gradient-purple); color: white;`
- Add `.cursor`: `display: inline-block; width: 2px; height: 1.1em; background: var(--color-text-secondary); margin-left: 1px; vertical-align: text-bottom; animation: blink 900ms step-end infinite;`
- Add `@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }`
- `.userBubble`: add `border: 1px solid var(--color-border-subtle);`

**`SuggestedPrompts.js`**
- Accept `activeCategory` prop; filter PROMPTS when not `'all'`
- Expand PROMPTS list with categories: `'all'`, `'projects'`, `'agents'`, `'tools'`, `'knowledge'`, `'deploy'`
- Example expanded prompts:
  - Projects: "Create a research muazaf", "Run Research Muazaf", "Deploy Content Pipeline"
  - Agents: "Create an agent named QA Reviewer", "List my agents"
  - Tools: "Install SerperDevTool", "List installed tools"
  - Knowledge: "Upload knowledge about our product", "List knowledge sources"
  - Deploy: "Show deployments", "Check deployment status"

**`SuggestedPrompts.module.css`**
- Change `.list` from column flex to: `display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-2); max-width: 720px;`
- `@media (max-width: 640px) { .list { grid-template-columns: 1fr; } }`
- `.item`: add `border: 1px solid var(--color-border-subtle);` + hover `box-shadow: var(--shadow-sm);`

**`chat/page.js`** (start page)
- Add `activeCategory` state (default `'all'`)
- Add logo mark above title: `<div className={styles.logoMark}><Sparkles size={28} /></div>`
- Increase subtitle clarity: "Build agents, run projects, manage knowledge — just ask."
- Add category chips row between composer and suggested prompts
- Pass `activeCategory` to `<SuggestedPrompts activeCategory={activeCategory} />`

**`chat/page.module.css`**
- `.header`: `align-items: center; text-align: center;`
- `.logoMark`: `width: 56px; height: 56px; border-radius: var(--radius-xl); background: var(--gradient-purple); color: white; display: flex; align-items: center; justify-content: center; margin: 0 auto var(--space-3); box-shadow: var(--shadow-md);`
- `.title`: increase to `font-size: var(--text-h1); font-weight: 700; letter-spacing: -0.02em;`
- `.categoryRow`: `display: flex; flex-wrap: wrap; justify-content: center; gap: var(--space-2); margin: var(--space-3) 0 var(--space-1);`
- `.categoryChip`: pill button, `border-radius: var(--radius-pill)`, border; `.categoryChipActive`: `background: var(--color-action-primary-bg); color: var(--color-action-primary-text); border-color: transparent;`

---

## Edge Cases / Risks

| Risk | Mitigation |
|---|---|
| `isStreaming` state vs ref race — state set async, ref set sync | Ref guards the actual pipeline; state drives UI disable. Both are reset in `finally`. |
| `stepsPanelOpen` state with SSR/hydration | `[id]/page.js` is `'use client'` — no hydration mismatch risk |
| `grid-template-columns` transition in CSS — not all browsers animate this | Tested pattern; works in Chromium/Safari/Firefox modern. If not, fall back to `width` transition on `.stepsCol` |
| `useData()` in `Composer.js` — Composer currently doesn't call `useData()` | Safe to add — it's just a context read, no performance concern |
| Mobile: TaskTimeline + StepsPanel duplication | StepsCol is `display: none` on mobile via media query; TaskTimeline stays inline for mobile |
| Mention chips prepended to text — dispatcher keyword match | Acceptable for now; dispatcher does keyword matching anyway. Future: pass structured context separately |
| `activeTasks` memo — if no messages have tasks, returns `[]` | StepsPanel shows empty state — handled |

---

## Validation / Tests

1. **Freeze fix**: Send a message → wait for full reply → immediately send another → verify no freeze, both replies complete correctly
2. **Concurrent send guard**: Rapidly click send multiple times — only first goes through while streaming
3. **Steps panel desktop**: Open chat with reply that has tasks → verify right panel appears with steps → click steps to expand/collapse → verify chevron rotates, body animates
4. **Steps panel toggle**: Click panel toggle button → column collapses (width → 0) with animation → click again → reopens
5. **Steps panel mobile**: Resize to <1024px → verify stepsCol hidden, TaskTimeline inline visible, ReasoningModal opens on task click
6. **Streaming cursor**: During streaming, blink cursor visible at end of content
7. **Composer disabled during stream**: While AI is replying — textarea disabled, toolbar non-interactive, placeholder shows "Thinking…"
8. **New toolbar — @Context**: Click → popover lists projects/agents/knowledge sources → select one → chip appears → send includes mention
9. **New toolbar — Run Mode toggle**: Click Zap → chip turns active blue → click again → reverts
10. **New toolbar — Knowledge/Tools**: Popover opens with real data from DataStore → selection reflected in chip
11. **Start page categories**: Click "Agents" category chip → prompt list filters to agent-related prompts only
12. **Theme**: All new components respond to dark/light theme toggle (use CSS vars throughout, no hard-coded colors)
13. **Run**: `cd ui && npm run build` — no TypeScript/lint errors

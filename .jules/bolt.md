## 2024-03-18 - Added OnPush Change Detection to Angular Components
**Learning:** Angular components use default change detection which checks the entire component tree on every event. In an app with complex components (like lists, tables, search results), this can cause significant rendering overhead.
**Action:** Use `ChangeDetectionStrategy.OnPush` for components, especially since this codebase is already heavily using Angular Signals (`signal`, `computed`, `toSignal`), which are perfectly suited for OnPush and make change detection highly targeted and efficient.

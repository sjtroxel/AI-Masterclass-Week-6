# Skill: mobile-review

Review an Angular component against the Asteroid Bonanza mobile-first specification.

## Steps

1. Read the component file(s) provided (or ask which component to review if not specified).
2. Read `.claude/rules/angular.md` for the mobile-first rules.
3. Check each item in the checklist below and report pass / fail / needs-inspection for each.

## Checklist

**Baseline viewport**
- [ ] Template is written for 375px first — no desktop-only layout that breaks at 375px
- [ ] No fixed pixel widths that overflow a 375px container
- [ ] Responsive classes follow mobile-first direction: `base → md: → lg:` (not the reverse)

**Touch targets**
- [ ] All buttons, links, and interactive controls are at minimum 44×44px (`min-h-[44px] min-w-[44px]` or equivalent)
- [ ] No interactive elements overlap at 375px

**Navigation**
- [ ] Bottom nav bar is visible on mobile (`block md:hidden` or equivalent)
- [ ] Sidebar/top nav is hidden on mobile (`hidden md:block` or equivalent)
- [ ] Navigation items are reachable with one thumb (bottom of screen preferred)

**Typography & spacing**
- [ ] Text is readable at 375px — no font size below 14px in body copy
- [ ] Adequate padding so content does not touch screen edges (minimum `px-4`)

**Breakpoint hygiene**
- [ ] No unexplained gaps between breakpoints (e.g., layout works at 375, 768, 1280 — not just at extremes)

## Output format

For each checklist item: **PASS**, **FAIL** (with explanation), or **INSPECT** (needs human eyes — cannot be determined from code alone).

End with an overall verdict: **Mobile-ready** (all pass/inspect, no fail) or **Needs work** (any fail), and list the specific fixes required.

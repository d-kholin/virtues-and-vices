# Virtues & Vices — product decisions

## People and access

One family, initially husband and wife. Pocket ID OIDC; only explicitly approved subject IDs can sign in. Personal habits default to spouse-visible and are editable only by their owner, including entries. Personal habits can be private, including activity and reports. Shared habits have full joint control; either person completing the day completes it for both. No participant tracking is needed.

## Tracking

Virtues and Vices are visually separate. Virtues are encouraging; Vices use copper accents and direct feedback on slips and limits without personal judgment. Daily completion is yes/no, with multiple occurrences recordable per date. Weekly targets count distinct days. Habits support strict daily schedules and flexible weekly targets, with preferred days and weekend catch-up. Vice targets can require avoidance or allow up to a chosen number of slip days per week. Avoidance may be explicit or automatic per habit.

Weeks default to Monday. Profiles choose a default; habits retain their own week-start setting so shared habits are consistent across both accounts. Calendar days follow profile timezone and midnight. No custom day cutoff.

Unfinished current days/weeks do not break streaks. Past unrecorded entries are prompted for review and streaks remain pending until corrected or marked missed. Historical entries can be corrected. Starts can be backdated. Archive retains history.

## Rest and reminders

Vacation is personal, schedulable, and affects only vacationable habits. Shared habits pause when both people are away. Vacation setup offers proportional reduction, a manual weekly target, or excusing affected weeks. Excused periods preserve but do not extend streaks.

Each user defaults to one evening reminder. Habits can add a reminder if incomplete (for example, devos at 10 a.m.). Both users receive shared-habit reminders; either person's completion should cancel remaining reminders. Delivery channel is deferred; this implementation stores preferences only.

## Experience

Mobile-first PWA; desktop dashboards. Today combines personal and shared habits in the same list, with a small Shared tag and no separate Shared tab. Reports offers Household, My Habits, and spouse views; shared habits appear inline in each relevant view. Today shows scheduled habits and weekly catch-up, with streaks beside each habit. Reports include a GitHub-style calendar heatmap, monthly/weekly perspectives, streaks, and a household activity feed. Private data never appears in the other person's reporting or feed.

Warm journal visual direction: ivory, forest green, copper; deep olive-charcoal dark mode; expressive serif identity and clean body text. Character is welcome. Successful avoidance is a success; vice occurrences expose the negative outcome directly.

## Current implementation boundaries

The first build provides persistent tracking and reports. It is online-first, with no offline mutation queue. Notifications need a delivery decision and worker. Live Pocket ID validation needs deployment values. Schedule edits recalculate history; historical schedule versioning is not implemented yet.

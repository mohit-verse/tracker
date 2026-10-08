# Tracker — UI/UX Specification

## Visual direction
Minimal + dark developer aesthetic. Fast scanning, low visual noise, large readable percentages, clear Theory/Practical distinction.

## Bottom navigation
`Dashboard | Timetable | + | Settings`

The central + is the visually dominant primary action.

## Dashboard
Header: Tracker.

Subject list/card:
- Subject name
- Theory circular progress
- Practical circular progress
- Percentage
- Component label

Example:
**Strategic Data Analytics & Collaborative Tools**
`71% Theory   100% Practical`

Do not show the timetable here.

Status should communicate >=75% versus below 75% without relying on color alone.

## Subject detail
1. Subject title
2. Theory summary
3. Practical summary
4. Attendance history
5. Attendance planner

History shows date, component, Present/Absent, and weight where relevant.

## Add Attendance
Flow:
`+ → today's scheduled sessions → mark Present/Absent → Save`

Allow date changes for historical entry. Clearly label Theory/Practical. Prevent accidental duplicates.

## Timetable
Dedicated screen with day/time/subject/component. Show batch-specific sessions. Sports/Library are visibly non-attendance activities.

## Planner
Show:
- Current %
- Attended/conducted weighted units
- Can-miss result
- Required-attendance result
- Optional what-if scenario

Use clear language such as:
- “You can miss 1 more session and stay at 75%.”
- “Attend the next 3 sessions to reach 75%.”

## Notifications
Settings:
- Daily reminder on/off
- Risk alerts on/off
- Reminder time

## Backup/import
Settings/Data:
- Export JSON
- Back up to Google Drive
- Import JSON
- Restore from Google Drive

Validate before mutation and confirm destructive replacement.

## Accessibility
Strong contrast, text labels in addition to color, appropriate touch targets, and screen-reader labels for icon-only controls and progress indicators.

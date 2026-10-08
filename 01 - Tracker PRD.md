# Tracker — Product Requirements Document

## Product
**Name:** Tracker  
**Platform:** React Native  
**Targets:** Android + iOS  
**Primary use:** Personal attendance tracking, while remaining usable by other students.

## Goal
Tracker lets a student manually record attendance from their timetable, see Theory and Practical attendance by subject, inspect history, plan around the 75% requirement, and back up/restore data as JSON through Google Drive or the device file system.

**No SVVV ERP integration.**

## Core rules
- Attendance is recorded per lecture/session, not by elapsed hours.
- Theory and Practical are separate.
- Normal Theory session = 1 unit.
- Normal 2-hour Practical/Lab = 1 unit.
- Project Work-1 = 2 units.
- Sports and Library = excluded.
- Target = 75%.

## Current subjects
1. C Programming Language
2. Python Programming
3. Strategic Communication Skills
4. Multi Disciplinary Course-1 / GEC-1
5. Strategic Data Analytics and Collaborative Tools
6. Project Work - 1
7. C Programming Language Lab
8. Python Programming Lab

Known facts:
- Python Lab = Batch I.
- Strategic Data Analytics practical = 1 unit despite being 2 hours.
- C Programming Lab = 1 unit despite being 2 hours.
- Project Work-1 = 2 units.

## Navigation
- Dashboard
- Timetable
- Prominent central **+** Add Attendance action
- Settings

## Dashboard
Show a simple list of subjects. Each subject has two circular progress indicators:
- Theory
- Practical

Only applicable components should be shown. Show percentage and a clear 75% status. Do not put the timetable on the dashboard.

## Subject detail
Show:
- Theory percentage/details
- Practical percentage/details
- Detailed attendance history by date/session
- Attendance planning

## Add Attendance
The central + opens today's attendance filler.
- Load today's timetable sessions.
- Let the user mark Present/Absent manually.
- Allow historical dates.
- Filter by the user's batch.
- Exclude Sports/Library.

## Attendance planning
Calculate:
- How many future sessions/units can be missed while staying >=75%.
- How many future attended sessions/units are needed to reach 75%.
- Projected percentage for a scenario.
- Impossible-to-reach cases.

## Timetable
Dedicated bottom-nav screen. Show/edit weekly schedule, Theory/Practical, batch applicability, and non-attendance activities.

## Notifications
Required:
- Daily reminder to mark attendance.
- Optional attendance-risk alerts.
- Configurable reminder time.

## Storage and backup
- Local-first storage.
- Export complete data as versioned JSON.
- Backup JSON to Google Drive.
- Import from Google Drive or device files.
- Validate imports and protect existing data from accidental destruction.

## Non-goals
No ERP integration, faculty/admin system, shared attendance database, notes/study-material system, social features, or automatic ERP retrieval.

## Design
Minimal, app-like, dark developer aesthetic. Clean typography, strong hierarchy, circular progress visuals, no unnecessary gamification.

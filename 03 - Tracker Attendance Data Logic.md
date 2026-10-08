# Tracker — Attendance & Data Logic

## Core model
Each attendance record contains:
- subject
- component: Theory or Practical
- date
- timetable event
- status: Present or Absent
- weight/unit value

Attendance is **session-based**, not hour-based.

## Weights
- Normal Theory session: 1
- Normal Practical/Lab session: 1
- Project Work-1: 2
- Sports: excluded
- Library: excluded

A 2-hour lab still creates one attendance event with weight 1.

## Calculation
For each component:

`conductedWeight = sum(weight of attendance-bearing events)`

`attendedWeight = sum(weight of Present events)`

`percentage = attendedWeight / conductedWeight * 100`

If conductedWeight = 0, display **N/A**, never 0%.

## History
Historical records are editable through an explicit edit action. Changes recalculate dashboard, subject details, and planner results immediately.

## Planner
For current attended weight A and conducted weight C:

Maximum future missed weight m while remaining >=75%:

`A / (C + m) >= 0.75`

Minimum future attended weight x to reach 75%:

`(A + x) / (C + x) >= 0.75`

Use actual event weights. Support scenario calculations with future misses and attends.

## Timetable-to-attendance
Timetable entries contain:
- weekday
- start/end time
- subject
- component
- attendance-bearing flag
- weight
- batch constraint

Python Programming Lab must respect Batch I.

Generate one attendance event per scheduled attendance session. Exclude Sports/Library.

## Duplicate protection
Prevent duplicate records for the same date + timetable event. Provide explicit correction/edit flow.

## JSON backup
Versioned top-level structure:

```json
{
  "schemaVersion": 1,
  "studentProfile": {},
  "subjects": [],
  "timetable": [],
  "attendanceRecords": [],
  "settings": {},
  "notificationSettings": {}
}
```

Validate schema, IDs, statuses, weights, duplicates, and conflicts before import. Create a safety snapshot before destructive replacement.

## Precision
Keep full precision internally. Display whole percentages by default; detail screens may use one decimal. Never round intermediate calculations.

## Testing
Test:
- zero conducted
- exactly 75%
- below/above 75%
- weighted Project Work event
- future sessions
- impossible target
- duplicate records

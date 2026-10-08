# Tracker — React Native & AI Development Specification

## Stack
- React Native + TypeScript
- Expo if compatible with all required native capabilities; otherwise React Native CLI
- React Navigation
- Local persistent storage
- Schema validation for JSON
- Google Drive API/OAuth
- Local notifications

Verify current package compatibility before installation.

## Architecture
Use feature-oriented structure:

```text
src/
  components/
  screens/
  navigation/
  features/
    attendance/
    timetable/
    subjects/
    planner/
    backup/
    notifications/
  data/
  storage/
  services/
  utils/
  types/
  theme/
```

Keep business logic out of UI components.

## Domain types
Strongly type:
- Subject
- TimetableEntry
- AttendanceComponent
- AttendanceRecord
- NotificationSettings
- AppSettings
- BackupDocument

Components: `theory | practical`  
Status: `present | absent`  
Weight: positive number; normal=1, Project Work-1=2.

## Navigation
Bottom tabs:
- Dashboard
- Timetable
- central Add Attendance
- Settings

Subject Detail and edit flows are stack/modal screens.

## Dashboard
Reusable SubjectAttendanceCard:
- subject name
- applicable Theory circle
- applicable Practical circle
- percentage
- press handler to Subject Detail

Keep it minimal.

## Add Attendance
- Default to today.
- Derive sessions from timetable.
- Filter by Batch I where required.
- Exclude Sports/Library.
- Mark Present/Absent.
- Save atomically.
- Prevent duplicates.
- Support historical dates.

## Timetable
Implement weekly viewing/editing. Use the supplied timetable as the source of truth. Do not invent missing slots.

Known facts:
- Monday and Tuesday are week off.
- Python Lab = Batch I.
- Strategic Data Analytics practical = weight 1.
- C Programming Lab = weight 1.
- Project Work-1 = weight 2.
- Sports/Library = non-attendance.

## Planner service
Create pure, unit-tested functions:
- `calculateAttendance()`
- `maxMissableWeight()`
- `requiredAttendanceWeight()`
- `projectedAttendance()`
- `isTargetAchievable()`

## Notifications
Local notifications for daily reminder and optional risk alerts. Request permission properly and never schedule without user consent.

## Google Drive
Google Drive is backup storage, not the live database.

Support:
- authentication
- upload Tracker JSON
- find/list backup
- download/import
- sign-out/revoke where supported

Use least-privilege scopes. Never export Google credentials.

## File import
Support Google Drive and device file picker. Validate before mutation. Never overwrite without confirmation. Create a safety snapshot before destructive replacement.

## Privacy
No ERP credentials, faculty data, or unnecessary personal data. No backend account required for core operation. Local-first.

## Testing
- Attendance calculation unit tests
- Timetable/batch tests
- JSON validation tests
- Critical component tests
- Android manual testing
- iOS manual testing

## Implementation order
1. Project setup/theme/navigation
2. Subject/timetable model
3. Dashboard
4. Add Attendance
5. Subject detail/history
6. Planner
7. Timetable editing
8. Local persistence
9. Notifications
10. JSON import/export
11. Google Drive backup/restore
12. Testing/polish/builds

## AI coding rules
1. Read all four Tracker documents before coding.
2. Treat them as source of truth.
3. Do not invent features.
4. Do not add ERP integration, backend sync, social features, or study materials.
5. Do not change attendance formulas without approval.
6. Keep domain logic independent and testable.
7. Make small coherent changes.
8. Run type-check/tests/lint after major changes.
9. Never claim something works without verifying it.
10. If ambiguous, ask instead of guessing.
11. Preserve unrelated behavior.
12. Keep the UI consistent with the minimal dark developer aesthetic.

## V1 definition of done
Android and iOS builds run; dashboard works; central + attendance entry works; history/editing works; timetable generates sessions; Batch I filtering works; Project Work-1 weight 2 works; Sports/Library are excluded; planner is tested; notifications work with permission; JSON backup/import works; Google Drive backup/restore works; no ERP integration exists.

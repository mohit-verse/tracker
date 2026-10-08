import { calculateAttendance, getMaxMissableWeight, getRequiredAttendanceWeight, getApplicableSessions, } from './src/features/attendance/attendanceService';
let passed = 0;
let failed = 0;
function assertEqual(expected, actual, testName) {
    if (expected === actual || (expected == null && actual == null)) {
        passed++;
        console.log(`✅ [PASS] ${testName}`);
    }
    else {
        failed++;
        console.error(`❌ [FAIL] ${testName}`);
        console.error(`   Expected: ${expected}`);
        console.error(`   Actual:   ${actual}`);
    }
}
function assertCloseTo(expected, actual, testName, precision = 4) {
    if (Math.abs(expected - actual) < Math.pow(10, -precision)) {
        passed++;
        console.log(`✅ [PASS] ${testName}`);
    }
    else {
        failed++;
        console.error(`❌ [FAIL] ${testName}`);
        console.error(`   Expected: ${expected}`);
        console.error(`   Actual:   ${actual}`);
    }
}
function assertTrue(condition, testName) {
    if (condition) {
        passed++;
        console.log(`✅ [PASS] ${testName}`);
    }
    else {
        failed++;
        console.error(`❌ [FAIL] ${testName}`);
    }
}
const createRecord = (id, status, weight, component = 'theory') => ({
    id,
    subjectId: 'sub_1',
    component,
    date: '2023-10-01',
    timetableEntryId: 'tt_1',
    status,
    weight,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
});
console.log('Running Tests...');
// Test 1
const summary1 = calculateAttendance([]);
assertEqual(0, summary1.conductedWeight, 'Test 1: 0 conducted weight');
assertEqual(null, summary1.percentage, 'Test 1: 0 conducted percentage');
// Test 2
const summary2 = calculateAttendance([createRecord('1', 'present', 1)]);
assertEqual(100, summary2.percentage, 'Test 2: 1 attended / 1 conducted');
// Test 3
const records3 = [
    ...Array(5).fill(0).map((_, i) => createRecord(`p${i}`, 'present', 1)),
    ...Array(2).fill(0).map((_, i) => createRecord(`a${i}`, 'absent', 1)),
];
assertCloseTo(71.4285, calculateAttendance(records3).percentage, 'Test 3: 5 attended / 7 conducted', 3);
// Test 4
const records4 = [
    ...Array(3).fill(0).map((_, i) => createRecord(`p${i}`, 'present', 1)),
    createRecord('a1', 'absent', 1),
];
assertEqual(75, calculateAttendance(records4).percentage, 'Test 4: 3 attended / 4 conducted');
// Test 5
const records5 = [
    ...Array(2).fill(0).map((_, i) => createRecord(`p${i}`, 'present', 1)),
    ...Array(2).fill(0).map((_, i) => createRecord(`a${i}`, 'absent', 1)),
];
assertEqual(50, calculateAttendance(records5).percentage, 'Test 5: 2 attended / 4 conducted');
// Test 6
const summary6 = calculateAttendance([createRecord('1', 'present', 2)]);
assertEqual(2, summary6.conductedWeight, 'Test 6: Project Work-1 conducted');
assertEqual(2, summary6.attendedWeight, 'Test 6: Project Work-1 attended');
assertEqual(100, summary6.percentage, 'Test 6: Project Work-1 percentage');
// Test 7
const summary7 = calculateAttendance([createRecord('1', 'absent', 2)]);
assertEqual(0, summary7.attendedWeight, 'Test 7: Project Work-1 absent attended');
assertEqual(0, summary7.percentage, 'Test 7: Project Work-1 absent percentage');
// Test 8
const records8 = [
    createRecord('1', 'present', 1),
    createRecord('2', 'present', 2),
    createRecord('3', 'absent', 1),
];
const summary8 = calculateAttendance(records8);
assertEqual(4, summary8.conductedWeight, 'Test 8: Mixed conducted');
assertEqual(3, summary8.attendedWeight, 'Test 8: Mixed attended');
assertEqual(75, summary8.percentage, 'Test 8: Mixed percentage');
// Test 9
assertEqual(0, getMaxMissableWeight(5, 7, 0.75), 'Test 9: Planner max missable weight (5/7)');
assertEqual(2, getMaxMissableWeight(9, 10, 0.75), 'Test 9: Planner max missable weight (9/10)');
// Test 10
assertEqual(1, getRequiredAttendanceWeight(5, 7, 0.75), 'Test 10: Planner min future attended (5/7)');
assertEqual(4, getRequiredAttendanceWeight(2, 4, 0.75), 'Test 10: Planner min future attended (2/4)');
// Test 11
assertEqual(0, getRequiredAttendanceWeight(3, 4, 0.75), 'Test 11: Planner already >= target (3/4)');
// Test 12
const date12 = new Date('2023-10-05T00:00:00'); // Thursday
const timetable12 = [
    { id: '1', dayOfWeek: 4, startTime: '10:00', endTime: '11:00', subjectId: 'sub1', component: 'practical', isAttendanceBearing: true, weight: 1, batchConstraint: 'Batch I' },
    { id: '2', dayOfWeek: 4, startTime: '11:00', endTime: '12:00', subjectId: 'sub2', component: 'practical', isAttendanceBearing: true, weight: 1, batchConstraint: 'Batch II' },
    { id: '3', dayOfWeek: 4, startTime: '12:00', endTime: '13:00', subjectId: 'sub3', component: 'theory', isAttendanceBearing: true, weight: 1, batchConstraint: 'All' },
];
const sessions12 = getApplicableSessions(date12, timetable12, 'Batch I');
assertEqual(2, sessions12.length, 'Test 12: Batch filtering count');
assertTrue(sessions12.some(s => s.id === '1'), 'Test 12: Batch I included');
assertTrue(sessions12.some(s => s.id === '3'), 'Test 12: All included');
assertTrue(!sessions12.some(s => s.id === '2'), 'Test 12: Batch II excluded');
// Test 13
const timetable13 = [
    { id: '1', dayOfWeek: 4, startTime: '10:00', endTime: '11:00', subjectId: 'sub1', component: 'practical', isAttendanceBearing: true, weight: 1, batchConstraint: 'All' },
    { id: '2', dayOfWeek: 4, startTime: '11:00', endTime: '12:00', subjectId: 'sports', component: 'none', isAttendanceBearing: false, weight: 0, batchConstraint: 'All' },
];
const sessions13 = getApplicableSessions(date12, timetable13, 'Batch I');
assertEqual(1, sessions13.length, 'Test 13: Sports/Library exclusion count');
assertEqual('1', sessions13[0].id, 'Test 13: Sports/Library exclusion correct ID');
console.log(`\nResults: ${passed} passed, ${failed} failed.`);
if (failed > 0)
    process.exit(1);

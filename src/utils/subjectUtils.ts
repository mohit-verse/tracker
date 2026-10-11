/**
 * Subject formatting and identification utilities.
 * Ensures raw internal UUIDs are NEVER exposed to the user.
 */

export function isUUID(str?: string | null): boolean {
  if (!str) return false;
  const trimmed = str.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);
}

export interface SubjectLookupOptions {
  subjectId?: string;
  name?: string;
  displayName?: string;
  entryDisplayName?: string;
  fallback?: string;
  subjects?: { id: string; name: string }[];
}

export function formatSubjectDisplayName(options: SubjectLookupOptions | string): string {
  if (typeof options === 'string') {
    return formatSubjectDisplayName({ subjectId: options });
  }

  const { subjectId, displayName, entryDisplayName, name, fallback, subjects } = options;
  const targetDisplayName = entryDisplayName || displayName;

  // 1. If displayName/entryDisplayName is non-empty and NOT a UUID, return it
  if (targetDisplayName && !isUUID(targetDisplayName) && targetDisplayName.trim().length > 0) {
    return targetDisplayName.trim();
  }

  // 2. If name is non-empty and NOT a UUID, return it
  if (name && !isUUID(name) && name.trim().length > 0) {
    return name.trim();
  }

  const cleanSubId = subjectId?.trim();

  // 3. Known system identifiers
  if (cleanSubId === 'sports') return 'Sports';
  if (cleanSubId === 'library') return 'Library';

  // 4. Look up in provided subjects list
  if (cleanSubId && subjects && subjects.length > 0) {
    const matched = subjects.find(s => s.id === cleanSubId);
    if (matched && matched.name && !isUUID(matched.name) && matched.name.trim().length > 0) {
      return matched.name.trim();
    }
  }

  // 5. If cleanSubId is not a UUID and non-empty, use it as fallback name
  if (cleanSubId && !isUUID(cleanSubId) && cleanSubId.length > 0) {
    return cleanSubId;
  }

  // 6. Fallback: never display a raw UUID
  return fallback !== undefined ? fallback : 'Subject';
}

/**
 * Robustly matches two subject identifiers (which might be UUIDs or subject names)
 * against a list of known subjects.
 */
export function isSubjectMatch(
  recordOrTargetId: string,
  targetSubjectId: string,
  allSubjects: { id: string; name: string }[] = []
): boolean {
  if (!recordOrTargetId || !targetSubjectId) return false;
  if (recordOrTargetId === targetSubjectId) return true;

  const targetSub = allSubjects.find(
    s => s.id === targetSubjectId || s.name.toLowerCase() === targetSubjectId.toLowerCase()
  );
  const otherSub = allSubjects.find(
    s => s.id === recordOrTargetId || s.name.toLowerCase() === recordOrTargetId.toLowerCase()
  );

  const targetName = (targetSub?.name || targetSubjectId).trim().toLowerCase();
  const otherName = (otherSub?.name || recordOrTargetId).trim().toLowerCase();

  // If their resolved names match (ignoring case and whitespace)
  if (targetName === otherName) {
    return true;
  }

  // Check cross ID mappings
  if (otherSub && otherSub.id === targetSubjectId) return true;
  if (targetSub && targetSub.id === recordOrTargetId) return true;

  return false;
}

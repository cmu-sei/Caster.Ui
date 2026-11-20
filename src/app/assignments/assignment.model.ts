// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

/** One thing that can be assigned, as an assignment checklist lists it. */
export interface AssignmentItem {
  id: string;
  name: string;
  /** A second, quieter line: a description, a provider, a state. */
  detail?: string | null;
  /** Short notes beside the name, such as "via group Lab". */
  notes?: string[];
  /** Assigned another way, through a project group: shown checked, not changed here. */
  locked?: boolean;
  /** Shown in the warning color, such as a connection that is no longer configured. */
  warn?: boolean;
}

/** What a checklist's selection changed, against what was assigned when it opened. */
export interface AssignmentDiff {
  add: string[];
  remove: string[];
}

export function assignmentDiff(
  initial: readonly string[],
  selected: readonly string[],
): AssignmentDiff {
  const before = new Set(initial);
  const after = new Set(selected);
  return {
    add: [...after].filter((x) => !before.has(x)),
    remove: [...before].filter((x) => !after.has(x)),
  };
}

/** Names compare without regard to case, as the API matches connections. */
export function sameName(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  return (a ?? '').toLowerCase() === (b ?? '').toLowerCase();
}

/** "Save", "Save 1 change", "Save 3 changes". */
export function saveLabel(changes: number): string {
  return changes === 0
    ? 'Save'
    : `Save ${changes} ${changes === 1 ? 'change' : 'changes'}`;
}

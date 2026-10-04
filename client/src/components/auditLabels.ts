/** Display labels for merge outcomes and rules in the audit trail. */
export const OUTCOME_STYLE: Record<string, string> = {
  applied: 'badge-sage',
  merged: 'badge-blue',
  kept_existing: 'badge-slate',
  duplicate: 'badge-slate',
  conflict: 'badge-conflict',
  resolved: 'badge-violet',
};

export const OUTCOME_LABEL: Record<string, string> = {
  applied: 'Applied',
  merged: 'Merged',
  kept_existing: 'Kept existing',
  duplicate: 'Duplicate',
  conflict: 'Sent to review',
  resolved: 'Resolved by reviewer',
};

export const RULE_LABEL: Record<string, string> = {
  create: 'Create',
  lww: 'Last-Write-Wins',
  'or-set': 'OR-Set (add-wins)',
  'g-set': 'Grow-only set',
  'critical-review': 'Critical field',
  'manual-review': 'Manual review',
  delete: 'Archive',
};

/** Display labels for merge outcomes and rules in the audit trail. */
export const OUTCOME_STYLE: Record<string, string> = {
  applied: 'badge-ok',
  merged: 'badge-info',
  kept_existing: 'badge-muted',
  duplicate: 'badge-muted',
  conflict: 'badge-warning',
  resolved: 'badge-ok',
};

export const OUTCOME_LABEL: Record<string, string> = {
  applied: 'Saved',
  merged: 'Combined',
  kept_existing: 'Older change, not used',
  duplicate: 'Already saved',
  conflict: 'Sent for dose review',
  resolved: 'Decided by reviewer',
};

export const RULE_LABEL: Record<string, string> = {
  create: 'New record',
  lww: 'Newest change wins',
  'or-set': 'Allergies are always kept',
  'g-set': 'Every check-up is kept',
  'critical-review': 'Dose needs a doctor',
  'manual-review': 'Reviewer decision',
  delete: 'Removed',
};

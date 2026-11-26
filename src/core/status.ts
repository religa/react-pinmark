/** All thread statuses, in workflow order. Single source of truth. */
export const THREAD_STATUSES = ['open', 'pending', 'resolved', 'dismissed'] as const;

export type ThreadStatus = (typeof THREAD_STATUSES)[number];

/** Statuses that still need attention (shown by default, counted as unresolved). */
export const ACTIVE_STATUSES: readonly ThreadStatus[] = ['open', 'pending'];

/** Filter values: a single status, `active` (open + pending), or `all`. */
export const STATUS_FILTERS = [...THREAD_STATUSES, 'active', 'all'] as const;

export type StatusFilter = (typeof STATUS_FILTERS)[number];

export const STATUS_LABELS: Record<StatusFilter, string> = {
  open: 'Open',
  pending: 'Pending',
  resolved: 'Resolved',
  dismissed: 'Dismissed',
  active: 'Active (open + pending)',
  all: 'All statuses',
};

export function isThreadStatus(value: unknown): value is ThreadStatus {
  return (THREAD_STATUSES as readonly unknown[]).includes(value);
}

export function isStatusFilter(value: unknown): value is StatusFilter {
  return (STATUS_FILTERS as readonly unknown[]).includes(value);
}

/** Validates untrusted input (CLI flag, MCP arg). Throws on an unknown status. */
export function parseThreadStatus(value: unknown): ThreadStatus {
  if (!isThreadStatus(value)) {
    throw new Error(`Status must be one of: ${THREAD_STATUSES.join(', ')}`);
  }
  return value;
}

/** Validates an optional untrusted filter. `undefined` passes through; unknown values throw. */
export function parseStatusFilter(value: unknown): StatusFilter | undefined {
  if (value === undefined) return undefined;
  if (!isStatusFilter(value)) {
    throw new Error(`Status filter must be one of: ${STATUS_FILTERS.join(', ')}`);
  }
  return value;
}

export function isActiveStatus(status: ThreadStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

/** Statuses matched by a filter, or `undefined` when the filter matches everything. */
export function statusesForFilter(
  filter: StatusFilter | undefined,
): readonly ThreadStatus[] | undefined {
  if (!filter || filter === 'all') return undefined;
  if (filter === 'active') return ACTIVE_STATUSES;
  return [filter];
}

export function matchesStatusFilter(
  status: ThreadStatus,
  filter: StatusFilter | undefined,
): boolean {
  const statuses = statusesForFilter(filter);
  return !statuses || statuses.includes(status);
}

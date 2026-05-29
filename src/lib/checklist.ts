// Next order value for a new checklist item: one past the highest order among
// non-archived items. Ignoring archived items prevents the order from drifting
// when items are archived and new ones added.
export function nextOrder(
  items: { order: number; archived: boolean }[],
): number {
  return (
    items
      .filter((i) => !i.archived)
      .reduce((max, i) => Math.max(max, i.order), 0) + 1
  )
}

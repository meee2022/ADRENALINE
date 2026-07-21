/**
 * Approved orders store immutable meal snapshots without editor slot fields.
 * If a nutritionist later rebuilds that day, the editor-managed rows are the
 * authoritative plan. Keeping both sets would double meals in kitchen output.
 */
export function getEffectivePlanItems(planOrItems: any): any[] {
  const items = Array.isArray(planOrItems)
    ? planOrItems
    : Array.isArray(planOrItems?.items)
      ? planOrItems.items
      : [];

  const isImportedOrderSnapshot = (item: any) =>
    Boolean(item?.mealId) &&
    !item?.menuItemId &&
    !item?.id &&
    !item?.categoryId;

  const importedCount = items.filter(isImportedOrderSnapshot).length;
  const editorManagedCount = items.filter(
    (item: any) => Boolean(item?.id || item?.categoryId || item?.menuItemId),
  ).length;

  // Only collapse a proven one-for-one duplicate set. Unequal mixed plans may
  // contain an intentional extra row and must stay visible for manual review.
  if (!importedCount || importedCount !== editorManagedCount) return items;
  return items.filter((item: any) => !isImportedOrderSnapshot(item));
}

/**
 * Helper to generate page numbers array with ellipsis for pagination UI.
 * e.g. [1, 2, 3, 4, 5], [1, 2, 3, '...', 10], [1, '...', 4, 5, 6, '...', 10]
 */
export function getPaginationRange(
  currentPage: number,
  totalPages: number,
  siblingCount = 1
): (number | string)[] {
  if (totalPages <= 1) return [1]

  // Total numbers to show = siblingCount + firstPage + lastPage + currentPage + 2*dots
  const totalNumbers = siblingCount * 2 + 5

  // Case 1: If total pages is less than page numbers we want to show
  if (totalNumbers >= totalPages) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  const leftSiblingIndex = Math.max(currentPage - siblingCount, 1)
  const rightSiblingIndex = Math.min(currentPage + siblingCount, totalPages)

  const shouldShowLeftDots = leftSiblingIndex > 2
  const shouldShowRightDots = rightSiblingIndex < totalPages - 1

  const firstPageIndex = 1
  const lastPageIndex = totalPages

  // Case 2: No left dots, but right dots
  if (!shouldShowLeftDots && shouldShowRightDots) {
    const leftItemCount = 3 + 2 * siblingCount
    const leftRange = Array.from({ length: leftItemCount }, (_, i) => i + 1)
    return [...leftRange, '...', totalPages]
  }

  // Case 3: No right dots, but left dots
  if (shouldShowLeftDots && !shouldShowRightDots) {
    const rightItemCount = 3 + 2 * siblingCount
    const rightRange = Array.from(
      { length: rightItemCount },
      (_, i) => totalPages - rightItemCount + i + 1
    )
    return [firstPageIndex, '...', ...rightRange]
  }

  // Case 4: Both left and right dots
  if (shouldShowLeftDots && shouldShowRightDots) {
    const middleRange = Array.from(
      { length: rightSiblingIndex - leftSiblingIndex + 1 },
      (_, i) => leftSiblingIndex + i
    )
    return [firstPageIndex, '...', ...middleRange, '...', lastPageIndex]
  }

  return Array.from({ length: totalPages }, (_, i) => i + 1)
}

/**
 * Helper to slice an array of items for current page.
 */
export function paginateArray<T>(items: T[], currentPage: number, pageSize: number): T[] {
  if (!items || items.length === 0) return []
  const safePage = Math.max(1, currentPage)
  const safePageSize = Math.max(1, pageSize)
  const startIndex = (safePage - 1) * safePageSize
  return items.slice(startIndex, startIndex + safePageSize)
}

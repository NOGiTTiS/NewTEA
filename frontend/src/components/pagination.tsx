'use client'

import * as React from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react'
import { getPaginationRange } from '@/lib/pagination'

export interface PaginationProps {
  currentPage: number
  totalPages: number
  totalItems: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
  pageSizeOptions?: number[]
  className?: string
  siblingCount?: number
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  className = '',
  siblingCount = 1
}: PaginationProps) {
  if (totalItems === 0) {
    return null
  }

  const safeCurrentPage = Math.max(1, Math.min(currentPage, Math.max(1, totalPages)))
  const startItem = Math.min((safeCurrentPage - 1) * pageSize + 1, totalItems)
  const endItem = Math.min(safeCurrentPage * pageSize, totalItems)

  const paginationRange = getPaginationRange(safeCurrentPage, totalPages, siblingCount)

  const isFirstPage = safeCurrentPage <= 1
  const isLastPage = safeCurrentPage >= totalPages

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-4 py-3 px-2 text-xs sm:text-sm text-muted-foreground ${className}`}
      aria-label="การแบ่งหน้า"
    >
      {/* Items Count Summary & Page Size Selector */}
      <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
        <span>
          แสดง <strong className="text-foreground font-semibold">{startItem}</strong> ถึง{' '}
          <strong className="text-foreground font-semibold">{endItem}</strong> จาก{' '}
          <strong className="text-foreground font-semibold">{totalItems}</strong> รายการ
        </span>

        {onPageSizeChange && pageSizeOptions && pageSizeOptions.length > 1 && (
          <div className="flex items-center gap-1.5 ml-auto sm:ml-2">
            <span className="text-xs text-muted-foreground hidden xs:inline">แสดง:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value))
                onPageChange(1)
              }}
              className="bg-card text-foreground border border-border rounded-lg px-2 py-1 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors cursor-pointer"
              aria-label="จำนวนรายการต่อหน้า"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt} / หน้า
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Navigation Controls */}
      <div className="flex items-center gap-1 w-full sm:w-auto justify-center sm:justify-end">
        {/* First Page */}
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={isFirstPage}
          className="p-1.5 sm:p-2 rounded-xl border border-border bg-card text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
          aria-label="หน้าแรก"
          title="หน้าแรก"
        >
          <ChevronsLeft className="w-4 h-4 shrink-0" />
        </button>

        {/* Previous Page */}
        <button
          type="button"
          onClick={() => onPageChange(safeCurrentPage - 1)}
          disabled={isFirstPage}
          className="p-1.5 sm:p-2 rounded-xl border border-border bg-card text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
          aria-label="หน้าก่อนหน้า"
          title="หน้าก่อนหน้า"
        >
          <ChevronLeft className="w-4 h-4 shrink-0" />
        </button>

        {/* Numeric Page Buttons */}
        <div className="flex items-center gap-1">
          {paginationRange.map((pageNumber, idx) => {
            if (typeof pageNumber === 'string') {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="px-2 py-1 text-muted-foreground select-none text-xs"
                >
                  …
                </span>
              )
            }

            const isActive = pageNumber === safeCurrentPage
            return (
              <button
                key={pageNumber}
                type="button"
                onClick={() => onPageChange(pageNumber)}
                aria-current={isActive ? 'page' : undefined}
                className={`min-w-8 h-8 sm:min-w-9 sm:h-9 px-2 flex items-center justify-center rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-xs font-bold'
                    : 'border border-border bg-card text-foreground hover:bg-muted hover:border-brand-300 dark:hover:border-brand-700'
                }`}
              >
                {pageNumber}
              </button>
            )
          })}
        </div>

        {/* Next Page */}
        <button
          type="button"
          onClick={() => onPageChange(safeCurrentPage + 1)}
          disabled={isLastPage}
          className="p-1.5 sm:p-2 rounded-xl border border-border bg-card text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
          aria-label="หน้าถัดไป"
          title="หน้าถัดไป"
        >
          <ChevronRight className="w-4 h-4 shrink-0" />
        </button>

        {/* Last Page */}
        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={isLastPage}
          className="p-1.5 sm:p-2 rounded-xl border border-border bg-card text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
          aria-label="หน้าสุดท้าย"
          title="หน้าสุดท้าย"
        >
          <ChevronsRight className="w-4 h-4 shrink-0" />
        </button>
      </div>
    </div>
  )
}

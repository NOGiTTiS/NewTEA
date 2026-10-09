'use client'

import React, { useEffect, useState } from 'react'
import { FileText, Loader2, AlertCircle, ExternalLink } from 'lucide-react'

interface PdfPagesRendererProps {
  pdfUrl: string
  title: string
  courseCode?: string
  footerLabel?: string
}

export function PdfPagesRenderer({
  pdfUrl,
  title,
  courseCode,
  footerLabel = 'แบบ ปพ.5 — โรงเรียนเตรียมอุดมศึกษา ภาคเหนือ'
}: PdfPagesRendererProps) {
  const [pages, setPages] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isCancelled = false

    const renderPdf = async () => {
      try {
        setIsLoading(true)
        setError(null)

        // Dynamically import pdfjs-dist in client
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

        const loadingTask = pdfjsLib.getDocument({ url: pdfUrl })
        const pdf = await loadingTask.promise

        const renderedPageUrls: string[] = []

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          if (isCancelled) return

          const page = await pdf.getPage(pageNum)
          // Use scale 2.0 for crisp 300DPI-like print quality
          const viewport = page.getViewport({ scale: 2.0 })

          const canvas = document.createElement('canvas')
          const context = canvas.getContext('2d')

          if (!context) continue

          canvas.height = viewport.height
          canvas.width = viewport.width

          await page.render({
            canvasContext: context,
            canvas: canvas,
            viewport: viewport
          }).promise

          const dataUrl = canvas.toDataURL('image/png')
          renderedPageUrls.push(dataUrl)
        }

        if (!isCancelled) {
          setPages(renderedPageUrls)
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          console.error('PDF rendering failed:', err)
          setError(err instanceof Error ? err.message : 'ไม่สามารถแสดงผลไฟล์ PDF ได้')
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    renderPdf()

    return () => {
      isCancelled = true
    }
  }, [pdfUrl])

  if (isLoading) {
    return (
      <section className="bg-white text-black shadow-md border border-slate-200 min-h-[297mm] p-[16mm] flex flex-col justify-center items-center mb-8 page-break print:shadow-none print:border-none print:m-0 print:p-[12mm]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
          <p className="text-sm font-semibold text-slate-700">กำลังประมวลผลหน้าเอกสาร PDF ({title})...</p>
          <span className="text-xs text-slate-400">ระบบกำลังเรนเดอร์เอกสารทุกหน้าสำหรับจัดพิมพ์ ปพ.5</span>
        </div>
      </section>
    )
  }

  if (error || pages.length === 0) {
    return (
      <section className="bg-white text-black shadow-md border border-slate-200 min-h-[297mm] p-[16mm] flex flex-col justify-between mb-8 page-break print:shadow-none print:border-none print:m-0 print:p-[12mm]">
        <div className="border-b-2 border-black pb-3 text-center space-y-1">
          <h2 className="text-xl font-bold tracking-tight text-black">{title}</h2>
          {courseCode && <p className="text-xs text-black">รหัสวิชา {courseCode}</p>}
        </div>

        <div className="p-8 rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50 text-center space-y-3 my-auto">
          <AlertCircle className="w-12 h-12 text-amber-600 mx-auto" />
          <p className="text-sm font-bold text-black">ไม่สามารถแสดงตัวอย่างหน้าเอกสาร PDF ในโหมดพิมพ์โดยตรงได้</p>
          <p className="text-xs text-slate-600">({error || 'ไม่พบหน้าเอกสารในไฟล์'})</p>
          <a
            href={pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
          >
            เปิดดูไฟล์ PDF ต้นฉบับ <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        <div className="pt-4 border-t border-slate-300 text-[10px] text-slate-600 flex justify-between">
          <span>{footerLabel}</span>
          <span>{title}</span>
        </div>
      </section>
    )
  }

  return (
    <>
      {pages.map((pageDataUrl, index) => (
        <section
          key={index}
          className="bg-white text-black shadow-md border border-slate-200 min-h-[297mm] p-[10mm] flex flex-col justify-between mb-8 page-break print:shadow-none print:border-none print:m-0 print:p-[8mm]"
        >
          {/* Header */}
          <div className="border-b border-black pb-2 text-center space-y-0.5">
            <div className="flex justify-between items-center text-[10px] font-semibold text-slate-700">
              <span>{courseCode ? `รหัสวิชา ${courseCode}` : ''}</span>
              <span>
                {title} (หน้าที่ {index + 1} จาก {pages.length})
              </span>
            </div>
          </div>

          {/* Rendered PDF Page Content */}
          <div className="my-auto flex justify-center items-center py-2">
            <img
              src={pageDataUrl}
              alt={`${title} หน้าที่ ${index + 1}`}
              className="max-h-[250mm] w-auto max-w-full object-contain mx-auto shadow-xs border border-slate-200 print:shadow-none print:border-none"
            />
          </div>

          {/* Footer */}
          <div className="pt-2 border-t border-black text-[10px] text-slate-700 flex justify-between">
            <span>{footerLabel}</span>
            <span>
              {title} (หน้า {index + 1}/{pages.length})
            </span>
          </div>
        </section>
      ))}
    </>
  )
}

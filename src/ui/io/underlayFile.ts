// Track B (B5.1): read an imported PNG, JPG, or PDF (page 1) into an image the plan can show.
// pdf.js is loaded only when a PDF is imported, so it stays out of the main bundle and the tests.

import type { UnderlayImage } from './underlay'

/** PDF pages are rendered at this multiple of their natural size, for sharper tracing. */
const PDF_SCALE = 2

export async function readUnderlayFile(file: File): Promise<UnderlayImage> {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  if (isPdf) return renderPdfFirstPage(file)
  if (!/^image\/(png|jpeg)$/.test(file.type) && !/\.(png|jpe?g)$/i.test(file.name)) {
    throw new Error('Choose a PNG, JPG, or PDF file.')
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`))
    reader.readAsDataURL(file)
  })
  const { width, height } = await imageSize(dataUrl)
  return { dataUrl, widthPx: width, heightPx: height }
}

async function renderPdfFirstPage(file: File): Promise<UnderlayImage> {
  const pdfjs = await import('pdfjs-dist')
  const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
  try {
    const pdf = await task.promise
    const page = await pdf.getPage(1)
    const viewport = page.getViewport({ scale: PDF_SCALE })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    await page.render({ canvas, viewport }).promise
    return { dataUrl: canvas.toDataURL('image/png'), widthPx: canvas.width, heightPx: canvas.height }
  } finally {
    void task.destroy() // frees the worker
  }
}

function imageSize(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
    image.onerror = () => reject(new Error('That image could not be opened.'))
    image.src = dataUrl
  })
}

import { useRef, useState, DragEvent, ChangeEvent } from 'react'
import { supabase } from '../lib/supabaseClient'

interface ReceiptUploaderProps {
  isOpen: boolean
  onClose: () => void
  onUploaded: (receiptId: string) => void
}

const API_BASE = import.meta.env.VITE_API_BASE_URL as string

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
]

export function ReceiptUploader({
  isOpen,
  onClose,
  onUploaded,
}: ReceiptUploaderProps) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  function selectFile(selected: File) {
    setError(null)
    if (!ALLOWED_TYPES.includes(selected.type)) {
      setError('Invalid file type. Please upload a JPEG, PNG, WebP, or HEIC image.')
      return
    }
    setFile(selected)
    setPreview(URL.createObjectURL(selected))
  }

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (selected) selectFile(selected)
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(true)
  }

  function handleDragLeave() {
    setDragging(false)
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(false)
    const dropped = e.dataTransfer.files?.[0]
    if (dropped) selectFile(dropped)
  }

  function handleClose() {
    if (uploading) return
    setFile(null)
    setPreview(null)
    setError(null)
    setDragging(false)
    onClose()
  }

  async function handleUpload() {
    if (!file) return
    setUploading(true)
    setError(null)

    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) throw new Error('Not authenticated')

      const formData = new FormData()
      formData.append('receipt', file)

      const res = await fetch(`${API_BASE}/api/receipts/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      if (!res.ok) {
        let message = res.statusText
        try {
          const body = (await res.json()) as { error?: string }
          if (body.error) message = body.error
        } catch {
          // ignore
        }
        throw new Error(message)
      }

      const result = (await res.json()) as { id: string; status: string }
      onUploaded(result.id)
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div style={styles.overlay} onClick={handleClose}>
      <div style={styles.card} onClick={(e) => e.stopPropagation()}>
        <h2 style={styles.title}>Upload Receipt</h2>

        {/* Drop zone */}
        <div
          style={{
            ...styles.dropZone,
            ...(dragging ? styles.dropZoneActive : {}),
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          {preview ? (
            <img src={preview} alt="Receipt preview" style={styles.preview} />
          ) : (
            <p style={styles.dropHint}>
              Drag &amp; drop a receipt image here, or{' '}
              <span style={styles.browseLink}>browse</span>
            </p>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={handleInputChange}
        />

        {/* File name + size */}
        {file && (
          <p style={styles.fileMeta}>
            {file.name} — {formatBytes(file.size)}
          </p>
        )}

        {/* Error */}
        {error && <p style={styles.errorText}>{error}</p>}

        {/* Actions */}
        <div style={styles.actions}>
          <button
            style={styles.cancelBtn}
            onClick={handleClose}
            disabled={uploading}
          >
            Cancel
          </button>
          <button
            style={{
              ...styles.uploadBtn,
              ...((!file || uploading) ? styles.uploadBtnDisabled : {}),
            }}
            onClick={handleUpload}
            disabled={!file || uploading}
          >
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  card: {
    background: '#ffffff',
    borderRadius: '8px',
    padding: '24px',
    width: '100%',
    maxWidth: '460px',
    margin: '16px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
  },
  title: {
    margin: '0 0 16px 0',
    fontSize: '18px',
    fontWeight: 600,
    color: '#1f2328',
  },
  dropZone: {
    border: '2px dashed #e5e7eb',
    borderRadius: '6px',
    padding: '24px',
    textAlign: 'center',
    cursor: 'pointer',
    minHeight: '140px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'border-color 0.15s',
  },
  dropZoneActive: {
    borderColor: '#3b82d4',
    backgroundColor: '#f0f6ff',
  },
  dropHint: {
    margin: 0,
    color: '#57606a',
    fontSize: '14px',
    userSelect: 'none',
  },
  browseLink: {
    color: '#3b82d4',
    textDecoration: 'underline',
    cursor: 'pointer',
  },
  preview: {
    maxWidth: '100%',
    maxHeight: '200px',
    borderRadius: '4px',
    objectFit: 'contain',
  },
  fileMeta: {
    margin: '8px 0 0 0',
    fontSize: '13px',
    color: '#57606a',
  },
  errorText: {
    margin: '8px 0 0 0',
    fontSize: '13px',
    color: '#d73a49',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    marginTop: '20px',
  },
  cancelBtn: {
    padding: '8px 16px',
    fontSize: '14px',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    background: '#ffffff',
    cursor: 'pointer',
    color: '#1f2328',
  },
  uploadBtn: {
    padding: '8px 20px',
    fontSize: '14px',
    border: 'none',
    borderRadius: '6px',
    background: '#3b82d4',
    color: '#ffffff',
    cursor: 'pointer',
    fontWeight: 500,
  },
  uploadBtnDisabled: {
    background: '#a0b9d8',
    cursor: 'not-allowed',
  },
}

import React, { useRef, useState } from 'react'
import { Upload, X, ImageIcon } from 'lucide-react'
import { uploadApi } from '@flowtap/api-core'
import { cn } from '@flowtap/shared'

interface ImageUploadProps {
  value?: string         // current image URL
  onChange: (url: string) => void
  folder?: string
  className?: string
  label?: string
}

export const ImageUpload: React.FC<ImageUploadProps> = ({
  value,
  onChange,
  folder = 'products',
  className,
  label = 'Product Image',
}) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState('')

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be smaller than 5 MB')
      return
    }
    setError('')
    setUploading(true)
    try {
      const res = await uploadApi.uploadFile(file, folder)
      onChange(res.data.data.url)
    } catch {
      // If upload API not available, create a local object URL for preview
      const localUrl = URL.createObjectURL(file)
      onChange(localUrl)
    } finally {
      setUploading(false)
    }
  }

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div className={cn('space-y-1', className)}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
      )}

      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          'relative w-full h-36 rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors',
          dragOver
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800/50',
          uploading && 'pointer-events-none opacity-60',
        )}
      >
        {value ? (
          <>
            <img
              src={value}
              alt="Product"
              className="absolute inset-0 w-full h-full object-cover rounded-xl"
            />
            <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); inputRef.current?.click() }}
                  className="p-2 bg-white rounded-lg shadow text-gray-700 hover:text-blue-600 transition-colors"
                  title="Change image"
                >
                  <Upload className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onChange('') }}
                  className="p-2 bg-white rounded-lg shadow text-gray-700 hover:text-red-600 transition-colors"
                  title="Remove image"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 p-4 text-center">
            {uploading ? (
              <>
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-gray-500">Uploading…</p>
              </>
            ) : (
              <>
                <ImageIcon className="w-8 h-8 text-gray-300 dark:text-gray-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Click or drag to upload
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    PNG, JPG, WEBP — max 5 MB
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onInputChange}
      />
    </div>
  )
}

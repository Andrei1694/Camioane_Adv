import { useEffect, useId, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSession } from '../../../auth/session'
import { api, errorMessage } from '../../../lib/api'
import { fileKind, fileTypeLabel } from '../../../lib/file'
import type { StoredFile } from '../../../lib/file'
import { formatByteSize, formatLocalDay, formatLocalTime } from '../../../lib/format'
import { saveBlob } from '../saveFile'
import OwnerLabel from './OwnerLabel'

export default function FilePreviewDialog({ file, onClose }: { file: StoredFile, onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const revision = useSession((state) => state.revision)
  const id = useId()
  const kind = fileKind(file.mimeType)
  // The API has no thumbnails or range playback, so the preview loads the whole file once.
  const content = useQuery({
    queryKey: ['file-content', revision, file.id],
    queryFn: ({ signal }) => api.downloadFile(file, signal),
    enabled: kind !== 'other',
    gcTime: 0,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
  const [unplayable, setUnplayable] = useState(false)
  const image = useRef<HTMLImageElement>(null)
  const video = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const element = dialog.current
    if (element && !element.open) element.showModal()
  }, [])

  // The media element reads the file through an object URL, which holds it in memory until revoked.
  useEffect(() => {
    const element = kind === 'image' ? image.current : video.current
    if (!content.data || !element) return
    const url = URL.createObjectURL(content.data)
    element.src = url
    return () => {
      element.removeAttribute('src')
      URL.revokeObjectURL(url)
    }
  }, [content.data, kind, unplayable])

  const size = formatByteSize(file.size)

  return (
    <dialog ref={dialog} className="preview-dialog" aria-labelledby={`${id}-title`} aria-describedby={`${id}-sub`} onClose={onClose}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return
        const bounds = event.currentTarget.getBoundingClientRect()
        if (event.clientX < bounds.left || event.clientX > bounds.right
          || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.current?.close()
      }}>
      <div className="preview-head">
        <div>
          <h2 id={`${id}-title`}>{file.originalName}</h2>
          <p className="preview-sub" id={`${id}-sub`}>
            {/* Non-breaking spaces keep each separator at the end of its line when the subline wraps. */}
            {fileTypeLabel(file.mimeType)}{'\u00a0· '}<span className="num">{size}</span>{'\u00a0· '}
            {formatLocalDay(file.createdAt)}, <span className="num">{formatLocalTime(file.createdAt)}</span>{'\u00a0· '}
            <OwnerLabel ownerId={file.ownerId} />
          </p>
        </div>
        <button type="button" className="icon-button" aria-label="Close preview" onClick={() => dialog.current?.close()}>
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m6 6 12 12M6 18 18 6" /></svg>
        </button>
      </div>

      <div className="preview-media">
        {kind === 'other' ? <p className="preview-note">This file type can't be previewed. Download it to open it.</p>
          : content.isError ? (
            <div className="request-error" role="alert">
              <p>Couldn't load the preview. {errorMessage(content.error)}</p>
              <button type="button" disabled={content.isFetching} onClick={() => void content.refetch()}>
                {content.isFetching ? 'Retrying…' : 'Retry'}
              </button>
            </div>
          )
          : !content.data ? <p className="preview-note" role="status">Loading preview ({size})…</p>
          : unplayable ? <p className="preview-note" role="alert">This browser can't show this file. Download it to check it.</p>
          : kind === 'image' ? <img ref={image} alt={`Preview of ${file.originalName}`} onError={() => setUnplayable(true)} />
          : <video ref={video} controls playsInline preload="metadata" aria-label={`Preview of ${file.originalName}`} onError={() => setUnplayable(true)} />}
      </div>

      <div className="preview-actions">
        <button type="button" disabled={!content.data} onClick={() => content.data && saveBlob(content.data, file.originalName)}>
          Download<span className="sr-only"> {file.originalName}</span>
        </button>
      </div>
    </dialog>
  )
}

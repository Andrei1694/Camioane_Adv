import { useEffect, useRef, useState } from 'react'
import { skipToken, useQuery } from '@tanstack/react-query'
import { useSession } from '../auth/session'
import { api } from '../lib/api'
import type { User } from '../lib/user'
import './Avatar.css'

/**
 * A user's profile picture in a circle, or the first letter of their email while it loads,
 * when they have none, or when it can't be shown. Without a label it is decorative, because
 * the email sits beside it.
 */
export default function Avatar({ user, size, label }: { user: User, size: 32 | 40 | 96, label?: string }) {
  const revision = useSession((state) => state.revision)
  const { avatar } = user
  // updatedAt changes with each upload, so a new picture is a new query and the old one ages out.
  const picture = useQuery({
    queryKey: ['avatar', revision, user.id, avatar?.updatedAt],
    queryFn: avatar ? ({ signal }) => api.avatarImage(avatar, signal) : skipToken,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
  const [broken, setBroken] = useState<Blob | null>(null)
  const image = useRef<HTMLImageElement>(null)
  const blob = avatar && picture.data !== broken ? picture.data : undefined

  // The image reads the picture through an object URL, which holds it in memory until revoked.
  useEffect(() => {
    const element = image.current
    if (!blob || !element) return
    const url = URL.createObjectURL(blob)
    element.src = url
    return () => {
      element.removeAttribute('src')
      URL.revokeObjectURL(url)
    }
  }, [blob])

  const initial = Array.from(user.email)[0]?.toUpperCase() ?? '?'

  return (
    <span className={`avatar avatar-${size}`} {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}>
      <span aria-hidden="true">{initial}</span>
      {blob && <img ref={image} alt="" draggable={false} onError={() => setBroken(blob)} />}
    </span>
  )
}

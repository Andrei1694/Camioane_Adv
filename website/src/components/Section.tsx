import type { ReactNode } from 'react'

/** A page section: its heading and lead on the left, the content on the right (stacked on narrow screens). */
export default function Section({ id, title, lead, children }: {
  id: string
  title: string
  lead: ReactNode
  children: ReactNode
}) {
  const headingId = `${id}-title`
  return (
    <section id={id} className="section" aria-labelledby={headingId}>
      <div className="container section-grid">
        <div>
          <h2 id={headingId}>{title}</h2>
          <p className="section-lead">{lead}</p>
        </div>
        <div className="section-body">{children}</div>
      </div>
    </section>
  )
}

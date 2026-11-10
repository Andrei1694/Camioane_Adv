import type { ReactNode } from 'react'

/**
 * A page section with its heading and lead. `split` places them beside the content (the contact
 * band); `stacked` places them above the full-width content. Both stack below 1024px.
 */
export default function Section({ id, title, lead, layout = 'split', className, children }: {
  id: string
  title: string
  lead: ReactNode
  layout?: 'split' | 'stacked'
  className?: string
  children: ReactNode
}) {
  const headingId = `${id}-title`
  return (
    <section id={id} className={className ? `section ${className}` : 'section'} aria-labelledby={headingId}>
      <div className={`container section-${layout}`}>
        <div className="section-head">
          <h2 id={headingId}>{title}</h2>
          <p className="section-lead">{lead}</p>
        </div>
        <div className="section-body">{children}</div>
      </div>
    </section>
  )
}

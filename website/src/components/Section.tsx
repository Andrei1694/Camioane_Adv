import type { ReactNode } from 'react'

/**
 * A page section with its heading and lead. `split` puts them in the left third and the content in
 * the right two thirds; `stacked` puts them above content that spans the whole column. Both stack
 * into one column on narrow screens.
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

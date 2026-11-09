import { useState } from 'react'
import Section from '../components/Section'
import { contactEmail, contactHref } from '../lib/contact'

// A mailto: link does nothing without a mail app, so offer to copy the address where the browser can.
const canCopy = typeof navigator !== 'undefined' && 'clipboard' in navigator

const copyMessages = {
  idle: '',
  copied: 'Adresa a fost copiată.',
  failed: 'Adresa nu a putut fi copiată. Selecteaz-o și copiaz-o manual.',
}

export default function Contact() {
  const [copyState, setCopyState] = useState<keyof typeof copyMessages>('idle')

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(contactEmail)
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
  }

  return (
    <Section
      id="contact"
      title="Planifică prima ta campanie"
      lead="Spune-ne ce trasee, date și ore ai în vedere și câte mașini dorești. Îți răspundem cu tarifele și disponibilitatea."
      layout="stacked"
      className="section-closing"
    >
      <div className="contact-actions">
        <a className="button" href={contactHref}>Scrie-ne</a>
        <p className="contact-address">{contactEmail}</p>
        {canCopy && <button type="button" className="button" onClick={copyAddress}>Copiază adresa</button>}
      </div>
      <p className="contact-status" role="status">{copyMessages[copyState]}</p>
    </Section>
  )
}

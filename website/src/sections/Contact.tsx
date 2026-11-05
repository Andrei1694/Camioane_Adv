import { useState } from 'react'
import Section from '../components/Section'
import { contactEmail, contactHref } from '../lib/contact'

// A mailto: link does nothing without a mail app, so offer to copy the address where the browser can.
const canCopy = typeof navigator !== 'undefined' && 'clipboard' in navigator

const copyMessages = {
  idle: '',
  copied: 'Address copied.',
  failed: "Couldn't copy. Select the address instead.",
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
      title="Plan your first campaign"
      lead="Tell us the routes, dates and times you have in mind, and how many cars. We'll reply with the rates and availability."
      layout="stacked"
      className="section-closing"
    >
      <div className="contact-actions">
        <a className="button" href={contactHref}>Email us</a>
        <p className="contact-address">{contactEmail}</p>
        {canCopy && <button type="button" className="button" onClick={copyAddress}>Copy address</button>}
      </div>
      <p className="contact-status" role="status">{copyMessages[copyState]}</p>
    </Section>
  )
}

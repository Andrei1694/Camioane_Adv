import Section from '../components/Section'
import { contactEmail, contactHref } from '../lib/contact'

export default function Contact() {
  return (
    <Section
      id="contact"
      title="Plan your first campaign"
      lead="Tell us the routes, dates and times you have in mind, and how many cars. We'll reply with the rates and availability."
    >
      <div className="contact-actions">
        <a className="button" href={contactHref}>Email us</a>
        <p className="contact-address">Our address: <span>{contactEmail}</span></p>
      </div>
    </Section>
  )
}

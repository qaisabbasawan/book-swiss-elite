import { useState } from 'react';
import '../styles/landing.css';

function scrollToForm() {
  const el = document.getElementById('book-form');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (window.gtag) window.gtag('event', 'cta_click', { event_category: 'engagement' });
}

const SERVICES = [
  {
    title: 'Airport Transfers',
    desc: 'Reliable, punctual transfers from Geneva Airport (GVA) and Zurich Airport (ZRH). We monitor your flight in real time — if it’s delayed, we adjust the pick-up automatically at no extra cost.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="22"><path d="M2.5 19h19M6 19l1.5-9L20 6.5c1-.3 1.7.7 1.2 1.6L18 13.5l-4 1-3.5 4.5"/></svg>
    ),
  },
  {
    title: 'Ski Resort Transfers',
    desc: 'Direct, door-to-resort transfers to the finest ski destinations in Switzerland and the French Alps — winter-ready vehicles, mountain-experienced drivers, ample space for ski equipment.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="22"><path d="M4 20l6-6M14 20l-3-9M8 14l3-8 3 2M17 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM4 12l4-2 3 2"/></svg>
    ),
  },
  {
    title: 'Long Distance & Executive Travel',
    desc: 'Seamless intercity and cross-border journeys across Switzerland and into France and Italy — ideal for corporate roadshows, diplomatic travel, or arriving refreshed and on time.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="22"><path d="M3 12h18M3 6h18M3 18h12"/></svg>
    ),
  },
];

const FLEET = [
  { id: 'tesla-model-y', name: 'Tesla Model Y', tag: 'Modern. Electric. Luxury.', desc: 'A zero-emission executive SUV with a premium interior, generous luggage space and Autopilot — for clients who want luxury with a lighter footprint.', image: '/assets/tesla-model-y.jpg' },
  { id: 'mercedes-s-class', name: 'Mercedes S-Class', tag: 'Executive comfort and refinement.', desc: 'Our flagship sedan — massage seats, Maybach-level comfort, and a hushed cabin built for business travel and VIP arrivals.', image: '/assets/mercedes-s-class.jpg' },
  { id: 'mercedes-v-class', name: 'Mercedes V-Class', tag: 'Spacious and perfect for group travel.', desc: 'A luxury MPV seating up to 7 with room for ski equipment and group luggage — ideal for families and business delegations.', image: '/assets/mercedes-v-class.jpg' },
];

const WHY = [
  { title: 'Professional Chauffeurs', desc: 'Every driver is licensed, fully vetted, and trained in VIP hospitality. Fluent in English, discreet, and dedicated to your comfort.', icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="20"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4.5 5-6 8-6s6.5 1.5 8 6"/></svg>) },
  { title: 'On Time Service', desc: 'We track your flight, monitor road conditions, and plan every journey in advance. Your time is valuable — we treat it accordingly.', icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="20"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>) },
  { title: 'Premium Vehicles', desc: 'Travel in a spotless Mercedes S-Class, Tesla Model Y, or Mercedes V-Class — each maintained to the highest standard for every journey.', icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="20"><path d="M3 13l1.5-5A2 2 0 0 1 6.4 6.5h11.2A2 2 0 0 1 19.5 8L21 13v6h-3v-2H6v2H3v-6Z"/><circle cx="7.5" cy="16.5" r="1.2"/><circle cx="16.5" cy="16.5" r="1.2"/></svg>) },
  { title: 'Nationwide Coverage', desc: 'From Geneva and Zurich to Bern, Interlaken, and every major ski resort — across all of Switzerland and into France and Italy.', icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="20"><path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12Z"/><circle cx="12" cy="9" r="2.5"/></svg>) },
  { title: '24/7 Availability', desc: 'Early morning flight? Late-night arrival? We are always available — by phone, WhatsApp, or our online booking system.', icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="20"><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></svg>) },
  { title: 'Fixed, Transparent Pricing', desc: 'No taxi meters, no surge pricing, no hidden fees. Your fixed price is set at booking — it never changes, regardless of traffic or delays.', icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="20"><path d="M12 2v20M17 5.5H9.5a3 3 0 0 0 0 6h5a3 3 0 0 1 0 6H6"/></svg>) },
];

const CITIES = ['Geneva', 'Zurich', 'Bern', 'Basel', 'Lausanne', 'Interlaken', 'Zermatt', 'Verbier', 'St. Moritz', 'Courchevel', 'Chamonix', 'Megève', "Val d'Isère"];

const ROUTES = [
  'Geneva Airport → Courchevel', 'Zurich Airport → St. Moritz',
  'Geneva Airport → Chamonix', 'Zurich Airport → Verbier',
  'Geneva Airport → Zermatt', 'Zurich Airport → Interlaken',
];

const FAQS = [
  { q: 'How do I book a transfer with Swiss Elite Transfers?', a: 'You can book instantly online right here, send us a WhatsApp message on +41 78 322 8820, or call us directly. We are available 24 hours a day, 7 days a week.' },
  { q: 'Do you track my flight for airport transfers?', a: 'Yes. We monitor all incoming flights in real time. If your flight is delayed, we automatically adjust the pick-up time at no extra cost. You will never be waiting on the pavement.' },
  { q: 'Can you transport ski equipment to the resorts?', a: 'Absolutely. All vehicles have ample storage for ski bags, boot bags, helmets, and suitcases. For groups with extensive equipment, we recommend our Mercedes V-Class.' },
  { q: 'What is included in the price?', a: 'All our prices are fixed and all-inclusive: professional chauffeur, fuel, motorway tolls, waiting time, bottled water, and Wi-Fi where available. There are no hidden fees or surprises.' },
  { q: 'Do you serve destinations outside Switzerland?', a: 'Yes. We regularly serve cross-border destinations including Courchevel, Chamonix, Megève, Annecy, and Milan. Contact us to arrange your international transfer.' },
  { q: 'What is your cancellation policy?', a: 'We offer free cancellation up to 24 hours before your scheduled transfer. For changes or late cancellations, please contact us directly via WhatsApp — we are always happy to assist.' },
];

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`faq-item ${open ? 'open' : ''}`}>
      <button className="faq-question" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        {q}
        <svg className="faq-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      <div className="faq-answer"><p>{a}</p></div>
    </div>
  );
}

export default function LandingContent() {
  return (
    <div className="landing">

      {/* Trust strip */}
      <div className="trust-strip">
        <span className="trust-chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14"><path d="M20 6L9 17l-5-5"/></svg>Fixed, All-Inclusive Pricing</span>
        <span className="trust-chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14"><path d="M20 6L9 17l-5-5"/></svg>Real-Time Flight Tracking</span>
        <span className="trust-chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14"><path d="M20 6L9 17l-5-5"/></svg>24/7 Availability</span>
        <span className="trust-chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14"><path d="M20 6L9 17l-5-5"/></svg>Free Cancellation (24h)</span>
      </div>

      {/* Services */}
      <section className="landing-section" id="services">
        <div className="landing-eyebrow">Our Premium Services</div>
        <h2 className="landing-h2">Private Chauffeur Services Across Switzerland</h2>
        <p className="landing-lead">
          Swiss Elite Transfers delivers premium chauffeur services, luxury airport transfers, executive
          business travel, and private ski resort transfers across Switzerland, France, and Italy.
        </p>
        <div className="landing-grid-3">
          {SERVICES.map(s => (
            <div className="landing-card" key={s.title}>
              <div className="landing-card-icon">{s.icon}</div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
              <button className="landing-card-link" onClick={scrollToForm}>
                Book This Transfer
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
              </button>
            </div>
          ))}
        </div>
      </section>

      <div className="landing-sticky-zone">

      {/* Fleet */}
      <section className="landing-section" id="fleet">
        <div className="landing-eyebrow">Our Luxury Fleet</div>
        <h2 className="landing-h2">A Vehicle for Every Journey</h2>
        <p className="landing-lead">
          Each vehicle in our fleet is maintained to the exacting standards you expect from a premium
          Swiss chauffeur service — immaculate, equipped, and ready for your journey.
        </p>
        <div className="landing-grid-3">
          {FLEET.map(v => (
            <div className="fleet-card" key={v.id}>
              <div className="fleet-img-wrap"><img src={v.image} alt={`${v.name} chauffeur service Switzerland`} loading="lazy" /></div>
              <div className="fleet-info">
                <h3>{v.name}</h3>
                <p><em>{v.tag}</em> {v.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Why choose us */}
      <section className="landing-section" id="why-us">
        <div className="landing-eyebrow">Why Choose Swiss Elite Transfers</div>
        <h2 className="landing-h2">Switzerland's Trusted Private Chauffeur Service</h2>
        <p className="landing-lead">
          From your first click to your final drop-off, every detail is designed around punctuality,
          comfort, and transparent pricing.
        </p>
        <div className="why-grid">
          {WHY.map(w => (
            <div className="why-item" key={w.title}>
              <div className="why-item-icon">{w.icon}</div>
              <h3>{w.title}</h3>
              <p>{w.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Coverage */}
      <section className="landing-section narrow" id="coverage">
        <div className="landing-eyebrow">Coverage Across Switzerland</div>
        <h2 className="landing-h2">Geneva, Zurich & Every Alpine Resort</h2>
        <p className="coverage-text">
          Swiss Elite Transfers operates from our base in Geneva, with full coverage across Switzerland
          including Zurich, Bern, Basel, Lausanne, and Interlaken. We also serve all major ski resorts in
          the Swiss and French Alps — including Zermatt, Verbier, St. Moritz, Courchevel, Chamonix,
          Megève, and Val d'Isère. Cross-border transfers to France and Italy are available on request.
        </p>
        <div className="city-chips">
          {CITIES.map(c => <span className="city-chip" key={c}>{c}</span>)}
        </div>
        <div className="landing-eyebrow">Popular Routes</div>
        <div className="route-list" style={{marginTop:'1rem'}}>
          {ROUTES.map(r => (
            <div className="route-list-item" key={r}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
              {r}
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="landing-section narrow" id="faq">
        <div className="landing-eyebrow">FAQ</div>
        <h2 className="landing-h2">Ask Us Anything</h2>
        <div className="faq-list">
          {FAQS.map(f => <FaqItem key={f.q} q={f.q} a={f.a} />)}
        </div>
      </section>

      {/* Final CTA */}
      <div className="final-cta">
        <h2 className="landing-h2">Book Your Luxury Transfer Today</h2>
        <p>Travel Switzerland the right way — in comfort and style.</p>
        <button className="btn-next" onClick={scrollToForm}>
          Book Now
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </button>
      </div>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <div className="footer-brand-name">SWISS <span>ELITE</span></div>
            <p>Premium airport transfers, private chauffeur service and ski resort transfers across Switzerland — available 24 hours a day, 365 days a year.</p>
          </div>
          <div className="footer-col">
            <h4>Services</h4>
            <a href="#services" onClick={e => { e.preventDefault(); scrollToForm(); }}>Airport Transfers</a>
            <a href="#services" onClick={e => { e.preventDefault(); scrollToForm(); }}>Ski Resort Transfers</a>
            <a href="#services" onClick={e => { e.preventDefault(); scrollToForm(); }}>Executive Travel</a>
          </div>
          <div className="footer-col">
            <h4>Contact</h4>
            <a href="https://wa.me/41783228820" target="_blank" rel="noopener noreferrer">WhatsApp +41 78 322 8820</a>
            <a href="https://www.instagram.com/swisselitetransfers" target="_blank" rel="noopener noreferrer">Instagram</a>
          </div>
        </div>
        <div className="footer-bottom">© {new Date().getFullYear()} Swiss Elite Transfers. All Rights Reserved.</div>
      </footer>

      {/* Mobile sticky CTA */}
      <div className="mobile-sticky-cta">
        <button className="btn-next" onClick={scrollToForm}>Book Now →</button>
      </div>

      </div>
    </div>
  );
}

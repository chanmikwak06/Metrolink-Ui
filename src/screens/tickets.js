import { html, asset, cx } from '../lib.js';
import { useApp } from '../store.js';
import { days, fares, money } from '../data.js';
import { at, Button, ApplePayButton, InfoButton, RadioGroup, ChevronRow, PaymentTile, BackButton } from '../components.js';
import { TripForm } from './home.js';

const fareOf = trip => fares.find(f => f.id === trip.fare) || fares[0];

// Figma: Tickets (4683:5972 empty → 6020 filled)
export function Tickets() {
  const { go, trip, update } = useApp();
  return html`
    <div class="screen">
      <${ChevronRow} onClick=${() => go('wallet')} style=${at(57, 151, { width: 284 })} chevronX=${279}>Ticket Wallet<//>
      <${RadioGroup} options=${days} value=${trip.day} onChange=${v => update({ day: v })} positions=${[61, 185, 283]} top=${220} />
      <${TripForm} y=${284} ctaGap=${89} onSubmit=${() => go('fares')} />
    </div>`;
}

// Figma: Tickets_1 (4683:6068) — fare list
export function Fares() {
  const { go, update } = useApp();
  return html`
    <div class="screen">
      <${BackButton} />
      ${fares.map((f, i) => html`
        <div key=${f.id} style=${at(27, 204 + i * 60, { width: 345, height: 44 })}>
          <${InfoButton} onClick=${() => go('explanation')} style=${at(0, 4)} />
          <${ChevronRow} onClick=${() => { update({ fare: f.id }); go('validity'); }}
            right=${money(f.price)} style=${at(47, 12, { width: 298 })} chevronX=${283}>${f.label}<//>
        </div>`)}
    </div>`;
}

// Figma: Tickets_1 (4683:6124) — Ticket Validity
export function Validity() {
  const { go } = useApp();
  return html`
    <div class="screen">
      <${BackButton} />
      <h2 class="t-title-m text-primary" style=${at(39, 216)}>Ticket Validity</h2>
      <div class="paragraph paragraph--s" style=${at(39, 266, { width: 329 })}>
        <p>On the <b>Metrolink mobile app</b>, there is no explicit <b>day selection interface</b> (such as a calendar picker or multi-day selector) when purchasing tickets. Instead, the app is structured around a <b>ticket-first workflow</b>, where users select their <b>origin, destination, and ticket type,</b> rather than a specific travel date.</p>
        <p>This aligns with how Metrolink’s fare system is designed. Most mobile tickets are inherently time-bound to the day of purchase or activation, rather than a user-selected future date.</p>
      </div>
      <${Button} size="lg" onClick=${() => go('payment')} style=${at(39, 676, { width: 323 })}>Accept & Continue<//>
    </div>`;
}

// Figma: Tickets_1 (4683:6164) — payment
export function Payment() {
  const { go, trip, update } = useApp();
  const fare = fareOf(trip);
  const tiles = [['visa', 39, 73], ['mastercard', 122, 74], ['paypal', 206, 74], ['applepay', 290, 73]];
  return html`
    <div class="screen">
      <${BackButton} />
      <div class="t-body-m row-between" style=${at(39, 216, { width: 323 })}><span>Total</span><span>${money(fare.price)}</span></div>
      <${ChevronRow} style=${at(39, 324, { width: 323 })} chevronX=${318}>Add New Card<//>
      ${tiles.map(([m, x, w]) => html`<${PaymentTile} key=${m} method=${m} selected=${trip.payment === m}
        onClick=${() => update({ payment: m })} style=${at(x, 432, { width: w })} />`)}
      <${ApplePayButton} onClick=${() => go('applepay')} style=${at(39, 676)} />
    </div>`;
}

// Figma: Tickets_1 (4683:6216) — Apple Pay sheet (static screenshot from the design; tap anywhere to pay)
export function ApplePaySheet() {
  const { replace } = useApp();
  return html`
    <button class="screen applepay" onClick=${() => replace('success')} aria-label="Double click to pay">
      <div class="applepay__sheet"><img src=${asset('tickets/applepay-sheet.png')} alt="" /></div>
      <span class="applepay__merchant"><img src=${asset('tickets/applepay-merchant-logo.svg')} alt="Metrolink" /></span>
      <div class="applepay__top" />
      <div class="applepay__confirm"><img src=${asset('tickets/applepay-sheet.png')} alt="" /></div>
    </button>`;
}

// Figma: Tickets_1 (4683:6262) — Transaction Successful
export function Success() {
  const { replace } = useApp();
  return html`
    <div class="screen">
      <svg class="success__check" style=${at(185, 299)} width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <path d="M7 16.5l6.5 6.5L25 10" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <div class="success" style=${at(40, 355, { width: 323 })}>
        <h2 class="t-heading-m text-primary">Transaction Successful</h2>
        <p>Please activate your ticket just<br />before boarding.</p>
      </div>
      <${Button} variant="pressed" size="lg" onClick=${() => replace('wallet')} style=${at(39, 676, { width: 324 })}>Go to Ticket Wallet<//>
    </div>`;
}

const TicketPrice = ({ price, large }) => html`<span class=${cx('ticket__price', large && 'ticket__price--lg')}>${money(price)}</span>`;

// Figma: Tickets_1 (4683:6305) — Ticket Wallet
export function Wallet() {
  const { go, trip } = useApp();
  return html`
    <div class="screen">
      <${ChevronRow} style=${at(39, 221, { width: 323 })} chevronX=${319}>Ticket History<//>
      <button class="ticket" onClick=${() => go('ticket')} style=${at(92, 322)} aria-label="Open ticket">
        <img src=${asset('tickets/ticket.png')} alt="Metrolink ticket — valid until 08/01/2026 3:00 PM, round trip, adult" />
        <${TicketPrice} price=${fareOf(trip).price} />
      </button>
    </div>`;
}

// Figma: Tickets_1 (4683:6349) — ticket full screen
export function TicketDetail() {
  const { back, trip } = useApp();
  return html`
    <div class="screen ticket-detail">
      <button class="ticket ticket--lg" onClick=${back} aria-label="Close ticket">
        <img src=${asset('tickets/ticket.png')} alt="Metrolink ticket — valid until 08/01/2026 3:00 PM, round trip, adult" />
        <${TicketPrice} price=${fareOf(trip).price} large />
      </button>
      <div class="ticket-detail__mask" style=${at(0, 63, { width: 82, height: 710 })} />
      <div class="ticket-detail__mask" style=${at(74, 63, { width: 132, height: 59 })} />
      <div class="ticket-detail__mask" style=${at(293, 714, { width: 132, height: 59 })} />
      <div class="ticket-detail__mask" style=${at(-1, 750, { width: 403, height: 59 })} />
      <div class="ticket-detail__mask" style=${at(0, -17, { width: 427, height: 124 })} />
      <${BackButton} />
    </div>`;
}

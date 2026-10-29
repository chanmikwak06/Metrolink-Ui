// Reusable UI pieces. Each maps to a component (or repeated layer group) in Figma —
// the Figma name is noted above each one. Positions are passed in by screens.
import { html, useState, useEffect, useRef, asset, cx } from './lib.js';
import { useApp } from './store.js';
import { lines } from './data.js';

export const at = (left, top, extra) => ({ position: 'absolute', left, top, ...extra });

// Figma: "StatusBar" (iOS, light, no Dynamic Island) + "Notch" (iPhone 13). Transparent, pinned to the top of every screen.
export const StatusBar = ({ style }) => html`<img class="status-bar" src=${asset('common/status-bar.svg')} alt="" style=${style} />`;

// Figma: "Menu Bar" / "Home_Menu bar" → Bottom Nav + Menu List + Iphone Indicator
const TABS = [
  { id: 'home', label: 'Home', icon: 'nav/home.svg', w: 25, h: 23 },
  { id: 'tickets', label: 'Tickets', icon: 'nav/tickets.svg', w: 15.465, h: 23.197 },
  { id: 'schedules', label: 'Schedules', icon: 'nav/schedules.svg', w: 19.331, h: 23.197 },
  { id: 'map', label: 'Map', icon: 'nav/map.svg', w: 23.197, h: 23.197 },
  { id: 'explore', label: 'Explore', icon: 'nav/explore.svg', w: 23, h: 23 },
];

export function BottomNav({ active, onSelect }) {
  const app = useApp();
  const select = onSelect || (id => app.tab(id));
  const index = TABS.findIndex(t => t.id === active);
  return html`
    <nav class="bottom-nav" aria-label="Main">
      <div class="bottom-nav__list">
        ${TABS.map(t => html`
          <button key=${t.id} class=${cx('bottom-nav__item', t.id === active && 'is-active')}
            aria-current=${t.id === active ? 'page' : undefined} onClick=${() => select(t.id)}>
            <span class="icon-mask" style=${{ width: t.w, height: t.h, '--icon': `url(${asset(t.icon)})` }} />
            <span class="bottom-nav__label">${t.label}</span>
          </button>`)}
      </div>
      <div class="bottom-nav__indicator"><span /></div>
      ${index >= 0 && html`<span class="bottom-nav__active" style=${{ left: 12 + index * 80.2 }} />`}
    </nav>`;
}

// Figma: "Button" (library) — variants seen: Primary, Disabled, Accent (yellow), Pressed (confirm)
export function Button({ variant = 'primary', size = 'sm', disabled, onClick, children, style, className }) {
  const v = disabled ? 'disabled' : variant;
  return html`<button class=${cx('btn', `btn--${v}`, `btn--${size}`, className)} disabled=${disabled} onClick=${onClick} style=${style}>${children}</button>`;
}

// Figma: "Apple Pay Button" (library; follows Apple HIG)
export const ApplePayButton = ({ onClick, style }) => html`
  <button class="apple-pay-btn" onClick=${onClick} style=${style} aria-label="Buy with Apple Pay">
    <span class="apple-pay-btn__buy">Buy with</span><span class="apple-pay-btn__pay">Pay</span>
  </button>`;

// Figma: "Listbox Component" (local set, 10 variants) + "Dropdown List" + "Hover State"
export function Listbox({ placeholder, value, options, onChange, style, label }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = e => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  return html`
    <div class=${cx('listbox', open && 'is-open')} ref=${ref} style=${style}>
      <button class="listbox__field" aria-haspopup="listbox" aria-expanded=${open} aria-label=${label || placeholder}
        onClick=${() => setOpen(o => !o)}>
        <span class=${cx('listbox__value', !value && 'is-placeholder')}>${value || placeholder}</span>
        <img class="listbox__chevron" src=${asset('common/chevron-down.svg')} alt="" />
      </button>
      <ul class="listbox__list" role="listbox">
        ${options.map(o => html`
          <li key=${o} role="option" aria-selected=${o === value}
            class=${cx('listbox__option', o === value && 'is-selected')}
            onClick=${() => { onChange(o); setOpen(false); }}>${o}</li>`)}
      </ul>
    </div>`;
}

// Figma: "Radio Button" (library) — State=Default / State=Active
export function RadioGroup({ options, value, onChange, positions, top }) {
  return html`
    <div role="radiogroup" class="radio-group">
      ${options.map((o, i) => html`
        <button key=${o} role="radio" aria-checked=${o === value} class="radio" style=${at(positions[i], top)}
          onClick=${() => onChange(o)}>
          <img src=${asset(o === value ? 'common/radio-on.svg' : 'common/radio-off.svg')} alt="" width="24" height="24" />
          <span>${o}</span>
        </button>`)}
    </div>`;
}

// Figma: "Frame 1" (X) top-right on detail screens; hotspot matches the Figma link area.
export const CloseButton = ({ onClick }) => html`
  <button class="close-btn" onClick=${onClick} aria-label="Close">
    <img src=${asset('common/close.svg')} alt="" />
  </button>`;

// Figma: "Back Button" (local component) → Icon/Solid/arrow-left (library). Top-left mirror of the Close button.
export const BackButton = ({ onClick, style }) => {
  const app = useApp();
  return html`
    <button class="back-btn" onClick=${onClick || app?.back} style=${style} aria-label="Back">
      <img src=${asset('common/back.svg')} alt="" />
    </button>`;
};

// Figma: "Vector (Stroke)" info icon — links to the Ticket Validity explanation.
export const InfoButton = ({ onClick, style }) => html`
  <button class="info-btn" onClick=${onClick} style=${style} aria-label="Why there is no date picker">
    <img src=${asset('common/info.svg')} alt="" width="11" height="11" />
  </button>`;

// Route ribbon ("Vector" in Figma), colored per line.
export const LineRibbon = ({ line, style, small }) => html`
  <img class=${cx('line-ribbon', small && 'line-ribbon--sm')} style=${style}
    src=${asset(small ? 'schedules/line-orange-sm.svg' : lines[line].icon)} alt=${lines[line].name} />`;

// Figma: "Selector" (library) used as the line status card on Home.
export const StatusCard = ({ item, style }) => html`
  <div class="status-card" style=${style}>
    <${LineRibbon} line=${item.line} style=${{ position: 'absolute', left: 12, top: 12 }} />
    <span class="status-card__name">${item.label}</span>
    <span class="status-card__status">${item.status}</span>
    <span class="status-card__train">${item.train}</span>
  </div>`;

// Text row with a right chevron (Ticket Wallet, Add New Card, fare rows…)
// `chevronX` = chevron's left edge within the row; a right-hand value ends 12px before it.
export const ChevronRow = ({ children, right, onClick, style, chevronX }) => html`
  <button class="chevron-row" onClick=${onClick} style=${{ ...style, '--cx': `${chevronX}px` }} disabled=${!onClick}>
    <span>${children}</span>
    ${right && html`<span class="chevron-row__right">${right}</span>`}
    <img class="chevron-row__chevron" src=${asset('common/chevron-down.svg')} alt="" />
  </button>`;

// Figma: "Payment Method/Visa|Mastercard|PayPal|ApplePay" (library)
const PAYMENT = {
  visa: { label: 'Visa', src: 'tickets/visa.svg', full: true },
  mastercard: { label: 'Mastercard', src: 'tickets/mastercard.svg', inset: '20.83% 17.14% 21.64% 18.57%' },
  paypal: { label: 'PayPal', src: 'tickets/paypal.svg', inset: '13.14% 21.43% 14.29% 21.43%' },
  applepay: { label: 'Apple Pay', src: 'tickets/applepay-mark.svg', full: true },
};
export const PaymentTile = ({ method, selected, onClick, style }) => {
  const p = PAYMENT[method];
  return html`
    <button class=${cx('pay-tile', p.full && 'pay-tile--full', selected && 'is-selected')} onClick=${onClick}
      style=${style} aria-pressed=${!!selected} aria-label=${p.label}>
      ${p.inset
        ? html`<span class="pay-tile__mark" style=${{ inset: p.inset }}><img src=${asset(p.src)} alt="" /></span>`
        : html`<img src=${asset(p.src)} alt="" />`}
    </button>`;
};

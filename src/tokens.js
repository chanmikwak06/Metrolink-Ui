// Design tokens — the single source of truth for the prototype AND the style guide.
//
// `figma` is the style name in Figma. No flag = style lives in your shared library.
// `local: true` = style was created locally in the Mobile_Intro-Ui file (Oct 28, 2026)
// from raw values found on the canvas. `proposed: true` = no Figma style exists yet;
// the name is a suggestion. Rename here and everything updates.
// To change a value: edit it here, reload. CSS reads these as custom properties
// (e.g. color.primary.main → --color-primary-main), see applyTokens() below.

export const color = {
  primary: {
    main: { value: '#0049BA', figma: 'Primary/Main', usage: 'Primary buttons, active tab icon + label (the Home icon blue), links, headings' },
    pressed: { value: '#003F8F', figma: 'Primary/Pressed', usage: 'Pressed / confirm button (Go to Ticket Wallet)' },
  },
  neutral: {
    '1o': { value: '#FFFFFF', figma: 'Neutral/1O', usage: 'Surfaces, text on primary' },
    '2o': { value: '#F5F6F7', figma: 'Neutral/2O', local: true, usage: 'Bottom nav backing' },
    '3o': { value: '#E4E9EC', figma: 'Neutral/3O', usage: 'Disabled button fill' },
    '4o': { value: '#EFF0F1', figma: 'Neutral/4O', local: true, usage: 'Ticket backdrop' },
    '5o': { value: '#BABEC1', figma: 'Neutral/5O', usage: 'Input + card borders' },
    '6o': { value: '#989B9D', figma: 'Neutral/6O', usage: 'Disabled button text' },
    '7o': { value: '#717375', figma: 'Neutral/7O', usage: 'Secondary text (schedules, status)' },
    '10o': { value: '#0A0A0A', figma: 'Neutral/10O', usage: 'Primary text' },
  },
  text: {
    placeholder: { value: '#666666', figma: 'Text/Placeholder', local: true, usage: 'Listbox placeholder + selected value' },
    option: { value: '#333333', figma: 'Text/Option', local: true, usage: 'Dropdown option text' },
    nav: { value: '#484C52', figma: 'Text/Nav Inactive', local: true, usage: 'Inactive tab label' },
    muted: { value: '#515151', figma: 'Text/Muted', local: true, usage: 'Explore labels' },
    ticket: { value: '#5268AC', figma: 'Text/Ticket', local: true, usage: 'Price on ticket artwork' },
  },
  icon: {
    navInactive: { value: '#404040', figma: 'Icon/Nav Inactive', local: true, usage: 'Inactive tab icon (the Schedules icon gray)' },
  },
  accent: {
    yellow: { value: '#FFCC00', figma: 'accents/yellow', usage: 'Service Alerts button' },
  },
  label: {
    primary: { value: '#000000', figma: 'labels/primary', usage: 'Text on yellow' },
  },
  border: {
    grey: { value: '#D9D9D9', figma: 'Grey', usage: 'Payment method tile border' },
    ticket: { value: '#B8B8B8', figma: 'Border/Ticket', local: true, usage: 'Old ticket outline (unused since the new ticket art)' },
  },
  ui: {
    homeIndicator: { value: '#B9C0C9', figma: 'UI/Home Indicator', local: true, usage: 'iOS home indicator bar' },
    applePaySheet: { value: '#F2F0F1', figma: 'UI/Apple Pay Sheet', local: true, usage: 'Apple Pay sheet backdrop' },
  },
  // Route colors — one per line. Raw values on the canvas, no styles in Figma yet.
  line: {
    antelopeValley: { value: '#35973A', figma: 'Line/Antelope Valley', local: true, usage: 'Antelope Valley Line' },
    orangeCounty: { value: '#EE7B00', figma: 'Line/Orange County', local: true, usage: 'Orange County Line' },
    sanBernardino: { value: '#A32236', figma: 'Line/San Bernardino', local: true, usage: 'San Bernardino Line' },
    perrisValley: { value: '#0171CE', figma: 'Line/91 Perris Valley', local: true, usage: '91/Perris Valley Line' },
    inlandEmpire: { value: '#BC295B', figma: 'Line/Inland Empire', local: true, usage: 'Inland Empire–OC Line' },
    riverside: { value: '#5C3597', figma: 'Line/Riverside', local: true, usage: 'Riverside Line' },
    venturaCounty: { value: '#F6A706', figma: 'Line/Ventura County', local: true, usage: 'Ventura County Line' },
  },
};

// Letter spacing in Figma is a percent of font size; -0.6% is used almost everywhere.
export const type = {
  'display-l': { family: 'Anta', size: 26, line: 26.3, tracking: -0.6, figma: 'Display/L', local: true, sample: 'Den Cafe', usage: 'Place names (Explore)' },
  'heading-l': { family: 'Anta', size: 20, line: 29, tracking: -0.6, figma: 'Heading/L', local: true, sample: '9:36 AM', usage: 'Times, stations, train numbers' },
  'heading-m': { family: 'Anta', size: 20, line: 24, tracking: -0.6, figma: 'Heading/M', local: true, sample: 'Transaction Successful', usage: 'Confirmation headline' },
  'title-m': { family: 'Anta', size: 16, line: 20, tracking: -0.6, figma: 'Title/M', local: true, sample: 'Ticket Validity', usage: 'Section titles, region names' },
  'button-l': { family: 'Anta', size: 15.4, line: 22, tracking: -0.6, figma: 'Button/L', local: true, sample: 'Go to Ticket Wallet', usage: 'Full-width buttons' },
  'body-m': { family: 'Anta', size: 14, line: 20, tracking: -0.6, figma: 'Body/Regular/M', sample: 'Adult (Regular)', usage: 'Default UI text, list rows, inputs' },
  'body-s': { family: 'Anta', size: 12, line: 16, tracking: 0, figma: 'Body/Bold/S', sample: 'Buy Tickets', usage: 'Small buttons, tab labels' },
  'caption': { family: 'Anta', size: 12, line: 20, tracking: -0.6, figma: 'Caption/M', local: true, sample: 'Orange → Downtown', usage: 'Labels above values (Arrives, Track 1)' },
  'caption-s': { family: 'Anta', size: 10, line: 13, tracking: -0.6, figma: 'Caption/S', local: true, sample: 'Delayed 10 to 15 minutes', usage: 'Delay status' },
  'paragraph': { family: 'Helvetica Neue', size: 16, line: 24, tracking: 0, figma: 'Paragraph/M', proposed: true, sample: 'On the Metrolink mobile app, there is no explicit day selection interface.', usage: 'Long-form explanation copy' },
  'paragraph-s': { family: 'Helvetica Neue', size: 15, line: 24, tracking: 0, figma: 'Paragraph/S', proposed: true, sample: 'Most mobile tickets are time-bound to the day of purchase.', usage: 'Ticket validity copy' },
  'alert': { family: 'Helvetica Neue', size: 16, line: 20, tracking: -0.6, figma: 'Paragraph/Alert', proposed: true, sample: 'Train A584 to LA Union Station is 1-5 minutes delayed.', usage: 'Service alert body' },
};

export const radius = {
  sm: { value: 6, usage: 'Buttons, status cards, payment tiles' },
  md: { value: 8, usage: 'Listbox, dropdown, Apple Pay button' },
  lg: { value: 24, usage: 'Bottom nav' },
  ticket: { value: 64, usage: 'Old ticket card corners (unused since the new ticket art)' },
  pill: { value: 100, usage: 'Home indicator' },
};

export const space = {
  gutter: { value: 39, usage: 'Screen side margin (content screens)' },
  'form-gutter': { value: 61, usage: 'Screen side margin (forms)' },
  'status-h': { value: 48, usage: 'Status bar height (transparent, pinned to the top)' },
  'row': { value: 60, usage: 'Fare list row pitch' },
  'nav-h': { value: 88, usage: 'Bottom nav height' },
};

export const shadow = {
  dropdown: { value: '0 4px 7px rgba(0,0,0,0.10)', usage: 'Open dropdown list' },
};

// From the prototype settings in Figma: component interactions are 150ms, screen changes 300ms.
export const motion = {
  fast: { value: '150ms', easing: 'cubic-bezier(0, 0, 0.58, 1)', usage: 'Dropdown, hover, radio (Smart Animate 150ms ease-out)' },
  base: { value: '300ms', easing: 'cubic-bezier(0, 0, 0.58, 1)', usage: 'Screen transitions (Smart Animate / Dissolve 300ms ease-out)' },
  slow: { value: '600ms', easing: 'cubic-bezier(0, 0, 0.58, 1)', usage: 'Map zoom (Smart Animate 600ms ease-out)' },
  spring: { value: '700ms', easing: 'cubic-bezier(0.68, -0.6, 0.32, 1.6)', usage: 'Map pin (Smart Animate 700ms ease-in-out-back)' },
};

const kebab = s => s.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();

export function cssVariables() {
  const vars = {};
  for (const [group, entries] of Object.entries(color))
    for (const [name, t] of Object.entries(entries)) vars[`--color-${group}-${kebab(name)}`] = t.value;
  for (const [name, t] of Object.entries(type)) {
    const family = t.family === 'Anta' ? "'Anta', system-ui, sans-serif" : "'Helvetica Neue', Helvetica, Arial, sans-serif";
    vars[`--type-${name}`] = `${t.size}px/${t.line}px ${family}`;
    vars[`--type-${name}-tracking`] = `${(t.tracking / 100).toFixed(4)}em`;
  }
  for (const [name, t] of Object.entries(radius)) vars[`--radius-${name}`] = `${t.value}px`;
  for (const [name, t] of Object.entries(space)) vars[`--space-${name}`] = `${t.value}px`;
  for (const [name, t] of Object.entries(shadow)) vars[`--shadow-${name}`] = t.value;
  for (const [name, t] of Object.entries(motion)) {
    vars[`--motion-${name}`] = t.value;
    vars[`--ease-${name}`] = t.easing;
  }
  return vars;
}

// One utility class per text style: .t-body-m, .t-heading-l, …
export const typeClassCss = () => Object.keys(type)
  .map(name => `.t-${name}{font:var(--type-${name});letter-spacing:var(--type-${name}-tracking)}`)
  .join('\n');

export function applyTokens(root = document.documentElement) {
  for (const [k, v] of Object.entries(cssVariables())) root.style.setProperty(k, v);
  const style = document.getElementById('token-type') || Object.assign(document.createElement('style'), { id: 'token-type' });
  style.textContent = typeClassCss();
  document.head.append(style);
}

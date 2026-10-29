// Content shown in the prototype. Values come from the Figma frames; where Figma
// only had placeholder content (e.g. every dropdown listed the same 4 stations),
// the lists below fill it in.

export const stations = [
  'Anaheim', 'Anaheim Canyon', 'Baldwin Park', 'Buena Park', 'Burbank', 'Glendale',
  'Industry', 'Irvine', 'L.A. Union Station', 'Montebello', 'Ontario', 'Orange',
  'Pomona', 'Santa Ana', 'Sun Valley', 'Sylmar', 'Tustin',
];

export const ticketTypes = ['One-Way', 'Round-Trip', '5-Day Flex Pass', '7-Day Pass', 'Monthly Pass'];

export const days = ['Mon-Fri', 'Sat', 'Sun'];

export const fares = [
  { id: 'adult', label: 'Adult (Regular)', price: 10 },
  { id: 'student', label: 'Student / Youth', price: 5 },
  { id: 'senior', label: 'Senior', price: 5 },
  { id: 'disabled', label: 'Disabled / Medicare', price: 5 },
  { id: 'military', label: 'Active Military / Veteran', price: 9 },
];

export const money = n => `$${n.toFixed(2)}`;

// `icon` = the route ribbon asset; `color` = token key in color.line.
export const lines = {
  orangeCounty: { name: 'Orange County', icon: 'common/line-orange.svg', explore: 'explore/line-orange-county.svg' },
  antelopeValley: { name: 'Antelope Valley', icon: 'common/line-green.svg', explore: 'explore/line-antelope-valley.svg' },
  riverside: { name: 'Riverside', icon: 'common/line-purple.svg', explore: 'explore/line-riverside.svg' },
  perrisValley: { name: '91/Perris Valley', icon: 'common/line-blue.svg', explore: 'explore/line-perris-valley.svg' },
  sanBernardino: { name: 'San Bernardino', explore: 'explore/line-san-bernardino.svg' },
  inlandEmpire: { name: 'Inland Empire', explore: 'explore/line-inland-empire.svg' },
  venturaCounty: { name: 'Ventura County', explore: 'explore/line-ventura-county.svg' },
};

export const lineStatus = [
  { line: 'orangeCounty', label: 'Orange County Line', train: 'A584', status: 'Delayed 01 to 05 minutes' },
  { line: 'antelopeValley', label: 'Antelope Valley Line', train: '1277', status: 'Delayed 10 to 15 minutes' },
  { line: 'riverside', label: 'Riverside Line', train: '1366', status: 'Delayed 10 to 15 minutes' },
  { line: 'perrisValley', label: '91/Perris Valley Line', train: '1752', status: 'Delayed 10 to 15 minutes' },
];

export const serviceAlerts = [
  {
    line: 'orangeCounty', train: 'A584', region: 'Orange County', route: 'Orange → Downtown', delay: '1-5 minutes',
    stops: [['Tustin', '9:17 AM'], ['Santa Ana', '9:25 AM'], ['Orange', '9:31 AM'], ['Anaheim', '9:36 AM']],
  },
  {
    line: 'antelopeValley', train: '1277', region: 'Antelope Valley', route: 'Lancaster → Downtown', delay: '5-9 minutes',
    stops: [['Sylmar', '10:19 AM'], ['Sun Valley', '10:25 AM'], ['Burbank', '10:30 AM'], ['Glendale', '10:36 AM']],
  },
  {
    line: 'riverside', train: '136', region: 'Riverside', route: 'Riverside → Downtown', delay: '9-15 minutes',
    stops: [['Ontario', '11:09 AM'], ['Pomona', '11:15 AM'], ['Industry', '11:20 AM'], ['Montebello', '11:26 AM']],
  },
];

export const trainStatus = {
  line: 'orangeCounty', train: 'A584', region: 'Orange County', route: 'Orange → Downtown',
  stops: [['Tustin', '9:17 AM'], ['Santa Ana', '9:25 AM'], ['Orange', '9:31 AM'], ['Anaheim', '9:36 AM']],
};

// Times as drawn in Figma (incl. its "12:20 AM" / "1:36 AM" labels).
export const trips = [
  { train: 'OC A584', depart: '9:36 AM', arrive: '10:20 AM', duration: '44m' },
  { train: 'OC 603', depart: '10:36 AM', arrive: '11:20 AM', duration: '44m' },
  { train: 'OC 627', depart: '11:36 AM', arrive: '12:20 AM', duration: '44m' },
  { train: 'OC 627', depart: '1:36 AM', arrive: '2:20 AM', duration: '44m' },
];

export const places = [
  { name: 'Den Cafe', address: ['125 N Broadway D,', 'Santa Ana, CA 92701'], station: 'Santa Ana', photos: ['explore/den-1.png', 'explore/den-2.png', 'explore/den-3.png'] },
  { name: 'Coffee Muse', address: ['125 N Broadway D,', 'Santa Ana, CA 92701'], station: 'Santa Ana', photos: ['explore/muse-1.png', 'explore/muse-2.png', 'explore/muse-3.png'] },
];

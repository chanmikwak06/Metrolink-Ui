// Screen registry: id → component, the tab it belongs to, and its Figma source frame.
// Add a screen here and it becomes routable (#/id) and appears in the viewer's screen list.
import { Home, Explanation, ServiceAlerts } from './home.js';
import { Tickets, Fares, Validity, Payment, ApplePaySheet, Success, Wallet, TicketDetail } from './tickets.js';
import { Schedules, ScheduleResults } from './schedules.js';
import { MapScreen, TrainStatus } from './map.js';
import { Explore, ExploreRegion } from './explore.js';

export const screens = {
  home: { title: 'Home', tab: 'home', component: Home, figma: '4683:6974' },
  explanation: { title: 'Why no date picker', tab: 'home', component: Explanation, figma: '4683:6413' },
  alerts: { title: 'Service Alerts', tab: 'home', component: ServiceAlerts, figma: '4683:6452' },

  tickets: { title: 'Tickets', tab: 'tickets', component: Tickets, figma: '4683:5972' },
  fares: { title: 'Choose fare', tab: 'tickets', component: Fares, figma: '4683:6068' },
  validity: { title: 'Ticket Validity', tab: 'tickets', component: Validity, figma: '4683:6124' },
  payment: { title: 'Payment', tab: 'tickets', component: Payment, figma: '4683:6164' },
  applepay: { title: 'Apple Pay', tab: 'tickets', component: ApplePaySheet, figma: '4683:6216' },
  success: { title: 'Transaction Successful', tab: 'tickets', component: Success, figma: '4683:6262' },
  wallet: { title: 'Ticket Wallet', tab: 'tickets', component: Wallet, figma: '4683:6305' },
  ticket: { title: 'Ticket', tab: 'tickets', component: TicketDetail, figma: '4683:6349' },

  schedules: { title: 'Schedules', tab: 'schedules', component: Schedules, figma: '4683:7341' },
  'schedule-results': { title: 'Schedule results', tab: 'schedules', component: ScheduleResults, figma: '4683:7449' },

  map: { title: 'Map', tab: 'map', component: MapScreen, figma: '4683:6808' },
  'train-status': { title: 'Train A584', tab: 'map', component: TrainStatus, figma: '4683:6899' },

  explore: { title: 'Explore', tab: 'explore', component: Explore, figma: '4683:6544' },
  'explore-region': { title: 'Orange County', tab: 'explore', component: ExploreRegion, figma: '4683:6685' },
};

export const NAV_ITEMS: { path: string; label: string; icon: string; adminOnly?: boolean }[] = [
  { path: '/', label: 'Dashboard', icon: '⌂' },
  { path: '/current-sacrament', label: 'Current Sacrament Meeting', icon: '♫' },
  { path: '/calendaring', label: 'Calendar Events', icon: '▣' },
  { path: '/calling-pipeline', label: 'Calling Pipeline', icon: '◉' },
  { path: '/all-callings', label: 'All Callings', icon: '◍' },
  { path: '/youth-activities', label: 'Youth Activities', icon: '⬡' },
  { path: '/sacrament-planning', label: 'Sacrament Planning', icon: '♪' },
  { path: '/tasks', label: 'Action Items', icon: '☑' },
  { path: '/member-needs', label: 'Member Needs', icon: '♥' },
  { path: '/missionary-pipeline', label: 'Missionary Pipeline', icon: '✈' },
  { path: '/youth-interviews', label: 'Youth Interviews', icon: '◎' },
  { path: '/temple-interviews', label: 'Adult Temple Interviews', icon: '◈' },
  { path: '/other-interviews', label: 'Other Interviews', icon: '◐' },
  { path: '/babies', label: 'Babies', icon: '★' },
  { path: '/out-of-town', label: 'Out of Town', icon: '⇢' },
  { path: '/bishop-schedule', label: 'Bishop Schedule', icon: '🕐' },
  { path: '/counselor-schedule', label: 'Counselor Schedule', icon: '🕐' },
  { path: '/assignments', label: 'Bishopric Assignments', icon: '⟳' },
  { path: '/current-bishopric-meeting', label: 'Current Bishopric Meeting', icon: '▤' },
  { path: '/bishopric-meetings', label: 'Bishopric Meeting Planning', icon: '▦' },
  { path: '/important-links', label: 'Important Links', icon: '⇗' },
  { path: '/speakers-and-prayers', label: 'Speakers & Prayers', icon: '⊞' },
  { path: '/ward-members', label: 'Ward Members', icon: '♟' },
  { path: '/users', label: 'Users', icon: '⊕' },
  { path: '/email-notifications', label: 'Automation & Notifications', icon: '✉', adminOnly: true },
  { path: '/hub-suggestions', label: 'Hub Suggestions', icon: '◈' },
  { path: '/help', label: 'Help', icon: '?' },
];

export const WC_DASHBOARD_ITEM = { path: '/', label: 'Dashboard', icon: '⌂' };
export const WC_NAV_CATEGORIES: { label: string; items: { path: string; label: string; icon: string }[] }[] = [
  {
    label: 'Ward Council',
    items: [
      { path: '/wc-meetings',           label: 'WC Meeting Assignments', icon: '▦' },
      { path: '/wc-discussion-topics',  label: 'Discussion Topics',      icon: '◈' },
      { path: '/wc-wins',               label: 'Wins for the Ward',      icon: '★' },
      { path: '/wc-members',            label: 'Ward Council Members',   icon: '⊕' },
      { path: '/yc-meetings',           label: 'Youth Council Meetings', icon: '▦' },
    ],
  },
  {
    label: 'Ward Care',
    items: [
      { path: '/wc-family-needs', label: 'Member Needs', icon: '♥' },
      { path: '/babies',          label: 'Babies',        icon: '◌' },
    ],
  },
  {
    label: 'Sacrament Meeting',
    items: [
      { path: '/current-sacrament', label: 'Current Sacrament Meeting', icon: '♫' },
    ],
  },
  {
    label: 'Calendar',
    items: [
      { path: '/calendaring',      label: 'Calendar of Events', icon: '▣' },
      { path: '/youth-activities', label: 'Youth Calendar',     icon: '⬡' },
      { path: '/tasks',            label: 'Action Items',       icon: '☑' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { path: '/hub-suggestions', label: 'Hub Suggestions', icon: '✎' },
      { path: '/help',            label: 'Help',            icon: '?' },
    ],
  },
];

export const YC_NAV_ITEMS = [
  { path: '/youth-activities', label: 'Youth Calendar', icon: '⬡' },
  { path: '/yc-meetings', label: 'Youth Council Meetings', icon: '▦' },
  { path: '/help', label: 'Help', icon: '?' },
];

export const CAL_NAV_ITEMS = [
  { path: '/calendaring', label: 'Calendar of Events', icon: '▣' },
  { path: '/help', label: 'Help', icon: '?' },
];

export const BH_DASHBOARD_ITEM = { path: '/', label: 'Dashboard', icon: 'ti-home' };
export const BH_NAV_CATEGORIES: { label: string; items: { path: string; label: string; icon: string; adminOnly?: boolean }[] }[] = [
  {
    label: 'Sacrament Meeting',
    items: [
      { path: '/sacrament-planning',   label: 'Sacrament Planning',        icon: 'ti-notebook'        },
      { path: '/current-sacrament',    label: 'Current Sacrament Meeting', icon: 'ti-music'           },
      { path: '/speakers-and-prayers', label: 'Speakers & Prayers',        icon: 'ti-microphone'      },
    ],
  },
  {
    label: 'Bishopric',
    items: [
      { path: '/current-bishopric-meeting', label: 'Current Bishopric Meeting', icon: 'ti-clipboard-text' },
      { path: '/bishopric-meetings',   label: 'Bishopric Meeting Planning', icon: 'ti-users'       },
      { path: '/assignments',          label: 'Bishopric Assignments',  icon: 'ti-list-check'      },
      { path: '/bishop-schedule',      label: 'Bishop Schedule',        icon: 'ti-calendar-time'   },
      { path: '/counselor-schedule',   label: 'Counselor Schedule',     icon: 'ti-calendar-time'   },
      { path: '/tasks',                label: 'Action Items',           icon: 'ti-checklist'       },
      { path: '/out-of-town',          label: 'Out of Town',            icon: 'ti-plane-departure' },
    ],
  },
  {
    label: 'Ward Care',
    items: [
      { path: '/calling-pipeline',     label: 'Calling Pipeline',    icon: 'ti-user-check'      },
      { path: '/all-callings',         label: 'All Callings',        icon: 'ti-list-details'    },
      { path: '/youth-interviews',     label: 'Youth Interviews',        icon: 'ti-clipboard-list' },
      { path: '/temple-interviews',    label: 'Adult Temple Interviews', icon: 'ti-building-church' },
      { path: '/other-interviews',     label: 'Other Interviews',        icon: 'ti-clipboard-text'  },
      { path: '/ordinances',           label: 'Ordinances',          icon: 'ti-droplet'         },
      { path: '/member-needs',         label: 'Member Needs',        icon: 'ti-heart'           },
      { path: '/missionary-pipeline',  label: 'Missionary Pipeline', icon: 'ti-compass'         },
      { path: '/babies',               label: 'Babies',              icon: 'ti-baby-carriage'   },
    ],
  },
  {
    label: 'Calendar',
    items: [
      { path: '/calendaring',          label: 'Calendar Events',  icon: 'ti-calendar-event' },
      { path: '/youth-activities',     label: 'Youth Activities', icon: 'ti-run'            },
      { path: '/yc-meetings',          label: 'Youth Council Meetings', icon: 'ti-users-group' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { path: '/ward-members',         label: 'Ward Members',        icon: 'ti-address-book'              },
      { path: '/annual-duties',        label: 'Annual Duties',       icon: 'ti-calendar-stats'            },
      { path: '/users',                label: 'Users',               icon: 'ti-user-cog'                  },
      { path: '/email-notifications',  label: 'Automation & Notifications', icon: 'ti-mail', adminOnly: true },
      { path: '/important-links',      label: 'Important Links',     icon: 'ti-link'                      },
      { path: '/hub-suggestions',      label: 'Hub Suggestions',     icon: 'ti-bulb'                      },
      { path: '/help',                 label: 'Help',                icon: 'ti-help-circle'               },
    ],
  },
];
export const BH_ALL_ITEMS = [BH_DASHBOARD_ITEM, ...BH_NAV_CATEGORIES.flatMap(cat => cat.items)];

// Flattened path → friendly label map (for the presence indicator), covering every hub's pages.
const PATH_LABELS: Record<string, string> = {};
for (const item of [
  ...BH_ALL_ITEMS,
  WC_DASHBOARD_ITEM, ...WC_NAV_CATEGORIES.flatMap(cat => cat.items),
  ...YC_NAV_ITEMS, ...CAL_NAV_ITEMS,
]) {
  if (!(item.path in PATH_LABELS)) PATH_LABELS[item.path] = item.label;
}
export function pathLabel(path: string): string {
  if (PATH_LABELS[path]) return PATH_LABELS[path];
  const segment = path.split('/').filter(Boolean).pop();
  return segment ? segment.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Dashboard';
}

export const NAV_ORDER_KEY = (userId: number) => `nav_order_${userId}`;
export const LAST_VISITED_KEY = 'last_visited_page';

export function loadOrder(userId: number): string[] {
  try {
    const stored = localStorage.getItem(NAV_ORDER_KEY(userId));
    if (stored) {
      const parsed: string[] = JSON.parse(stored);
      const valid = parsed.filter(p => NAV_ITEMS.some(n => n.path === p));
      const newItems = NAV_ITEMS.filter(n => !valid.includes(n.path)).map(n => n.path);
      return [...valid, ...newItems];
    }
  } catch { /* ignore */ }
  return NAV_ITEMS.map(n => n.path);
}

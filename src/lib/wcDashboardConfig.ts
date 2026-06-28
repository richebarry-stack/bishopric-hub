import type { FontSize, SectionConfig, TasksConfig, EventsConfig } from './dashboardConfig';
export type { FontSize };
export { FONT_SIZE_LABELS, FONT_SIZE_CLASS } from './dashboardConfig';

export interface WcMeetingConfig extends SectionConfig {
  showDate: boolean;
  showSpiritualThought: boolean;
  showOpeningPrayer: boolean;
  showClosingPrayer: boolean;
}

export interface WcMissionariesConfig extends SectionConfig {
  showStatus: boolean;
}

export interface WcDashboardConfig {
  meeting: WcMeetingConfig;
  memberNeeds: SectionConfig;
  missionaries: WcMissionariesConfig;
  actionItems: TasksConfig;
  events: EventsConfig;
}

export const WC_DEFAULT_CONFIG: WcDashboardConfig = {
  meeting:      { visible: true, fontSize: '2xl', showDate: true, showSpiritualThought: true, showOpeningPrayer: true, showClosingPrayer: true },
  memberNeeds:  { visible: true, fontSize: 'base' },
  missionaries: { visible: true, fontSize: 'base', showStatus: false },
  actionItems:  { visible: true, fontSize: 'sm', showAssignedTo: true },
  events:       { visible: true, fontSize: 'sm', showDate: true },
};

const CONFIG_KEY = 'wc_dashboard_config_v1';

export function loadWcDashboardConfig(): WcDashboardConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return WC_DEFAULT_CONFIG;
    const saved = JSON.parse(raw);
    return {
      meeting:      { ...WC_DEFAULT_CONFIG.meeting,      ...saved.meeting      },
      memberNeeds:  { ...WC_DEFAULT_CONFIG.memberNeeds,  ...saved.memberNeeds  },
      missionaries: { ...WC_DEFAULT_CONFIG.missionaries, ...saved.missionaries },
      actionItems:  { ...WC_DEFAULT_CONFIG.actionItems,  ...saved.actionItems  },
      events:       { ...WC_DEFAULT_CONFIG.events,       ...saved.events       },
    };
  } catch {
    return WC_DEFAULT_CONFIG;
  }
}

export function saveWcDashboardConfig(config: WcDashboardConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

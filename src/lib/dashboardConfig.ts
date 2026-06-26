export type FontSize = 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl';

export const FONT_SIZE_LABELS: Record<FontSize, string> = {
  xs: 'XS', sm: 'S', base: 'M', lg: 'L', xl: 'XL', '2xl': '2XL', '3xl': '3XL',
};

// All class names written as literals so the bundler can detect them
export const FONT_SIZE_CLASS: Record<FontSize, string> = {
  xs: 'text-xs', sm: 'text-sm', base: 'text-base', lg: 'text-lg',
  xl: 'text-xl', '2xl': 'text-2xl', '3xl': 'text-3xl',
};

export interface SectionConfig {
  visible: boolean;
  fontSize: FontSize;
}

export interface BishopricConfig extends SectionConfig {
  showDate: boolean;
  showSpiritualThought: boolean;
  showOpeningPrayer: boolean;
  showHandbookTopic: boolean;
  showClosingPrayer: boolean;
}

export interface MissionariesConfig extends SectionConfig {
  showStatus: boolean;
}

export interface TasksConfig extends SectionConfig {
  showAssignedTo: boolean;
}

export interface CallingsConfig extends SectionConfig {
  showStatusBadge: boolean;
}

export interface EventsConfig extends SectionConfig {
  showDate: boolean;
}

export interface DashboardConfig {
  bishopricMeeting: BishopricConfig;
  healthNeeds: SectionConfig;
  supportNeeds: SectionConfig;
  missionaries: MissionariesConfig;
  tasks: TasksConfig;
  callings: CallingsConfig;
  events: EventsConfig;
}

export const DEFAULT_CONFIG: DashboardConfig = {
  bishopricMeeting: {
    visible: true, fontSize: '3xl',
    showDate: true, showSpiritualThought: false, showOpeningPrayer: true, showHandbookTopic: true, showClosingPrayer: true,
  },
  healthNeeds:  { visible: true, fontSize: '2xl' },
  supportNeeds: { visible: true, fontSize: '2xl' },
  missionaries: { visible: true, fontSize: '2xl', showStatus: true },
  tasks:        { visible: true, fontSize: 'sm',  showAssignedTo: true },
  callings:     { visible: true, fontSize: 'sm',  showStatusBadge: true },
  events:       { visible: true, fontSize: 'sm',  showDate: true },
};

const CONFIG_KEY = 'dashboard_config_v1';

export function loadDashboardConfig(): DashboardConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const saved = JSON.parse(raw);
    return {
      bishopricMeeting: { ...DEFAULT_CONFIG.bishopricMeeting, ...saved.bishopricMeeting },
      healthNeeds:      { ...DEFAULT_CONFIG.healthNeeds,      ...saved.healthNeeds      },
      supportNeeds:     { ...DEFAULT_CONFIG.supportNeeds,     ...saved.supportNeeds     },
      missionaries:     { ...DEFAULT_CONFIG.missionaries,     ...saved.missionaries     },
      tasks:            { ...DEFAULT_CONFIG.tasks,            ...saved.tasks            },
      callings:         { ...DEFAULT_CONFIG.callings,         ...saved.callings         },
      events:           { ...DEFAULT_CONFIG.events,           ...saved.events           },
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveDashboardConfig(config: DashboardConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

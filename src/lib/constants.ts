export const SECURITY_QUESTIONS = [
  'What was the name of your first pet?',
  "What is your mother's maiden name?",
  'What was the name of your elementary school?',
  'What was the make of your first car?',
  'What city were you born in?',
  'What is the name of the street you grew up on?',
  'What was your childhood nickname?',
  'What is the middle name of your oldest sibling?',
  'What is the name of the town where your parents met?',
  'What was the name of your favorite teacher?',
];

export const BISHOPRIC_CALLINGS = [
  'Bishop',
  'First Counselor',
  'Second Counselor',
  'Clerk',
  'Executive Secretary',
  'Assistant Executive Secretary',
  'Assistant Clerk',
  'High Councilor',
];

export const WC_CALLINGS = [
  'Elders Quorum President',
  'Elders Quorum First Counselor',
  'Elders Quorum Second Counselor',
  'Relief Society President',
  'Relief Society First Counselor',
  'Relief Society Second Counselor',
  'Young Women President',
  'Young Women First Counselor',
  'Young Women Second Counselor',
  'Primary President',
  'Primary First Counselor',
  'Primary Second Counselor',
  'Sunday School President',
  'Sunday School First Counselor',
  'Sunday School Second Counselor',
  'Ward Mission Leader',
  'Ward Temple and Family History Leader',
];

export const YC_CALLINGS = [
  // Advisers
  'Builders of Faith Adviser',
  'Builders of Faith Second Adviser',
  'Messengers of Hope Adviser',
  'Messengers of Hope Second Adviser',
  'Gatherers of Light Adviser',
  'Gatherers of Light Second Adviser',
  'Priests Quorum Adviser',
  'Priests Quorum Second Adviser',
  'Teachers Quorum Adviser',
  'Teachers Quorum Second Adviser',
  'Deacons Quorum Adviser',
  'Deacons Quorum Second Adviser',
  'Young Women Secretary',
  // Young Women class presidencies
  'Builders of Faith President',
  'Builders of Faith First Counselor',
  'Builders of Faith Second Counselor',
  'Builders of Faith Secretary',
  'Messengers of Hope President',
  'Messengers of Hope First Counselor',
  'Messengers of Hope Second Counselor',
  'Messengers of Hope Secretary',
  'Gatherers of Light President',
  'Gatherers of Light First Counselor',
  'Gatherers of Light Second Counselor',
  'Gatherers of Light Secretary',
  // Priests Quorum presidency (bishop is president)
  'Priests Quorum First Assistant',
  'Priests Quorum Second Assistant',
  'Priests Quorum Secretary',
  // Teachers Quorum presidency
  'Teachers Quorum President',
  'Teachers Quorum First Counselor',
  'Teachers Quorum Second Counselor',
  'Teachers Quorum Secretary',
  // Deacons Quorum presidency
  'Deacons Quorum President',
  'Deacons Quorum First Counselor',
  'Deacons Quorum Second Counselor',
  'Deacons Quorum Secretary',
];

export const CAL_CALLINGS = [
  'Music Coordinator',
  'Ward Bulletin Specialist',
];

export const CHURCH_ROLES = [
  ...BISHOPRIC_CALLINGS,
  ...WC_CALLINGS,
  ...YC_CALLINGS,
  ...CAL_CALLINGS,
];

export function hubForChurchRole(role: string): string {
  if (BISHOPRIC_CALLINGS.includes(role)) return 'both';
  if (WC_CALLINGS.includes(role)) return 'wc';
  if (YC_CALLINGS.includes(role)) return 'yc';
  if (CAL_CALLINGS.includes(role)) return 'cal';
  return 'wc';
}

export const HUB_LABELS: Record<string, string> = {
  both: 'Bishopric and WC Hubs',
  wc: 'Ward Council Only',
  yc: 'Youth Council',
  cal: 'Calendar',
};

export const CALLING_STATUSES = [
  '1. Discussion',
  '2. Pray about',
  '3. Approved and assigned',
  '4. Called & accepted',
  '4.5 Call & accepted, handle in class/quorum',
  '5. Sustained',
  '6. Set apart',
  '7. Need to release',
  '8. Need to thank at pulpit',
  '9. Released',
  '10. Declined',
];

export const CALLING_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  '1. Discussion': { bg: 'bg-gray-100', text: 'text-gray-700' },
  '2. Pray about': { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  '3. Approved and assigned': { bg: 'bg-blue-100', text: 'text-blue-800' },
  '4. Called & accepted': { bg: 'bg-green-100', text: 'text-green-800' },
  '4.5 Call & accepted, handle in class/quorum': { bg: 'bg-green-50', text: 'text-green-700' },
  '5. Sustained': { bg: 'bg-purple-100', text: 'text-purple-800' },
  '6. Set apart': { bg: 'bg-pink-100', text: 'text-pink-800' },
  '7. Need to release': { bg: 'bg-orange-100', text: 'text-orange-800' },
  '8. Need to thank at pulpit': { bg: 'bg-red-100', text: 'text-red-800' },
  '9. Released': { bg: 'bg-gray-100', text: 'text-gray-600' },
  '10. Declined': { bg: 'bg-red-50', text: 'text-red-700' },
};

export const INTERVIEW_TYPES = [
  'Annual Youth',
  'Semi-Annual Youth',
  'Annual',
  'Calling',
  'Endowed Temple Rec',
  'Unendowed Temple Rec',
  'Patriarchal Blessing',
  'Limited',
  'Eccl Endorsement',
  'Before Mission',
  'Other',
];

export const INTERVIEW_STATUSES = [
  'Unassigned',
  'Assigned',
  'Contacted for Interview',
  'Scheduled for Interview',
  'Need to see Bishop',
  'Interviewed',
  'Delivered/Complete',
  'On Hold',
  'Needs to be sustained',
];

export const INTERVIEW_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  'Unassigned': { bg: 'bg-gray-100', text: 'text-gray-600' },
  'Assigned': { bg: 'bg-blue-100', text: 'text-blue-800' },
  'Contacted for Interview': { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  'Scheduled for Interview': { bg: 'bg-orange-100', text: 'text-orange-800' },
  'Need to see Bishop': { bg: 'bg-purple-100', text: 'text-purple-800' },
  'Interviewed': { bg: 'bg-green-50', text: 'text-green-700' },
  'Delivered/Complete': { bg: 'bg-green-100', text: 'text-green-800' },
  'On Hold': { bg: 'bg-red-100', text: 'text-red-800' },
  'Needs to be sustained': { bg: 'bg-pink-100', text: 'text-pink-800' },
};

export const MEMBER_NEED_TYPES = ['Health', 'Support', 'Mission'];

export const MISSIONARY_STATUSES = [
  '0-Not at this time',
  '1-Considering',
  '2-Papers Started',
  '3-Papers Submitted',
  '4-Call Accepted',
  '5-Serving',
  '6-Released',
];

export const MISSIONARY_TEMPLE_STATUSES = [
  '1-Participating in Temple Prep',
  '2-Bishop recommend interview needed',
  '3-Stake recommend interview needed',
  '4-Reserve Endowment Date',
  '5-Endowed',
];

export const BABY_STATUSES = ['Expecting', 'Born', 'Blessed', 'Recorded'];

export const SPEAKER_TYPES = ['Youth Speaker', 'Adult Speaker', 'Not Comfortable Speaking'];

export const ORGANIZATIONS = [
  'Elders Quorum',
  'Relief Society',
  'Young Men',
  'Young Women',
  'YW',
  'Primary',
  'Sunday School',
  'Music',
  'Other',
];

export const SHARE_WITH_OPTIONS = ['Bishopric', 'Ward Council', 'Youth Council'];

export const ORDINANCE_TYPES = ['Baptism', 'Confirmation', 'Deacon', 'Teacher', 'Priest'];

export const ORDINANCE_STATUSES = ['Upcoming', 'Interviewed', 'Completed', 'Recorded'];

export const ORDINANCE_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  Upcoming: { bg: 'bg-gray-100', text: 'text-gray-700' },
  Interviewed: { bg: 'bg-blue-100', text: 'text-blue-800' },
  Completed: { bg: 'bg-green-100', text: 'text-green-800' },
  Recorded: { bg: 'bg-pink-100', text: 'text-pink-800' },
};

export const CHURCH_ROLES = [
  'Bishop',
  'First Counselor',
  'Second Counselor',
  'Clerk',
  'Executive Secretary',
  'Assistant Executive Secretary',
  'Assistant Clerk',
  'High Councilor',
];

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
  '3-Papers Completed',
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

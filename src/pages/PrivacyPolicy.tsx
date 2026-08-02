import { useAuth } from '../lib/auth';
import { useAppTitle } from '../lib/wardName';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold text-gray-800">{title}</h2>
      <div className="text-sm text-gray-700 space-y-2 leading-relaxed">{children}</div>
    </section>
  );
}

// What each hub actually stores about members — only what that hub's own pages can see.
// See functions/api/[[route]].ts's WC_FULL_CRUD/WC_READABLE and the yc/cal route guards
// in App.tsx for what backs this.
const BH_MEMBER_ITEMS = [
  'Name, birth date, and gender, synced periodically from the Church’s own membership records (LCR)',
  'Current and past callings, and temple recommend status/expiration',
  'Interview scheduling and completion status (temple recommend, youth, calling, and other interviews)',
  'Missionary service status, for members currently serving',
  'Move-in and move-out records, sacrament meeting assignments (speaking, prayers, music), and notes leaders enter about ministering or member needs',
];

const WC_MEMBER_ITEMS = [
  'Missionary service status, for members currently serving',
  'Baby blessing tracking (name, due/blessing date, status)',
  'Sacrament meeting assignments (speaking, prayers, music) and ward business notes',
  'Notes ward council members enter about ministering or member needs',
  'Calendar events and the youth activity calendar',
];

const YC_MEMBER_ITEMS = [
  'Youth activity calendar entries (event names, dates, and descriptions)',
  'Youth council meeting assignments',
];

const CAL_MEMBER_ITEMS = [
  'Calendar event details (names, dates, times, and descriptions)',
];

const LEADER_ITEMS = [
  'Name and email address, and a securely hashed password (never stored in plain text)',
  'Login history and IP address, kept briefly to block repeated failed login attempts',
];

const WHO_SEES: Record<'bh' | 'wc' | 'yc' | 'cal', string> = {
  bh: 'Only accounts assigned to the bishopric can view calling, interview, temple recommend, and full membership records. Ward Council and Youth Council accounts do not have access to any of it.',
  wc: 'This hub has no access to calling records, interview scheduling, or membership details like birth date, gender, or temple recommend status — those are visible only to the bishopric.',
  yc: 'This hub has no access to membership, calling, interview, or other ward records — only the youth activity calendar and youth council meeting assignments.',
  cal: 'This hub has no access to membership, calling, interview, or other ward records — only calendar events.',
};

export default function PrivacyPolicy() {
  const { user, selectedHub } = useAuth();
  const appTitle = useAppTitle();

  // hub='both' accounts see whichever hub they're currently viewing; single-hub accounts always see their own.
  const effectiveHub = ((user?.hub === 'both' ? selectedHub : user?.hub) || 'bh') as 'bh' | 'wc' | 'yc' | 'cal';
  const memberItems = effectiveHub === 'wc' ? WC_MEMBER_ITEMS
    : effectiveHub === 'yc' ? YC_MEMBER_ITEMS
    : effectiveHub === 'cal' ? CAL_MEMBER_ITEMS
    : BH_MEMBER_ITEMS;
  const memberItemsLabel = effectiveHub === 'cal' ? 'About events on the calendar:' : 'About ward members:';

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Privacy Policy</h1>
        <p className="text-sm text-gray-500">{appTitle} — last updated Aug 2, 2026</p>
      </div>

      <Section title="What this is">
        <p>
          {appTitle} is an internal tool used by this ward's leadership to organize callings, interviews,
          sacrament meetings, ministering, and related record-keeping. It is not a public website: every page
          requires a login, and it isn't indexed by search engines or connected to any social media or
          advertising service.
        </p>
      </Section>

      <Section title="Who can see what">
        <p>{WHO_SEES[effectiveHub]}</p>
      </Section>

      <Section title="Information this tool stores">
        {memberItems.length > 0 && (
          <>
            <p className="font-medium">{memberItemsLabel}</p>
            <ul className="list-disc list-inside space-y-1 pl-1">
              {memberItems.map(item => <li key={item}>{item}</li>)}
            </ul>
          </>
        )}
        <p className="font-medium">About leaders using the tool:</p>
        <ul className="list-disc list-inside space-y-1 pl-1">
          {LEADER_ITEMS.map(item => <li key={item}>{item}</li>)}
        </ul>
      </Section>

      <Section title="How it's used">
        <p>
          This information exists to help this ward's leadership carry out their assigned responsibilities. It
          is not used for advertising, sold, or shared with any organization outside the Church, and nothing here
          is analyzed or used for purposes beyond that.
        </p>
      </Section>

      <Section title="How it's protected">
        <p>
          The site is served entirely over HTTPS. Passwords are stored as salted cryptographic hashes, never in
          plain text. Data is hosted on Cloudflare's infrastructure (Workers and D1), the same platform used for
          the site itself and its background jobs — no separate third-party database or analytics provider is
          involved.
        </p>
      </Section>

      <Section title="Questions or requests">
        <p>
          If you have a question about your information in this tool, or want something corrected or removed,
          contact your bishop.
        </p>
      </Section>
    </div>
  );
}

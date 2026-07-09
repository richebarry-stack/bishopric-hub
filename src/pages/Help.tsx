import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { BISHOPRIC_CALLINGS, WC_CALLINGS, YC_CALLINGS, CAL_CALLINGS } from '../lib/constants';

interface Section {
  title: string;
  icon: string;
  content: React.ReactNode;
}

function Accordion({ sections }: { sections: Section[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="space-y-2">
      {sections.map((s, i) => (
        <div key={i} className="border border-gray-200 rounded-lg overflow-hidden">
          <button
            className="w-full flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 text-left"
            onClick={() => setOpen(open === i ? null : i)}
          >
            <span className="text-lg w-6 text-center">{s.icon}</span>
            <span className="font-medium text-gray-800 flex-1">{s.title}</span>
            <span className="text-gray-400 text-sm">{open === i ? '▲' : '▼'}</span>
          </button>
          {open === i && (
            <div className="px-4 py-4 bg-white border-t border-gray-100 text-sm text-gray-700 space-y-2 leading-relaxed">
              {s.content}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function UL({ items }: { items: string[] }) {
  return (
    <ul className="list-disc list-inside space-y-1 pl-1">
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  );
}

const VIEWER_SECTIONS: Section[] = [
  {
    title: 'Current Sacrament Meeting',
    icon: '♫',
    content: (
      <div className="space-y-2">
        <p>This page shows the agenda for the current or upcoming sacrament meeting.</p>
        <p>Use the <strong>‹ ›</strong> arrow buttons at the top to navigate between Sundays, or click <strong>Next Sunday</strong> to jump to the upcoming meeting.</p>
        <p>The agenda displays in order: conducting, music, speakers, prayers, announcements, and ward business.</p>
        <p>Use <strong>Copy Text</strong> to copy the full agenda to your clipboard, or <strong>Export PDF</strong> to open a printable version.</p>
      </div>
    ),
  },
  {
    title: 'Music Coordinator — Editing Music',
    icon: '♪',
    content: (
      <div className="space-y-2">
        <p>As music coordinator you can edit the following fields directly on the agenda:</p>
        <UL items={['Chorister', 'Organist', 'Opening Hymn', 'Sacrament Hymn', 'Rest Hymn / Special Music', 'Closing Hymn']} />
        <p>All other fields are view-only for your role.</p>
        <p>After making changes, click <strong>Save Music</strong> at the bottom of the page. Changes are not auto-saved — you must click the button.</p>
      </div>
    ),
  },
  {
    title: 'Changing Your Password',
    icon: '🔒',
    content: (
      <div className="space-y-2">
        <p>Click <strong>Change Password</strong> at the bottom of the sidebar to update your password.</p>
        <p>Enter your current password, then your new password twice. Passwords must be at least 6 characters.</p>
      </div>
    ),
  },
];

const WC_SECTIONS: Section[] = [
  {
    title: 'Getting Started (Ward Council)',
    icon: '⌂',
    content: (
      <div className="space-y-2">
        <p>Ward Council Hub is for ward council members — use the sidebar to move between pages. Your Dashboard can be customized (⚙ Customize) to show the panels you care about most.</p>
      </div>
    ),
  },
  {
    title: 'WC Meeting Assignments',
    icon: '▦',
    content: (
      <div className="space-y-2">
        <p>Upcoming and past ward council meetings, with opening prayer, spiritual thought, and closing prayer assignments for each.</p>
      </div>
    ),
  },
  {
    title: 'Discussion Topics',
    icon: '◈',
    content: (
      <div className="space-y-2">
        <p>Each organization (Elders Quorum, Relief Society, Primary, etc.) has a Status, Next Steps, and Help Needed field for the upcoming meeting. "Copy from prior meeting" carries forward last week's entries so you can update rather than retype them.</p>
        <p>Categories are editable via "Manage Categories" if your organizations don't match the defaults.</p>
      </div>
    ),
  },
  {
    title: 'Wins for the Ward',
    icon: '★',
    content: (
      <div className="space-y-2">
        <p>A running log of good things happening in the ward, grouped by week — useful for ward council discussion and sharing with leadership.</p>
      </div>
    ),
  },
  {
    title: 'Ward Council Members',
    icon: '⊕',
    content: (
      <div className="space-y-2">
        <p>The people with Ward Council Hub access. Admins can add members, reset passwords, and edit names/emails here.</p>
      </div>
    ),
  },
  {
    title: 'Member Needs',
    icon: '♥',
    content: (
      <div className="space-y-2">
        <p>Health and support needs shared with ward council. Toggle <strong>Pray for</strong> to flag someone for prayer, and mark entries resolved when addressed.</p>
      </div>
    ),
  },
  {
    title: 'Calendar of Events & Youth Calendar',
    icon: '⇗',
    content: (
      <div className="space-y-2">
        <p>Ward and youth activity calendars. Events flagged "Announce in sacrament" surface automatically in the sacrament meeting agenda.</p>
      </div>
    ),
  },
  {
    title: 'Changing Your Password',
    icon: '⚿',
    content: <p>Use the "Change Password" link in the sidebar footer at any time.</p>,
  },
];

const YC_SECTIONS: Section[] = [
  {
    title: 'Getting Started (Youth Council)',
    icon: '⌂',
    content: (
      <div className="space-y-2">
        <p>Youth Council Hub gives access to the Youth Calendar — activity dates, times, and locations for each youth organization (Builders of Faith, Messengers of Hope, Gatherers of Light, Deacons, Teachers, Priests).</p>
        <p>Click a date to edit that week's activities, or add a new date with "+ Add Date".</p>
      </div>
    ),
  },
  {
    title: 'Changing Your Password',
    icon: '⚿',
    content: <p>Use the "Change Password" link in the sidebar footer at any time.</p>,
  },
];

const FULL_SECTIONS: Section[] = [
  {
    title: 'Getting Started',
    icon: '⌂',
    content: (
      <div className="space-y-2">
        <p>Bishopric Hub is a private planning tool. Use the sidebar to navigate between pages. Drag the <strong>⠿</strong> handle next to any nav item to reorder it — your order is saved per user.</p>
        <div className="space-y-1">
          <p><strong>Admin</strong> — full access including user management and renaming page links.</p>
          <p><strong>Editor</strong> — full access to all planning pages; cannot manage users.</p>
          <p><strong>Viewer</strong> — Current Sacrament Meeting page only. Music coordinators can edit music fields; website administrators are read-only.</p>
        </div>
      </div>
    ),
  },
  {
    title: 'Current Sacrament Meeting',
    icon: '♫',
    content: (
      <div className="space-y-2">
        <p>Plan the upcoming sacrament meeting agenda. Changes auto-save a few seconds after you stop typing.</p>
        <UL items={[
          'Navigate between Sundays with the ‹ › arrows or click Next Sunday.',
          'Add speakers with "+ Add speaker". Use the ↑↓ arrows to reorder them.',
          'Add extra agenda notes with "+ Add agenda item".',
          'Add optional items (Child Blessing, Confirmation, Priesthood Advancement) with the buttons at the bottom of the agenda.',
          '"Copy Text" copies a plain-text agenda to your clipboard.',
          '"Export PDF" opens a printable version.',
          '"Save to Sacrament Planning" saves all fields to the database immediately.',
        ]} />
        <p>The <strong>Conducting</strong> field is auto-populated each month from the rotating assignments but can always be overridden.</p>
        <p>Callings at <em>Called &amp; accepted</em> status appear in To Be Sustained automatically. Callings at <em>Need to thank at pulpit</em> appear in To Be Thanked. Past dates show a saved snapshot instead of live data.</p>
      </div>
    ),
  },
  {
    title: 'Sacrament Planning',
    icon: '♪',
    content: (
      <div className="space-y-2">
        <p>A list view of sacrament meeting themes and conducting assignments across all weeks. Click any row to edit its theme, scripture references, conducting, and meeting link. Useful for planning months in advance.</p>
      </div>
    ),
  },
  {
    title: 'Calling Pipeline',
    icon: '◉',
    content: (
      <div className="space-y-2">
        <p>Track callings from initial discussion through completion. Statuses move in order:</p>
        <UL items={[
          '1. Discussion → 2. Pray about → 3. Approved and assigned',
          '4. Called & accepted → 5. Sustained → 6. Set apart',
          '7. Need to release → 8. Need to thank at pulpit → 9. Released',
        ]} />
        <p>Callings at <strong>4. Called &amp; accepted</strong> appear automatically in the "To Be Sustained" section of the sacrament agenda. Callings at <strong>8. Need to thank at pulpit</strong> appear in "To Be Thanked."</p>
      </div>
    ),
  },
  {
    title: 'Interview Pipeline',
    icon: '◎',
    content: (
      <div className="space-y-2">
        <p>Track bishop and counselor interviews — youth temple recommends, annual interviews, mission prep interviews, and others.</p>
        <p>Record the interview type, current status, assigned interviewer, last interview date, and next scheduled date.</p>
      </div>
    ),
  },
  {
    title: 'Tasks',
    icon: '☑',
    content: (
      <div className="space-y-2">
        <p>Action items for the bishopric. Assign tasks to individuals and check them off when done.</p>
        <p>The <strong>Share with</strong> field controls which group sees the task (Bishopric, Ward Council, or Youth Council).</p>
      </div>
    ),
  },
  {
    title: 'Bishopric Meetings',
    icon: '▦',
    content: (
      <div className="space-y-2">
        <p>Agenda and minutes for weekly bishopric meetings. Record spiritual thought, opening and closing prayers, handbook training topic and section, and meeting notes.</p>
        <p>Check <strong>No meeting</strong> if the meeting is cancelled and note the reason.</p>
      </div>
    ),
  },
  {
    title: 'Member Needs',
    icon: '♥',
    content: (
      <div className="space-y-2">
        <p>Track members who need support — health, emotional, or other needs.</p>
        <p>Toggle <strong>Pray for</strong> to flag someone for prayer in meetings. Mark entries resolved when the need is addressed. Use <strong>Share with</strong> to control which leadership group can see the entry.</p>
      </div>
    ),
  },
  {
    title: 'Missionary Pipeline',
    icon: '✈',
    content: (
      <div className="space-y-2">
        <p>Track prospective missionaries, currently serving missionaries, and recently returned missionaries.</p>
        <p>Record temple preparation status, call received, report date, release date, and current status.</p>
      </div>
    ),
  },
  {
    title: 'Babies',
    icon: '★',
    content: (
      <div className="space-y-2">
        <p>Track new babies — expected, born, blessed, and recorded. Fields include due/birth date and blessing date.</p>
      </div>
    ),
  },
  {
    title: 'Out of Town',
    icon: '⇢',
    content: (
      <div className="space-y-2">
        <p>Track when bishopric members or key leaders will be away. Helps with scheduling coverage and assignments.</p>
        <p>Record who, start date, end date, and notes.</p>
      </div>
    ),
  },
  {
    title: 'Calendar Events',
    icon: '▣',
    content: (
      <div className="space-y-2">
        <p>Track upcoming ward events. Toggle <strong>Announce in sacrament</strong> to flag items that need to be mentioned over the pulpit.</p>
        <p>Events can be shared with specific leadership groups.</p>
      </div>
    ),
  },
  {
    title: 'Bishop Schedule',
    icon: '🕐',
    content: (
      <div className="space-y-2">
        <p>Track the bishop's individual appointments with start time, end time, title, and notes. Separate from the bishopric meeting schedule.</p>
      </div>
    ),
  },
  {
    title: 'Bishopric Assignments',
    icon: '⟳',
    content: (
      <div className="space-y-2">
        <p>Rotating monthly assignments for who plans and conducts sacrament meeting and who gives the primary message.</p>
        <p>When an assignment is saved for a month, the system automatically fills in the <strong>Conducting</strong> field for every Sunday in that month — up to 12 months ahead. Individual Sundays can always be overridden.</p>
        <p>The auto-fill runs in the background each time someone logs in.</p>
      </div>
    ),
  },
  {
    title: 'Important Links',
    icon: '⇗',
    content: (
      <div className="space-y-2">
        <p>A list of frequently-used URLs — handbooks, tools, forms, or any resources the bishopric references often. Add a title, URL, and optional description for each link.</p>
      </div>
    ),
  },
  {
    title: 'Hub Access by Calling',
    icon: '⊞',
    content: (
      <div className="space-y-3">
        <p>Each calling is automatically assigned to a hub when a user account is created or approved. Users can only access the pages in their assigned hub.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {([
            { label: 'Bishopric Hub', desc: 'Full bishopric + ward council access', color: 'border-blue-200 bg-blue-50', header: 'text-blue-800', callings: BISHOPRIC_CALLINGS },
            { label: 'Ward Council Hub', desc: 'Ward council access only', color: 'border-emerald-200 bg-emerald-50', header: 'text-emerald-800', callings: WC_CALLINGS },
            { label: 'Youth Council Hub', desc: 'Youth calendar only', color: 'border-amber-200 bg-amber-50', header: 'text-amber-800', callings: YC_CALLINGS },
            { label: 'Calendar Hub', desc: 'Calendar of events only', color: 'border-violet-200 bg-violet-50', header: 'text-violet-800', callings: CAL_CALLINGS },
          ] as const).map(({ label, desc, color, header, callings }) => (
            <div key={label} className={`rounded-lg border p-3 ${color}`}>
              <p className={`text-xs font-bold uppercase tracking-wide mb-0.5 ${header}`}>{label}</p>
              <p className="text-xs text-gray-500 mb-2">{desc}</p>
              <ul className="space-y-0.5">
                {(callings as readonly string[]).map(c => (
                  <li key={c} className="text-xs text-gray-700">{c}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    title: 'Users (Admin Only)',
    icon: '⊕',
    content: (
      <div className="space-y-2">
        <p>Manage user accounts. Admins can:</p>
        <UL items={[
          'Add new users with a name, email, password, app role, and church role.',
          "Change any user's app role (admin / editor / viewer) using the inline dropdown.",
          "Change any user's church role inline.",
          'Force a password reset for any user.',
          'Delete accounts.',
        ]} />
        <p><strong>App role</strong> controls what pages and actions a user can access. <strong>Church role</strong> identifies their calling — viewer accounts with the church role "Music Coordinator" can edit music fields on the sacrament agenda; "Website Administrator" viewers are read-only.</p>
      </div>
    ),
  },
  {
    title: 'Renaming Page Links (Admin Only)',
    icon: '✎',
    content: (
      <div className="space-y-2">
        <p>Admins can rename any sidebar link. Click <strong>Rename Links</strong> at the bottom of the sidebar, edit the labels, then click <strong>Save Labels</strong>. The new names are stored in the database and visible to all users. Click the <strong>↩</strong> icon next to any label to reset it to its default name.</p>
      </div>
    ),
  },
  {
    title: 'Changing Your Password',
    icon: '🔒',
    content: (
      <div className="space-y-2">
        <p>Click <strong>Change Password</strong> at the bottom of the sidebar. Enter your current password and your new password twice. Passwords must be at least 6 characters.</p>
      </div>
    ),
  },
  {
    title: 'Emergency Admin Password Recovery',
    icon: '🚨',
    content: (
      <div className="space-y-3">
        <p>If the primary admin is locked out and no other admin can reset the password, use the emergency recovery endpoint.</p>
        <p><strong>One-time setup (do this now while logged in):</strong></p>
        <ol className="list-decimal list-inside space-y-1 text-sm">
          <li>Go to the Cloudflare dashboard → Workers &amp; Pages → bishopric-hub → Settings → Environment Variables.</li>
          <li>Add a secret variable named <code className="bg-gray-100 px-1 rounded">RECOVERY_KEY</code> with a strong value you will remember (e.g. a passphrase).</li>
          <li>Redeploy so the variable takes effect.</li>
        </ol>
        <p><strong>When locked out, run this command from any terminal:</strong></p>
        <pre className="bg-gray-100 rounded p-3 text-xs overflow-x-auto whitespace-pre-wrap">{`curl -s -X POST https://bishopric-hub.pages.dev/api/auth/emergency-reset \\
  -H "Content-Type: application/json" \\
  -d '{"email":"YOUR_EMAIL","new_password":"NEW_PASSWORD","recovery_key":"YOUR_RECOVERY_KEY"}'`}</pre>
        <p className="text-sm text-gray-500">Replace the values in caps. A <code className="bg-gray-100 px-1 rounded">{`{"ok":true}`}</code> response means success — log in with your new password.</p>
      </div>
    ),
  },
];

declare const __APP_VERSION__: string;

export default function Help() {
  const { user, selectedHub } = useAuth();
  const isViewer = user?.role === 'viewer';
  const isMusicCoord = /music.?coordinator/i.test(user?.church_role || '');
  // hub='both' users see whichever hub they're currently viewing; single-hub accounts always see their own.
  const effectiveHub = user?.hub === 'both' ? selectedHub : user?.hub;

  const sections = isViewer
    ? (isMusicCoord ? VIEWER_SECTIONS : VIEWER_SECTIONS.filter(s => s.title !== 'Music Coordinator — Editing Music'))
    : effectiveHub === 'wc' ? WC_SECTIONS
    : effectiveHub === 'yc' ? YC_SECTIONS
    : FULL_SECTIONS;

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Help</h1>
        <p className="text-sm text-gray-500">Click any section to expand it.</p>
      </div>
      <Accordion sections={sections} />

      <div className="mt-8 border-t border-gray-100 pt-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Version History</h2>
        <div className="space-y-4">
          {([
            {
              date: 'Jul 8, 2026',
              items: [
                'Youth Activities: an activity no longer moves to the "past" list until 24 hours after its date, so it stays visible as upcoming for viewers in any time zone through the day of the event',
                'Multi-user editing safety: the app now checks every 30 seconds for changes made by other users, and if two people edit the same record at the same time, the second save is blocked with a "reloaded — please re-apply your change" message instead of silently overwriting the first person\'s edit',
                'Every delete button across the app now asks for confirmation before removing anything, and saves show a "Saved" confirmation so it\'s clear when a change has gone through',
                'Ward Members: birth date and Speakers/Prayers eligibility can now be edited directly on the page, and admins can bulk-update the roster with "Import CSV" — it matches names against the existing roster, flags anything it can\'t confidently match for manual review, and lets you choose which members no longer on the list should be deactivated',
                'Add User no longer requires typing a password — a temporary one is generated automatically and shown once, the same way password resets already worked',
                'Adding a user (or approving a request) with a calling not on the standard list now requires explicitly choosing which hub they should access, instead of silently defaulting to Ward Council',
                '"Email Notifications" renamed to "Automation & Notifications" and now shows when background jobs (sacrament conducting sync, expired-session cleanup) last ran and whether they succeeded — these run automatically once a day',
                'Dashboard panels now stack into a single column on narrow screens instead of squeezing side by side',
                'Help now shows Ward Council- and Youth Council-specific content instead of the bishopric-centric list for those hubs',
                'Close (×) and remove buttons across the app now have accessible labels for screen readers',
              ],
            },
            {
              date: 'Jul 7, 2026',
              items: [
                'Missionary Pipeline: removed automatic Farewell/Homecoming talk syncing to Sacrament Planning — name-format mismatches (nicknames, "First Last" vs "Last, First") were creating duplicate/confusing speaker entries; add these talks directly in Sacrament Planning instead',
                'Users page: "Last Login" column replaced with "Last Access", which updates as users use the app (not just when they sign in) — more informative now that sessions stay active for weeks at a time',
              ],
            },
            {
              date: 'Jul 6, 2026',
              items: [
                'Bishop\'s Schedule: added recurring appointments (daily, weekly, or monthly on the same weekday) with a stop date instead of a fixed count; edit one occurrence independently, "Save + apply to future" to update the rest of the series, and "Delete this and future" to remove upcoming occurrences without touching past ones',
              ],
            },
            {
              date: 'Jul 5, 2026',
              items: [
                'Guest login flows added for viewing the youth schedule and sacrament program without an account',
                'Hub Suggestions page added for submitting feature/bug ideas, with an Implemented status; added to Ward Council nav',
                'Ward Council can now edit Youth Activities and Babies directly',
                'Ward Council dashboard: Member Needs split into separate Health Needs and Other Needs panels',
                'Wins for the Ward reworked to a weekly table view',
                'Discussion Topics: organization categories are now admin-editable instead of fixed',
                'Sacrament agenda: added Introductory Remarks, Recognize, and Closing Remarks fields, included in Copy Text and Export PDF',
                'Escape key now closes all popup dialogs',
                'Sacrament guest view no longer shows announcements',
                'Calling Pipeline: new "Pray About" section',
                'Missionary Pipeline: sortable columns',
                'Sacrament Planning: warns before discarding unsaved agenda changes',
                'Fixed: Hub Suggestions link in Ward Council nav no longer redirects to the dashboard',
                'Ward Council sidebar now grouped into categories (Ward Council, Ward Care, Sacrament Meeting, Calendar, Administration), matching the Bishopric Hub layout',
                'Discussion Topics: "Manage Categories" is now available to all users, not just admins',
                'Sacrament agenda: Introductory Remarks and Recognize now pre-fill with a welcome message and the stake High Councilor/music/door-greeter thanks; Recognize items can be added or removed individually',
                'Sacrament agenda: added a Fast & Testimony Meeting toggle that replaces assigned speakers with a Bearing of Testimonies item, in both Current Sacrament and Sacrament Planning',
                'Sacrament export: "To Be Thanked" section now includes standard release wording before the names',
                'Sacrament export: removed the "Note:" prefix on custom agenda items',
                'Sacrament agenda: added an editable "Preparing for the Sacrament" line just before the Sacrament Hymn',
                'Guests and Ward Council now see only the core meeting structure (Presiding, Conducting, Chorister, Organist, Opening Hymn, Sacrament Hymn, Speakers/Testimonies, Closing Hymn)',
                'Sacrament export: "To Be Sustained" section now includes standard sustaining vote wording after the names',
                'Sacrament export: "Bearing of Testimonies" now bolded like other section headers',
                'Sacrament agenda: Recognize items are now multi-line text fields so longer entries are fully visible',
                'Fixed: High Councilor recognition sometimes missing from Recognize defaults due to a data-loading race condition',
                'Sacrament agenda: music thanks in Recognize now automatically follows that week\'s current Organist/Chorister fields instead of being frozen in at save time',
                'Sacrament agenda: added a dedicated High Councilor field, pre-filled from the current High Councilor user and editable per week; feeds the Recognize section in the export automatically',
                'Sacrament agenda: added an "Other Stake Representatives" field for recognizing additional stake guests when present; left blank by default and omitted from the export when empty',
                'Export PDF no longer auto-opens the print dialog — print manually from the opened tab when ready',
                'Sacrament export: "Bearing of Testimonies" no longer shows a trailing colon, but still bolds correctly',
                'Sacrament export: "To Be Sustained" now introduces the names with "The following have been called to positions in the ward. We ask that if they are present that they please stand and remain standing until the sustaining vote is complete." before listing name — calling',
                'Sacrament export: "Closing Remarks" now always appears in the export, even when the field is left blank',
                'Sacrament export: High Councilor recognition now reads "Brother [Last Name]" instead of the full name',
                'Auto-filled Conducting for future sacrament meetings now shows "Bishop [Last Name]" or "Brother [Last Name]" instead of the full name, including retroactively fixing already-scheduled future weeks',
                'Fixed: prayers and speakers entered in Current Sacrament now match ward member records the same way Sacrament Planning already did, so they correctly show up in the Speakers & Prayers count history',
                'Bishopric Meetings: added recurring meetings (weekly, every 2/3/4 weeks) with a set number of occurrences; edit one occurrence independently, or "Save + apply to future meetings" to update the rest of the series at once',
              ],
            },
            {
              date: 'Jun 28, 2026',
              items: [
                'Toast notifications replace browser alerts for save errors',
                'Interview Pipeline: overdue row highlighting, interview-type filter, bulk status update, unsaved-changes indicator',
                'Calling Pipeline: Timeline view showing days in current status',
                'Tasks: due-date field with overdue/due-soon indicators; assignee filter',
                'Member Needs: last-updated date column',
                'Sacrament agenda: auto-save unsaved indicator; prayer saves correctly when navigating away; print stylesheet expands all text fields',
                'Dashboard: last-visited quick-return link; due-date indicators on pending tasks',
                'Youth age cutoff corrected to September 1 of the year a member turns 18',
                'WC hub: ward business, stake business, and calling data correctly hidden',
                'YC hub access added for Ward Council and Bishopric users',
                'Hub switching navigates to the default page for that hub',
                'Version number displayed in Help',
              ],
            },
            {
              date: 'Jun 27, 2026',
              items: [
                'Age column added to Annual Youth and Semi-Annual Youth interview tables',
                'Copy announcements from prior week button in Current Sacrament',
                'Ward business and stake business hidden from Ward Council hub view',
              ],
            },
            {
              date: 'Jun 26, 2026',
              items: [
                'Future sacrament meetings locked from editing until the current week',
                'Dashboard panels resizable; ward business moved to its own field',
                'Ward Members page added',
                'Speakers & Prayers history page added with age display and notes',
                'Member name normalization on import',
              ],
            },
            {
              date: 'Earlier',
              items: [
                'Auto-fill sacrament conducting from monthly assignments (sync-conduct)',
                'GitHub Actions continuous deploy workflow',
                'Calendar date timezone fix',
                'Initial release: Dashboard, Calling Pipeline, Interview Pipeline, Sacrament Planning, Current Sacrament, Tasks, Member Needs, Missionary Pipeline, Calendaring, Babies, Out of Town, Bishop Schedule, Assignments, Prayer List, Important Links, Users',
              ],
            },
          ] as { date: string; items: string[] }[]).map(({ date, items }) => (
            <div key={date}>
              <p className="text-xs font-semibold text-gray-500 mb-1">{date}</p>
              <ul className="space-y-0.5">
                {items.map(item => (
                  <li key={item} className="text-xs text-gray-600 flex gap-2">
                    <span className="text-gray-300 shrink-0">·</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-6 text-xs text-gray-400">Build: {__APP_VERSION__}</p>
    </div>
  );
}

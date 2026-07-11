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
    title: 'My Actions',
    icon: '⚡',
    content: (
      <div className="space-y-2">
        <p>A personal page gathering everything currently assigned to you — action items, an upcoming prayer or speaking assignment, and more. The sidebar link shows a red count badge whenever something needs your attention.</p>
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
    title: 'Youth Council Meetings',
    icon: '▦',
    content: (
      <div className="space-y-2">
        <p>Agenda and notes for the ward youth council — usually meets monthly.</p>
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
    title: 'My Actions',
    icon: '⚡',
    content: (
      <div className="space-y-2">
        <p>A personal page gathering everything currently assigned to you — action items, a calling you need to extend, an interview you need to conduct, an upcoming sacrament speaking/prayer/music assignment, and more.</p>
        <p>The <strong>My Actions</strong> link in the sidebar shows a red count badge whenever something needs your attention, so you don't have to open the page to know. Click it to see the details and jump straight to the relevant page.</p>
        <p>Matching is by name, so an assignment only shows up here if it was assigned to your exact account name — use the "Select or type name…" list on Action Items, Calling Pipeline, and Interview Pipeline to pick your name from the list of accounts rather than typing it, so it matches reliably.</p>
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
        <p>Track bishop and counselor interviews — youth interviews, temple recommends, mission prep interviews, calling interviews, and others.</p>
        <p>Record the interview type, current status, assigned interviewer, last interview date, and next scheduled date.</p>
        <p><strong>Youth Interviews</strong> are handled automatically: every active youth (ages 12–17) is kept in a single "Youth Interviews" section, added and re-bucketed between ages 12–15 and 16–17 as they have birthdays — no manual entry needed. Every youth is interviewed every 6 months: for ages 12–15, alternate between the bishop and the counselor over that youth's quorum/class; for ages 16–17, both interviews should be with the bishop himself, if possible. New entries default to the bishop as a starting point — reassign to the counselor for the 12–15 group's alternating interview.</p>
        <p>Status isn't set by hand; it's computed from the dates you enter: <strong>Scheduled</strong> (a future Next Interview Date is set), <strong>Up to date</strong> (interviewed within the last 6 months), or <strong>Due</strong> (neither). The Next/Last Interview columns show which age bracket (12–15/16–17) each date is for. Members who age out or become inactive drop out of the default view — use "Show aged-out/inactive" to see them.</p>
        <p>Editing a linked youth's name here also corrects it on Ward Members (their "ward directory" name). A separate <strong>Preferred Name</strong> field lets you set a casual name (e.g. "Bud") shown instead everywhere this person appears, without touching their legal name.</p>
        <p><strong>Assigned To</strong> is a "Select or type name…" list of bishopric accounts — picking a name here (rather than typing it) is what lets it show up correctly on that person's My Actions page.</p>
      </div>
    ),
  },
  {
    title: 'Ordinances',
    icon: '💧',
    content: (
      <div className="space-y-2">
        <p>Track baptisms and Aaronic Priesthood advancement (Deacon, Teacher, Priest) from discussion through recording.</p>
        <p>A <strong>Suggested this year</strong> box lists children turning 8 and young men turning 12, 14, or 16 this year, computed from birth dates and gender on Ward Members — click <strong>Track</strong> to add one, or <strong>Dismiss</strong> to hide it.</p>
      </div>
    ),
  },
  {
    title: 'Tasks',
    icon: '☑',
    content: (
      <div className="space-y-2">
        <p>Action items for the bishopric. Assign tasks to individuals and check them off when done.</p>
        <p><strong>Assigned To</strong> is a "Select or type name…" list of accounts — picking a name here (rather than typing it freely) is what lets the task show up correctly on that person's My Actions page.</p>
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
    title: 'Annual Duties',
    icon: '🗓',
    content: (
      <div className="space-y-2">
        <p>Recurring seasonal duties — tithing declaration, ward conference, annual budget, youth camp planning, and ward history. Each has a month window (edit it to match your ward's actual schedule).</p>
        <p>Duties are grouped into <strong>In Window Now</strong>, <strong>Upcoming</strong>, and <strong>Done This Year</strong>. Click <strong>Mark done</strong> once completed; it resets automatically the following year.</p>
        <p>An <strong>Annual Duties Due</strong> panel on the Dashboard shows what's currently in-window and not yet done.</p>
      </div>
    ),
  },
  {
    title: 'Youth Council Meetings',
    icon: '▦',
    content: (
      <div className="space-y-2">
        <p>Agenda and notes for the ward youth council — bishopric, quorum/class presidencies, and advisers usually meet monthly. Available to both the Bishopric and Youth Council hubs.</p>
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
              date: 'Jul 11, 2026',
              items: [
                'Sacrament Program (the read-only page shown to the sacrament guest account) now follows the order used in the Church handbook: Presiding, Conducting, Chorister, Organist, Opening Hymn, Opening Prayer, Ward and Stake Business, Sacrament Hymn, Administration of the Sacrament, Speakers (interleaved with any intermediate musical number), Closing Hymn, Closing Prayer. Prayer names are now shown; Ward and Stake Business and Administration of the Sacrament appear as headings only, with no details.',
                'Fixed: the youth guest account could reach the Youth Council Meetings page, which was never meant to be part of its view — it now only sees the Youth Calendar.',
                'Fixed: Ward Council members can now open Youth Council Meetings (read-only) — previously it redirected them to the Ward Council dashboard instead.',
                'Ward Members: "Deactivate"/"Reactivate" are now called "Remove from ward"/"Add back to ward", and the status badge reads "In Ward"/"Removed" — same behavior, clearer wording.',
                'Ward Members: added an "Out of ward" flag for someone who attends the ward but whose membership record is in another ward. It\'s an informational badge only and doesn\'t change how that person is treated anywhere else in the app.',
              ],
            },
            {
              date: 'Jul 10, 2026',
              items: [
                'Added a live "who\'s online" indicator: the sidebar now shows which other users are currently in the app and what page they\'re on, and a banner appears at the top of a page when someone else is viewing it (or actively editing it, shown in amber) — helps avoid two people working on the same thing at once.',
                'Speakers & Prayers and Interview Pipeline now show a card layout on phones instead of a hard-to-read sideways-scrolling table, with all the same actions (notes, include/exclude, select, delete) available.',
                'Faster loading: pages now load on demand instead of all at once, so the initial page load is noticeably faster, especially on phones.',
                'Action Items, Member Needs, Calendar Events, and Calling Pipeline now show "Last edited by [name]" in the edit form once a record has been saved by someone.',
                'Fixed: a user\'s "Last Access" on the Users page could lag a day behind if they had logged in less than 24 hours after their previous visit — it now updates as soon as they access the app on a new calendar day (in the ward\'s configured time zone).',
                'Admins can set the ward\'s time zone on the Automation & Notifications page — used to determine calendar-day boundaries like the one above.',
                'Added an Ordinances page tracking baptisms and Aaronic Priesthood advancement, with suggested candidates computed automatically from birth dates (and a new Gender field) on Ward Members.',
                'Added an Annual Duties page (tithing declaration, ward conference, annual budget, and similar) with a Dashboard panel showing what\'s due; window months are editable per duty.',
                'Added a Youth Council Meetings page (agenda and notes), available to both the Bishopric and Youth Council hubs.',
                'Ward Members: added an editable Gender field, used to suggest Aaronic Priesthood advancement candidates.',
                'Security: security question answers now use the same strong hashing as passwords (existing answers upgrade automatically the next time they\'re used to reset a password).',
                'Removed two unused legacy pages (Prayer List, an older Member Needs variant) that were no longer reachable from any menu.',
                'Added short descriptions under several page titles, and friendlier "nothing here yet" messages on a few pages that previously showed an empty table.',
                'Interview Pipeline: reworked youth interview tracking — Annual and Semi-Annual Youth are now one merged, roster-linked "Youth Interviews" section instead of two separate lists; every active youth is added automatically (no more manual entry, and no more duplicate rows), and their status is now computed from the interview dates (Scheduled / Up to date / Due) instead of set by hand. Editing a linked youth\'s name updates their name on Ward Members directly. Removed the old "Youth Interviews Due" box now that the table itself always reflects who\'s current.',
                'Added a Preferred Name field on Ward Members. When set, it\'s shown instead of the legal name on Interview Pipeline and My Actions; Ward Members itself always shows the legal name.',
                'Added a "My Actions" page — everything currently assigned to you (action items, a calling to extend, an interview to conduct, an upcoming prayer or speaking assignment, and more) in one place, with a red count badge on its sidebar link so you know at a glance whether anything needs your attention.',
                'My Actions no longer includes WC/Bishopric Meeting opening/closing prayer and spiritual thought assignments — those are routine meeting logistics rather than something that needed a separate reminder.',
                'Action Items and Interview Pipeline: "Assigned To" is now a "Select or type name…" list of accounts instead of a free-text field, so assignments match reliably on the My Actions page (typos and nicknames like "Rich" instead of "Rich Barry" were silently failing to match before).',
                'Interview Pipeline: the Next Interview and Last Interview columns now show which interview type (Annual/Semi-Annual) each date belongs to; added a Preferred Name field to the edit form for linked youth (separate from the legal-name field, which still updates Ward Members).',
                'Fixed: youth interview cadence was wrong for ages 12–15 — per the Handbook, that age group is also interviewed every 6 months (bishop, then an assigned counselor), not once a year. Renamed "Annual Youth"/"Semi-Annual Youth" to "Youth 12-15"/"Youth 16-17" since the real distinction is who conducts, not how often; new entries default to the bishop as a starting point.',
              ],
            },
            {
              date: 'Jul 9, 2026',
              items: [
                'Current Sacrament Meeting: each person in "To Be Sustained" and "To Be Thanked" can now be removed individually for just that week (click the × next to their name) — useful when a sustaining or release is deferred to a later Sunday. They stay off that week\'s agenda and history, but reappear automatically the following week since their calling status hasn\'t changed.',
              ],
            },
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
                'Security: passwords are now stored with a much stronger hash (existing passwords upgrade automatically the next time you sign in — no action needed), and repeated failed sign-in attempts are now temporarily blocked',
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

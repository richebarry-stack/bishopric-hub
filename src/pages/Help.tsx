import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { BISHOPRIC_CALLINGS, WC_CALLINGS, YC_CALLINGS, CAL_CALLINGS } from '../lib/constants';
import Modal from '../components/Modal';
import { VERSION_HISTORY } from '../../shared/versionHistory';

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
        <p>A personal page gathering the action items currently assigned to you. The sidebar link shows a red count badge whenever something needs your attention.</p>
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
        <p>A personal page gathering everything currently assigned to you — action items, a calling you need to extend, an interview you need to set up, and more. Sacrament meeting agenda assignments (speaking, prayers, chorister, organist) aren't listed here — they're already on the agenda. The clerk also sees a set of LCR record-keeping reminders here (sustainings, settings apart, releases, and baby church records that need recording) regardless of who they're assigned to.</p>
        <p>The <strong>My Actions</strong> link in the sidebar shows a red count badge whenever something needs your attention, so you don't have to open the page to know. Click it to see the details and jump straight to the relevant page.</p>
        <p>Matching is by name, so an assignment only shows up here if it was assigned to your exact account name — use the "Select or type name…" list on Action Items, Calling Pipeline, and the interview pages to pick your name from the list of accounts rather than typing it, so it matches reliably. Note that conducting an interview isn't itself a My Actions item — only setting one up is.</p>
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
          'For a Sunday with no sacrament meeting, set the meeting type at the top to Stake Conference or General Conference — the agenda is hidden for that week (nothing already entered is deleted).',
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
          '1. Discussion → 1.5 On hold (optional) → 2. Pray about → 3. Approved and assigned',
          '4. Called & accepted → 5. Sustained → 6. Set apart',
          '7. In release discussion → 8. Need to release → 9. Need to thank at pulpit → 10. Released',
        ]} />
        <p>Callings at <strong>4. Called &amp; accepted</strong> appear automatically in the "To Be Sustained" section of the sacrament agenda. Callings at <strong>9. Need to thank at pulpit</strong> appear in "To Be Thanked."</p>
        <p>Three checkboxes track LCR record-keeping — sustaining, setting apart, and (once released) release — each surfaced to the clerk on My Actions until checked. Reaching <strong>5. Sustained</strong> also auto-creates a "Setting Apart" entry on Other Interviews, which clears itself once the setting apart box here is checked or the calling is deleted.</p>
      </div>
    ),
  },
  {
    title: 'Youth / Temple / Other Interviews',
    icon: '◎',
    content: (
      <div className="space-y-2">
        <p>Interview tracking is split across three pages so each stays easy to scan: <strong>Youth Interviews</strong>, <strong>Adult Temple Interviews</strong> (endowed/unendowed/limited-use recommends), and <strong>Other Interviews</strong> (calling interviews, setting apart, patriarchal blessing referrals, mission prep, and everything else). Every category always shows on its page, even with nothing pending, so it's clear what's covered.</p>
        <p>Each interview has two separate assignments: an <strong>Interviewer</strong> (who conducts the interview) and a <strong>Setup</strong> assignment (who schedules it, with its own Not started/Contacted/Scheduled/Done status). Only the setup assignment shows up on that person's My Actions — the interview itself is the interviewer's normal duty, not a to-do reminder.</p>
        <p><strong>Youth Interviews</strong> are handled automatically: every active youth (ages 12–17) is kept in a single merged section, added and re-bucketed between ages 12–15 and 16–17 as they have birthdays — no manual entry needed. Every youth is interviewed every 6 months: for ages 12–15, alternate between the bishop and the counselor over that youth's quorum/class; for ages 16–17, both interviews should be with the bishop himself, if possible.</p>
        <p>Youth status isn't set by hand; it's computed from the dates you enter: <strong>Scheduled</strong> (a future Next Interview Date is set), <strong>Up to date</strong> (interviewed within the last 6 months), or <strong>Due</strong> (neither). Members who age out or become inactive drop out of the default view — use "Show aged-out/inactive" to see them.</p>
        <p>A recommend's expiration is stored by month; it's treated as expiring on the last day of that month for the color-coded due/overdue highlighting. The Rec. Expires field doesn't apply to every interview type, so it's hidden where it wouldn't mean anything (e.g. patriarchal blessing referrals, mission prep, setting apart).</p>
        <p>Setting apart is tracked automatically: once a calling reaches <strong>Sustained</strong> in the Calling Pipeline, an unassigned "Setting Apart" entry appears on Other Interviews; it disappears once the setting apart is recorded in LCR there, or if the calling is deleted.</p>
        <p>Editing a linked youth's name here also corrects it on Ward Members (their "ward directory" name). A separate <strong>Preferred Name</strong> field lets you set a casual name (e.g. "Bud") shown instead everywhere this person appears, without touching their legal name.</p>
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
    title: 'Covenant Path',
    icon: '↗',
    content: (
      <div className="space-y-2">
        <p>Lists of members who may be ready for their next ordinance or blessing, built from the nightly LCR sync: patriarchal blessing, children approaching baptism, not baptized, priesthood office behind age, not endowed, married but not sealed, endowed without a current recommend, mission-age young men, part-member households (from LCR’s report), and households without a Melchizedek Priesthood holder.</p>
        <p>Click a list to open it. The ages for the patriarchal blessing, not baptized and not endowed lists can be changed at the top.</p>
        <p><strong>Hide</strong> takes someone off one list (for example a member who isn’t accountable), with an optional reason. Hidden people stay hidden for everyone until you click <strong>Show hidden</strong> and <strong>Restore</strong>.</p>
        <p>Click <strong>+ Bishopric</strong> or <strong>+ Ward Council</strong> on anyone to put them on that group’s upcoming meetings: the Covenant Path section of the Current Bishopric Meeting, and “From the bishopric” on the Ward Council’s Discussion Topics page, plus a panel on each Dashboard. Add an optional note for the agenda. They stay on until you click the button again (or Remove on the agenda), or until they drop off the list because the step is done. The ward council only sees people you add for them, with the name, a general topic such as “Temple preparation”, and your note; it never sees the list name, ages or other details.</p>
        <p>LCR has no field for patriarchal blessings, so their status (Not received, Recommend issued, Received) is kept in the hub. Set it on the Patriarchal blessing list or in the Ordinances column on Ward Members.</p>
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
        <p>Anyone from <strong>Candidate Completing Forms</strong> up until they enter the MTC appears automatically on the dashboards' <strong>Missionaries</strong> prayer list, and drops off once they enter the MTC. Tap 🙏 on the dashboard to take someone off the list; turn it back on from their Missionary Pipeline record.</p>
      </div>
    ),
  },
  {
    title: 'Babies',
    icon: '★',
    content: (
      <div className="space-y-2">
        <p>Track new babies — expected, born, blessed, and recorded. Fields include due/birth date and blessing date.</p>
        <p>A "Church record created (LCR)" checkbox tracks whether the clerk has recorded the baby's record — checking it while status is Blessed also advances status to Recorded. Until it's checked on a Blessed baby, it shows up on the clerk's My Actions. Babies still Expecting also appear in the Dashboard's Upcoming Events.</p>
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
        <p>Month, Plan &amp; Conduct and Primary Message are dropdowns. The names come from whoever has the Church Role <strong>Bishop</strong>, <strong>First Counselor</strong> or <strong>Second Counselor</strong> on the Users page, so update those roles when the bishopric changes. A saved name that's no longer in the bishopric shows as &ldquo;(not current)&rdquo; until you change it.</p>
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
        <p>Duties that are currently in their window and not yet done show in the Dashboard’s <strong>Action Items</strong> panel, marked “annual duty”.</p>
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
        <pre className="bg-gray-100 rounded p-3 text-xs overflow-x-auto whitespace-pre-wrap">{`curl -s -X POST ${window.location.origin}/api/auth/emergency-reset \\
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
  const [showFullHistory, setShowFullHistory] = useState(false);

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
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">Version History</h2>
          <button onClick={() => setShowFullHistory(true)} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
            View full history
          </button>
        </div>
        <div className="space-y-4">
          {VersionHistoryList(RECENT_HISTORY_COUNT)}
        </div>
      </div>

      {showFullHistory && (
        <Modal open onClose={() => setShowFullHistory(false)} title="Version History">
          <div className="space-y-4">
            {VersionHistoryList()}
          </div>
        </Modal>
      )}

      <p className="mt-6 text-xs text-gray-400">Build: {__APP_VERSION__}</p>
    </div>
  );
}

const RECENT_HISTORY_COUNT = 3;

function VersionHistoryList(limit?: number) {
  const entries = limit ? VERSION_HISTORY.slice(0, limit) : VERSION_HISTORY;
  return entries.map(({ date, items }) => (
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
  ));
}


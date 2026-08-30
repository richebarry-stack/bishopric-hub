import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { BISHOPRIC_CALLINGS, WC_CALLINGS, YC_CALLINGS, CAL_CALLINGS } from '../lib/constants';
import Modal from '../components/Modal';

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
        <p>A personal page gathering everything currently assigned to you — action items, a calling you need to extend, an interview you need to set up, an upcoming sacrament speaking/prayer/music assignment, and more. The clerk also sees a set of LCR record-keeping reminders here (sustainings, settings apart, releases, and baby church records that need recording) regardless of who they're assigned to.</p>
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

const VERSION_HISTORY: { date: string; items: string[] }[] = [
            {
              date: 'Aug 30, 2026',
              items: [
                'Added Tithing Declaration: bishopric can publish appointment slots (date, time, location) on a new "Tithing Declaration" admin calendar, and members reserve an open slot at /declare-tithing with no login required — one family per slot. A "Reservations" list at the top of the calendar shows who has reserved a slot at a glance, and the Bishop\'s existing calendar is overlaid (hatched) for reference when picking times — that overlay is never sent to the public reservation page.',
                'Member Needs: "+ Add Need" now defaults "Include in prayer list" to checked, matching the Dashboard and Ward Council quick-add forms.',
                'Fixed a bug where a member\'s preferred name (e.g. shown on the Speakers & Prayers page) could silently revert to the legal name after saving an unrelated interview — the Interview edit modal was overwriting it with a stale cached value.',
                'Fixed the real cause of speaker/prayer names reverting to the legal name: saving a speaker or prayer on the Current Sacrament page (and prayers on Sacrament Planning) normalizes whatever you typed against the ward roster — that normalization was rewriting it to the legal name instead of the person\'s preferred name.',
                'All Tithing Declaration slots (open or reserved) now also show (hatched) on the Bishop Schedule page, so his calendar reflects that blocked-off time. And on the Tithing Declaration page, "Unreserve" clears a family\'s reservation and reopens the slot without deleting it.',
                'Tithing Declaration signup page: location is now marked with a 📍 icon, already-booked slots show who reserved them so it\'s clear what\'s taken, and the page tells members to contact the bishopric directly to cancel or change a reservation.',
                'The Bishop/Counselor Schedule and Tithing Declaration weekly calendars now fill the available screen height when there\'s room, but each 15-minute row has a minimum height so appointment titles stay readable — on a shorter screen the calendar scrolls rather than shrinking text into illegibility. Also fixed appointments visually ending short of their real end time on narrower screens (like an iPad) — a double-digit hour label ("10:00 AM") could wrap onto two lines and silently double that row\'s height, throwing off everything below it.',
                'Adult Temple Interviews: a "With the Stake" recommend that isn\'t expiring for over a year is now dropped from the list entirely, since it doesn\'t need bishopric attention yet.',
              ],
            },
            {
              date: 'Aug 29, 2026',
              items: [
                'Ward Members: callings shown now include stake callings (e.g. High Council, Stake Young Men), not just ward ones — the weekly LCR sync tool now pulls filled callings from LCR\'s Member Callings report instead of just the ward Organizations page.',
              ],
            },
            {
              date: 'Aug 16, 2026',
              items: [
                'Calling Pipeline: added a "7. In release discussion" status, and renumbered the statuses after it to stay sequential integers (8. Need to release, 9. Need to thank at pulpit, 10. Released, 11. Declined). All Callings\' "Consider for release" now sets a calling to "In release discussion" instead of jumping straight to "Need to release", since being considered isn\'t yet a firm decision to release.',
                'Member Needs: "New Need" now defaults "Share with ward council" to checked, since needs added here are usually meant to be prayed for as a council.',
                'Clerk action items: "Record setting apart in LCR" now only appears while a calling is at "6. Set apart" — it no longer keeps showing once the calling has moved into the release track (In release discussion, Need to release, Need to thank at pulpit), since by then setting apart is moot.',
              ],
            },
            {
              date: 'Aug 15, 2026',
              items: [
                'Weekly assignment emails now include a List-Unsubscribe header pointing to the Email Notifications settings page, and growinghomegreens.com now has a DMARC record — both improve inbox deliverability and reduce the chance of these emails landing in spam.',
              ],
            },
            {
              date: 'Aug 10, 2026',
              items: [
                'Fixed the LCR roster sync flagging hub accounts as unmatched when someone\'s account uses their preferred name (e.g. "Jake Jones") but LCR only knows their legal name ("Jacob Jones") — the sync now checks the ward roster\'s preferred-name field too, not just the raw LCR export text.',
              ],
            },
            {
              date: 'Aug 9, 2026',
              items: [
                'Current Bishopric Meeting: added a "Copy from last week" button on the Agenda section, matching the one already on Move-ins/Move-outs/Other Items — copies last week\'s agenda items (and their notes) into this week in one click instead of re-typing them.',
                'Fixed a false "someone else just changed this" error that could appear on Calling Pipeline and Current Sacrament Meeting even when no one else was editing — a rapid second save on the same record could read a stale version and trip the conflict check against the user\'s own prior save.',
                'Fixed deleting a calling from Calling Pipeline sometimes failing outright (with a confusing "someone else changed this" or browser error) when it had a Setting Apart or Calling interview auto-generated for it — those interview rows are just internal bookkeeping the app manages on your behalf, so deleting the calling now removes its linked interview too instead of getting blocked by it.',
                'Current Bishopric Meeting: added a "Copy everything from last week" button that copies Minutes, Notes, Updates/Announcements, Move-ins, Move-outs, Other Items, and Agenda from last week\'s meeting into this week in one click, replacing whatever is currently there. (Interviews Needed isn\'t tied to a specific week, so it carries forward on its own and isn\'t affected.)',
              ],
            },
            {
              date: 'Aug 3, 2026',
              items: [
                'Fixed Sacrament Planning: adding a speaker slot to an upcoming meeting without assigning a name yet would silently disappear on save — the save only kept rows that already had a name typed in. A speaker slot now saves as soon as anything is filled in (type, topic, or accepted status), showing "TBD" for the name until it\'s assigned.',
                'Internal: fixed the action-item mailer marking an assignment as "notified" even when the email itself failed to send, which meant a delivery failure gave up silently instead of retrying — a misconfigured sending address briefly meant a real assignment email never went out and never got another attempt. Failed sends now stay unnotified so the next run tries again.',
                'New bishopric-hub accounts are now automatically registered with Cloudflare as a verified-email destination when created (or when their email address changes) — this is what actually sends them Cloudflare\'s verification email, which nothing did automatically before. The Users page also gets a "Resend" link next to a Pending badge, for anyone who needs another verification email sent.',
              ],
            },
            {
              date: 'Aug 2, 2026',
              items: [
                'New: action-item email notifications. Bishopric leaders now get an email as soon as something new is assigned to them (a calling to approve, an interview to set up, a task, a clerk item — anything that would show up on My Actions), plus a weekly digest of everything still open. Sent from bishopric-hub@growinghomegreens.com; each email says the mailbox isn\'t monitored and links back into the site.',
                'Automation & Notifications: added a "Weekly Assignment Email" setting (admins can change which day/time the digest goes out) and "My Email Notifications" (everyone can opt out of their own emails). A new "Action Item Emails" section shows recent sends and any delivery failures.',
                'Internal: the My Actions matching rules were pulled into a shared module (shared/actionItems.ts) so the new mailer computes exactly the same list of assignments as the My Actions page — no separate copy of the rules to drift out of sync.',
                'Current Bishopric Meeting: "Add to sacrament agenda" for a move-in now phrases it as "We have received the records of the following: [name]." Adding a second move-in the same week appends to that same sentence instead of starting a new one.',
                'Fixed Current Sacrament sometimes saying "Someone else just changed this" (or the added move-in just not showing up) after a move-in was added from the Bishopric Meeting page while the Current Sacrament page was already open. Its fields only ever read the agenda once, at page load, so they never noticed the row had changed underneath them. The page now picks up that kind of outside change automatically, as long as you don\'t have unsaved edits of your own in progress.',
                'Current Bishopric Meeting: clicking "Add to sacrament agenda" on a move-in now shows "✓ Added to agenda" for a couple seconds, since nothing on that page previously indicated whether the click had done anything.',
                'Added a Privacy Policy page, in every hub\'s navigation (Bishopric, Ward Council, Youth Council, and Calendar) — what this tool stores, who can see it, and how to reach the bishop with questions or a removal request. Only lists what each hub itself can actually see.',
                'The weekly assignment email now leads with a highlighted reminder if you have a speaking, prayer, chorister, or organist assignment in this coming Sunday\'s sacrament meeting, ahead of the full list of everything else assigned to you.',
                'Fixed Youth Activities: deleting an event from a single class\'s tab (e.g. Deacons) was deleting that whole date for every class, not just that one. A class\'s tab now has a "Clear" action that only removes that class\'s own activity/time/location for that date. Added the same option to the "All Groups" view — clicking a class\'s cell now offers a "Remove" button alongside Save. The "All Groups" row-level Delete still removes the whole date for every class, as before.',
                'Action-item email notifications are now live. Each bishopric-hub account\'s email address needs to be verified as a Cloudflare destination address once before it can receive mail — most accounts are still pending verification, so only some leaders are receiving mail yet.',
                'Users page: bishopric-hub accounts now show a "✓ Verified" or "⏳ Pending" badge next to their email, so admins can see at a glance who can actually receive assignment emails. Checked against Cloudflare directly; once an address shows verified it\'s remembered and never re-checked. If the check itself fails (for example, the Cloudflare credentials aren\'t set up yet), a message explaining why appears above the user list instead of silently showing everyone as pending.',
              ],
            },
            {
              date: 'Aug 1, 2026',
              items: [
                'All Callings → LCR Callings: fixed the Actions column showing "Tracked" (with no way to act) for any calling that had ever gone through the Calling Pipeline. Because pipeline entries stay at "5. Sustained" after a call is filled, every calling the bishopric had ever filled through the pipeline could never be flagged for release from this page. The column now shows "Release pending" only when that specific calling is genuinely being released, and "Consider for release" is available otherwise.',
                'Consider for release now advances the person\'s existing Calling Pipeline entry to "7. Need to release" instead of creating a second entry for the same person and calling.',
                'My Actions: the "Set up interview" item now stays on your list until the interview actually reaches "Scheduled for Interview" (or later), instead of disappearing as soon as the Setup column said Scheduled. Marking Setup "Done" still clears it. The item now shows the interview status alongside the setup status.',
                'My Actions: names are now matched through the ward roster, so an assignment typed as "First Last", "Last, First", or with a preferred name (e.g. "Rich Barry" vs "Richard Barry") all find the same person.',
                'Calling Pipeline: a member name typed free-hand as "Richard Talbot" (rather than "Talbot, Richard") is now linked to that ward member on save, so the entry is visible to All Callings\' release tracking, the LCR callings sync, and My Actions. Existing entries were linked too, including release entries, which were never linked before.',
                'Automation & Notifications: the LCR Sync History now shows only the 5 most recent runs, with the rest behind a "Show older runs" toggle. Admins get a "Clear older runs" button to delete the archived ones.',
                'LCR sync: the roster sync now checks every bishopric-hub account name against the LCR roster and reports any that don\'t match — a mistyped or outdated account name silently breaks every name-matched assignment for that person. It only reports; nothing is restricted or changed. High councilors are skipped, since they aren\'t on the ward roster.',
                'Data: corrected a misspelled leader surname across 100 records (interview setup assignments, prayer assignments, action items, hub suggestions and edit history). The misspelling meant those assignments never matched the person\'s account, so they never appeared in My Actions.',
              ],
            },
            {
              date: 'Jul 31, 2026',
              items: [
                'Automation & Notifications: the temple recommend line in the LCR sync history now reports how many members actually changed, not how many were matched. It previously showed the same number (everyone on the report) after every run, which made it impossible to tell whether anything had really been updated.',
                'Internal: the recommend sync now skips writing rows whose status and expiration are unchanged, so a routine sync no longer stamps a "last updated" timestamp on every ward member.',
                'Fixed the automatic "Create church record for [baby]" clerk task never being created. The daily job that generates it had a malformed database query and had been failing silently on every run since it was added — the Automation & Notifications page was the only place the error showed. Any babies whose blessing date has already passed and aren\'t yet marked "Church record created" will get their task on the next daily run.',
              ],
            },
            {
              date: 'Jul 29, 2026',
              items: [
                'Ward Members: added a Sustained column showing each person\'s most recent calling date directly in the table, no need to expand the row. Name, Birth Date, Temple Recommend, Gender, Callings, and Sustained column headers are all now individually sortable (click to sort ascending, click again for descending).',
                'Dashboard and Ward Council Dashboard: fixed the Missionaries panel showing empty — it was still filtering on the old missionary status names from before the LCR status vocabulary update. Now shows anyone not yet serving, in the MTC, released, or canceled.',
                'Missionary Pipeline: removed the "Papers Started" status (unused) and fixed the status color legend, which still referenced the old status names.',
                'Internal: fixed a recurring bug where the LCR callings sync could falsely mark someone "released" from a calling they still actively hold, whenever the tracked calling\'s wording didn\'t exactly match LCR\'s own text (e.g. "Nursery" vs LCR\'s "Nursery Worker") — this could happen on every sync run for affected callings, not just once. Cleaned up 16 more falsely-released callings this caused.',
                'Added a new All Callings page: one row per calling LCR reports for the ward (sortable by calling, sustain date, or member name), with a "Consider for release" button on each; and a Members Without a Calling table below it, sortable by name, age, or whether they\'re already in the Calling Pipeline, with an "Add for calling consideration" button that starts a Discussion-stage entry for them.',
                'Ward Members: the Callings and Sustained columns now show only LCR\'s own record for that person, not callings tracked in the Calling Pipeline that haven\'t (yet) shown up in an LCR sync — see the new All Callings page for the pipeline-tracked view.',
                'All Callings: added a Time in Calling column to the LCR Callings table (e.g. "2 yrs 3 mos"), sortable like the rest.',
                'Removed the old manually-maintained "Members Without Callings" list from Calling Pipeline — superseded by All Callings\' auto-derived version.',
                'All Callings: the "In Calling Pipeline?" flag on Members Without a Calling now only reflects being considered for a new calling, not being tracked for release from an existing one.',
                'All Callings: LCR Callings, Members Without a Calling, and Unfilled Callings are now separate tabs on the same page instead of stacked sections.',
                'All Callings: added an Unfilled Callings tab — vacant, non-custom callings LCR reports for the ward, with an "Add to Calling Pipeline" button on each that starts a Discussion-stage entry with no one assigned yet.',
                'Internal: extended the LCR callings sync to also report vacant (non-custom) callings — no UI changes to the sync script beyond what feeds the new Unfilled Callings tab.',
                'All Callings: clicking "Consider for release" on an LCR calling now also starts a second Calling Pipeline entry, "Replacement for {name}", for finding whoever will take over that calling.',
              ],
            },
            {
              date: 'Jul 28, 2026',
              items: [
                'Ward Members: the Callings column and expandable row now show every calling LCR reports for that person, not just the ones tracked in Calling Pipeline. Untracked callings show read-only with a "Consider for release" button that starts tracking them, flagged as needing release.',
                'Ward Members: added a review list for members the LCR roster sync could no longer find — flag them "records elsewhere", remove them from the ward, or dismiss as a false alarm, right from the page.',
                'Internal: LCR sync now only ever updates callings the bishopric already tracks in Calling Pipeline — it no longer auto-creates a row for every filled calling ward-wide (~150+ of them). Also fixed a bug where backfilling a newly-linked calling from old free-text data could falsely mark it "released" if the wording didn\'t exactly match LCR\'s.',
                'Ward Members: members flagged "records elsewhere" are no longer listed as missing from the roster during an LCR sync, since their membership record legitimately lives in another unit.',
              ],
            },
            {
              date: 'Jul 26, 2026',
              items: [
                'Hub Suggestions: added a "Deferred" status, between Planned and Implemented, for suggestions that are on hold for later.',
                'Adult Temple Interviews: added a "With the stake" checkbox for interviews conducted with the stake, with a toggle to hide those from the list.',
                'Youth Council hub: removed the Action Items page from the sidebar — My Actions remains for YC-assigned items.',
                'Bishop Schedule and Counselor Schedule: appointments can now be shared across calendars — check any combination of Bishop/First Counselor/Second Counselor on an appointment, and editing it in one place updates it everywhere it appears.',
                'Current Bishopric Meeting: added five new prep sections — Updates/Announcements (with a "copy from last week" option), a Calendaring Items box showing upcoming events, Move-ins/Move-outs and Other Items lists (move-ins can be added to the sacrament agenda in one click), and an Interviews Needed section pulling in interviews flagged from the Youth/Adult Temple/Other Interviews pages.',
                'Interview list pages (Youth/Adult Temple/Other Interviews): added a flag toggle to mark an interview for discussion at the next bishopric meeting.',
                'Internal: cleaned up the app\'s lint warnings (component structure, effect usage) with no functional changes.',
                'Current Bishopric Meeting: the Calendaring Items box now has a "+ Add" button to create a new calendar event directly from this page, defaulting to the meeting\'s date.',
                'Babies: once a baby\'s blessing date has passed, an Action Item is now automatically created for the clerk to create the church record in LCR (skipped if "Church record created" is already checked).',
                'Internal: added a bulk temple-recommend-status import endpoint (/api/ward-members/import-recommends) to support an automated weekly sync from LCR — no UI changes yet.',
                'Ward Members: fixed a bug where clicking between the two fields of an inline edit (Name, Preferred Name, or Recommend status/expiration) would close the edit before you could finish — editing now only closes when you click fully away from the pair.',
                'Internal: extended the LCR sync with a full roster reconciliation (new members, filling in missing birth date/gender, reporting members absent from the LCR export) and a "with the stake" sync from LCR\'s Recommend Activations report — no UI changes yet.',
              ],
            },
            {
              date: 'Jul 27, 2026',
              items: [
                'Automation & Notifications: added an "LCR Sync History" panel showing every run of the weekly LCR sync script — new members created, details filled in, members missing from the LCR roster, recommends updated, and stake activations flagged/cleared, with unmatched names listed for review.',
                'Ward Members: added a Callings column — click a row to expand it and see/edit each of that member\'s current callings (status, sustained date, set apart) inline.',
                'Missionary Pipeline: replaced the generic mid/late-stage statuses with ones that match the church\'s own missionary tracking stages (Candidate Completing Forms, With the Stake President, With Church Headquarters, Assignment Made, Entered the MTC, Entered the Mission Field, On Leave, Released from Mission Field, Canceled).',
                'Internal: extended the LCR sync with callings (sustained date, set-apart status, auto-recorded releases) and missionary status, matched to ward members by roster link rather than name text so near-miss spellings don\'t create duplicates.',
              ],
            },
            {
              date: 'Jul 25, 2026',
              items: [
                'Current Bishopric Meeting: added a free-form Notes box (auto-grows) alongside the Minutes field for anything that doesn\'t fit the standard meeting fields, stored per meeting.',
                'Dashboard: Opening Prayer, Handbook Topic, Closing Prayer, and Spiritual Thought on the Bishopric Meeting panel can now be edited directly in place — click any value to edit it, no need to visit Bishopric Meeting Planning.',
                'My Actions: fixed a bug where a dual-access account viewing Ward Council could see Bishopric-only action items instead of Ward Council ones. Added a scoped My Actions page (and Action Items) to the Youth Council hub as well, showing only items explicitly shared with Youth Council.',
                'Hub Suggestions: suggestions are now scoped to the hub they were submitted from — Ward Council no longer sees Bishopric\'s suggestions and vice versa.',
              ],
            },
            {
              date: 'Jul 21, 2026',
              items: [
                'Ward Council Discussion Topics: added a General Topics box (10 rows, auto-grows) above the organization table for anything that doesn\'t fit the Status/Next Steps/Help Needed columns. Removed the old "General Topics" row from the table since it\'s now covered by this box.',
              ],
            },
            {
              date: 'Jul 20, 2026',
              items: [
                'Bishop Schedule: new appointments now default to 15 minutes instead of 30, since 15-minute appointments are the more common case.',
                'Bishop Schedule: appointments can now be deleted directly from the calendar grid with a small delete icon that appears on hover, without opening the full editor first.',
                'Youth Interviews: added a toggle to hide interviews that are already "Up to date," so the list can default to showing only those that need attention.',
                'Bishopric Meeting Planning: added a "Jump to month" picker next to the week navigation so future or past meetings don\'t require clicking Next/Previous one month at a time. (All previously entered meetings were safe — this was a display limitation, not data loss.)',
                'Current Sacrament Meeting: the exported agenda page can now be edited directly (click any text) before printing, instead of only reflecting exactly what was saved.',
                'Added Counselor Schedule: First and Second Counselor each get their own appointment calendar, separate from the Bishop Schedule and from each other.',
              ],
            },
            {
              date: 'Jul 19, 2026',
              items: [
                'Bishopric Meeting Planning: adding or editing a meeting now jumps the calendar to its month, so saving a meeting in a different month than the one you\'re viewing no longer looks like it silently failed.',
                'Bishop Schedule: two appointments starting at the exact same time now render side by side instead of stacking fully on top of each other, so the one underneath is no longer hidden and unreachable for editing or deleting.',
                'Bishop Schedule: opening the page on a Saturday now defaults to next week instead of the week that\'s ending, since tomorrow\'s Sunday already belongs to next week.',
                'Bishop Schedule: short (e.g. 15-minute) appointments had a click target so small that a near-miss would silently open a blank New Appointment form instead of editing the one you meant to click. Clicking anywhere in that appointment\'s row now opens it correctly.',
                'Security: the Ward Council hub could see bishopric members\' email addresses and login activity (e.g. on the Ward Council Members page), and the Youth Council hub could see everyone\'s email, role, and login activity across all hubs. Both now only see names and callings for anyone outside their own hub.',
                'Bishopric/dual-access accounts switching to the Ward Council or Youth Council hub view no longer see bishopric data leak through: the Youth Council view is now fully scoped to youth-only pages, and My Actions on the Ward Council view no longer lists bishopric-only items (calling pipeline, interviews, clerk follow-ups, rotating assignments).',
                'Fixed: My Actions never generated a "Record release in LCR" item for the ward clerk, even when someone was fully Released and not yet recorded — Calling Pipeline tracks a release as its own pipeline entry (separate from the original calling), and the clerk check was accidentally skipping every one of those entries.',
                'Calling Pipeline: deleting an entry (or a Member Without a Calling) now asks for confirmation first instead of deleting immediately on click.',
              ],
            },
            {
              date: 'Jul 13, 2026',
              items: [
                'Fixed: editing an adult\'s "Recommend Expires" directly on their Adult Temple Interviews row didn\'t update Ward Members, so the next resync could re-stamp the old date back onto the interview. Editing it from either place now keeps both in sync, matching how youth interviews already worked.',
              ],
            },
            {
              date: 'Jul 12, 2026',
              items: [
                'Fixed: editing a temple recommend expiration date for an adult on Ward Members wasn\'t reaching their existing Adult Temple Interviews row — a resync now keeps that date current instead of leaving the old one in place.',
                'Adult Temple Interviews: a member who receives a new recommend that pushes their expiration date beyond the usual 2-month window is now removed from the list on resync, since they no longer need an interview soon.',
                'Adult Temple Interviews: resync now also removes anyone from the list whose recommend type/date was cleared, who went inactive, or who aged into the youth interview track — not just those who renewed past the window.',
              ],
            },
            {
              date: 'Jul 11, 2026 (13)',
              items: [
                'Temple recommend interviews: deleting an auto-created interview row now sticks — it won\'t be recreated by a resync (manual or automatic) unless the member\'s recommend date changes to a new date that\'s within the usual 2-month window.',
              ],
            },
            {
              date: 'Jul 11, 2026 (12)',
              items: [
                'My Actions now only lists calling pipeline items in "Approved and assigned" or "Need to release" status for the assigned person, instead of every non-released/declined calling.',
              ],
            },
            {
              date: 'Jul 11, 2026 (11)',
              items: [
                'The app\'s title is now configurable — set a Ward Name under Automation & Notifications and the login page/sidebar show "<Ward Name> Ward Leadership Hub" instead of a fixed "Bishopric Hub".',
                'Guest accounts (the youth and sacrament read-only logins) no longer appear on the Users page and can\'t be deleted — they\'re login shortcuts, not real people.',
              ],
            },
            {
              date: 'Jul 11, 2026 (10)',
              items: [
                'Only one user account can hold the Bishop calling, and likewise for First Counselor and Second Counselor — assigning one of these to a new person is blocked until the previous holder\'s calling is changed first.',
                'Sacrament meeting Presiding now defaults to "Bishop [Lastname]" for every future meeting. Assigning a new Bishop immediately updates Presiding on all future meetings to the new Bishop\'s name.',
              ],
            },
            {
              date: 'Jul 11, 2026 (9)',
              items: [
                'Action Items are now scoped per hub: the Bishopric list only shows Bishopric items, the Ward Council list only shows Ward Council items, and a new Youth Council Action Items page (and list) shows only Youth Council items — no more seeing every hub\'s items mixed together.',
              ],
            },
            {
              date: 'Jul 11, 2026 (8)',
              items: [
                'Ward Members: added a Temple Recommend field (type — Endowed or Limited-use — and expiration date). Removed the separate Unendowed Temple Rec interview category.',
                'When a member\'s temple recommend expires within 2 months (or has already expired), they\'re now added to Adult Temple Interviews automatically, unassigned — no duplicate entry is created if one already exists.',
              ],
            },
            {
              date: 'Jul 11, 2026 (7)',
              items: [
                'Missionary Pipeline: added a "Papers with Stake" status between Papers Started and Papers Submitted.',
                'Removed the Annual category from Adult Temple Interviews (it wasn\'t in use).',
                'Setting Apart interviews now use their own simpler status list (Unassigned, Assigned, Scheduled, Complete) and show the linked calling. Marking one Complete automatically moves that calling to "Set apart" status.',
                'Youth Interviews: removed the redundant 12-15/16-17 labels from the Last/Next Interview columns — age is already shown in its own column.',
              ],
            },
            {
              date: 'Jul 11, 2026 (6)',
              items: [
                'Ordinances: each December, young men who will turn 12, 14, or 16 next year (Deacon, Teacher, or Priest) are now added to the tracker automatically, a month ahead of the new year (in addition to the existing "suggested this year" box).',
                'Interview setup assignment can now be given to the executive secretary or an assistant executive secretary, not just the bishop and counselors — who actually conducts the interview is unaffected.',
              ],
            },
            {
              date: 'Jul 11, 2026 (5)',
              items: [
                'Ward Members: split the single Name field into separate First Name and Last Name fields, plus separate Preferred First Name and Preferred Last Name fields (previously one combined Preferred Name field). Existing preferred names were carried over automatically; anyone without one had it filled in from their legal name.',
                'Speakers & Prayers counting now matches history entries to the roster using fuzzy name matching (case-insensitive, either name order, legal or preferred name) instead of requiring an exact text match — some previously-uncounted entries (typos, nicknames, name-order differences) will now show up, so counts may increase slightly for some people.',
                'CSV import, the youth-interview auto-sync, and the interview pages were all updated to work with the new first/last name fields.',
              ],
            },
            {
              date: 'Jul 11, 2026 (4)',
              items: [
                'My Actions: added clerk-only reminders to record sustainings, settings apart, releases, and baby church records in LCR — these show regardless of who a calling or baby is otherwise assigned to, and disappear once checked off on Calling Pipeline / Babies.',
                'Calling Pipeline: added a "Release recorded in LCR" checkbox alongside the existing sustain/setting-apart ones.',
                'Babies: added a "Church record created (LCR)" checkbox; checking it while a baby is Blessed also advances their status to Recorded.',
                'Dashboard: babies still Expecting (due within about a month) now also appear in the Upcoming Events panel.',
              ],
            },
            {
              date: 'Jul 11, 2026 (3)',
              items: [
                'Interview Pipeline is now three pages — Youth Interviews, Adult Temple Interviews, and Other Interviews — so each is easier to scan; every category always shows, even with nothing pending, so it\'s clear what\'s covered. The old Interview Pipeline link redirects to Youth Interviews.',
                'Interviews now have two separate assignments: an Interviewer (conducts the interview) and a Setup assignment (schedules it, with its own Not started/Contacted/Scheduled/Done status, settable individually or in bulk). Only the setup assignment shows up on My Actions going forward — the interview itself is no longer a separate reminder there.',
                'Fixed: bulk "Set status" could be applied to youth interviews even though their status is computed automatically, not set by hand — it now skips those rows and tells you how many were skipped.',
                'Edit Interview: swapped the field order so Last Interview Date comes before Next Interview Date.',
                'Added Post-Mission and Setting Apart interview types. Setting Apart entries are now created automatically (unassigned) once a calling reaches Sustained, and removed once its setting apart is recorded in LCR or the calling is deleted.',
                'The Rec. Expires field/column no longer shows for interview types where it doesn\'t apply (patriarchal blessing referrals, mission prep, setting apart, other) — it still always treats a recommend as expiring on the last day of its stated month.',
              ],
            },
            {
              date: 'Jul 11, 2026 (2)',
              items: [
                'Renamed "Bishopric Meetings" to "Bishopric Meeting Planning" (scheduling, recurring series, minutes — unchanged) and added a new "Current Bishopric Meeting" page for actually running the next meeting: agenda items you can add, check off, reorder, and attach notes to, plus quick editing of that meeting\'s own fields, all in one place.',
              ],
            },
            {
              date: 'Jul 11, 2026',
              items: [
                'Sacrament Program (the read-only page shown to the sacrament guest account) now follows the order used in the Church handbook: Presiding, Conducting, Chorister, Organist, Opening Hymn, Opening Prayer, Ward and Stake Business, Sacrament Hymn, Administration of the Sacrament, Speakers (interleaved with any intermediate musical number), Closing Hymn, Closing Prayer. Prayer names are now shown; Ward and Stake Business and Administration of the Sacrament appear as headings only, with no details.',
                'Fixed: the youth guest account could reach the Youth Council Meetings page, which was never meant to be part of its view — it now only sees the Youth Calendar.',
                'Fixed: Ward Council members can now open Youth Council Meetings (read-only) — previously it redirected them to the Ward Council dashboard instead.',
                'Ward Members: "Deactivate"/"Reactivate" are now called "Remove from ward"/"Add back to ward", and the status badge reads "In Ward"/"Removed" — same behavior, clearer wording.',
                'Ward Members: added an "Out of ward" flag for someone who attends the ward but whose membership record is in another ward. It\'s an informational badge only and doesn\'t change how that person is treated anywhere else in the app.',
                'Ward Members: relabeled the "out of ward" toggle to "Flag: records elsewhere" (was confusingly similar to "Remove from ward") and added hover tooltips explaining what each button actually does.',
                'Youth Interviews: the temple recommend expiration date entered on a youth\'s interview now stays in sync with their Temple Recommend field on Ward Members, in both directions.',
                'Adult Temple Interviews: added a "Sync now" button to immediately check for recommends expiring within 2 months and add them to the list, instead of waiting for the once-a-day automatic check.',
                'Backfilled every youth\'s Temple Recommend field on Ward Members from their existing Youth Interview recommend expiration date.',
                'Temple recommend expiration is now month/year only (recommends expire at month\'s end, so the exact day never mattered) — on Ward Members and on Youth/Adult Temple Interviews alike. Cleaned up previously stored dates to match.',
                'Fixed: the daily/manual temple-recommend sync was mistakenly adding current youth to the Adult Temple Interviews list as duplicate entries — it now only ever applies to adults; youth stay tracked solely on their Youth Interview row.',
                'Ward Members: removed the Temple Recommend column from the Children section — children don\'t hold recommends.',
                'Interviews: "Setup" can now be assigned directly from the list with one click (a dropdown right in the row) — no need to open the interview to set who\'s scheduling it.',
                'Setting Apart interviews now show a single "Scheduled Date" instead of separate Last/Next Interview fields, since a setting apart only happens once.',
                'Other Interviews: "Calling" entries are now created automatically once a calling reaches "Approved and assigned," assigned to whoever is assigned on that calling — kept in sync if reassigned, and removed once the calling moves on.',
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
];

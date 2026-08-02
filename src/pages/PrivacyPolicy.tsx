import { useAppTitle } from '../lib/wardName';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold text-gray-800">{title}</h2>
      <div className="text-sm text-gray-700 space-y-2 leading-relaxed">{children}</div>
    </section>
  );
}

export default function PrivacyPolicy() {
  const appTitle = useAppTitle();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Privacy Policy</h1>
        <p className="text-sm text-gray-500">{appTitle} — last updated Aug 2, 2026</p>
      </div>

      <Section title="What this is">
        <p>
          {appTitle} is an internal tool used by this ward's leadership — the bishopric, ward council, and youth
          council — to organize callings, interviews, sacrament meetings, ministering, and related record-keeping.
          It is not a public website: every page requires a login, and it isn't indexed by search engines or
          connected to any social media or advertising service.
        </p>
      </Section>

      <Section title="Who can see what">
        <p>
          Access is split into separate hubs (Bishopric, Ward Council, Youth Council). An account only sees the
          data for the hub(s) it's assigned to — for example, a Ward Council account cannot see calling or
          interview records, which are visible only to the bishopric. Within a hub, only signed-in accounts
          created for that ward's leaders can view anything; there is no public or guest access to member data.
        </p>
      </Section>

      <Section title="Information this tool stores">
        <p>Two categories of information are stored, both tied to running this ward:</p>
        <p className="font-medium">About ward members:</p>
        <ul className="list-disc list-inside space-y-1 pl-1">
          <li>Name, birth date, and gender, synced periodically from the Church's own membership records (LCR)</li>
          <li>Current and past callings, and temple recommend status/expiration</li>
          <li>Interview scheduling and completion status (temple recommend, youth, calling, and other interviews)</li>
          <li>Missionary service status, for members currently serving</li>
          <li>Move-in and move-out records, sacrament meeting assignments (speaking, prayers, music), and notes
            leaders enter about ministering or member needs</li>
        </ul>
        <p className="font-medium">About leaders using the tool:</p>
        <ul className="list-disc list-inside space-y-1 pl-1">
          <li>Name and email address, and a securely hashed password (never stored in plain text)</li>
          <li>Login history and IP address, kept briefly to block repeated failed login attempts</li>
        </ul>
      </Section>

      <Section title="How it's used">
        <p>
          This information exists to help the bishopric and ward council carry out their assigned
          responsibilities — filling and tracking callings, scheduling interviews, planning meetings, and looking
          after members' needs. It is not used for advertising, sold, or shared with any organization outside the
          Church, and nothing here is analyzed or used for purposes beyond that.
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

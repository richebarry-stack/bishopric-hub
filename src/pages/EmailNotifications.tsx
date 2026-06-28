export default function EmailNotifications() {
  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Email Notifications</h1>
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-amber-800 space-y-2">
        <p className="font-semibold">Not yet enabled</p>
        <p className="text-sm">
          Email notifications are a planned feature. When enabled, the hub will be able to send
          reminders for pending action items, spiritual thought assignments, and handbook topics.
          This requires a custom domain and email provider to activate.
        </p>
      </div>
    </div>
  );
}

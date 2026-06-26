interface StatusBadgeProps {
  status: string;
  colors?: Record<string, { bg: string; text: string }>;
}

export default function StatusBadge({ status, colors }: StatusBadgeProps) {
  const color = colors?.[status] || { bg: 'bg-gray-100', text: 'text-gray-700' };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${color.bg} ${color.text}`}>
      {status}
    </span>
  );
}

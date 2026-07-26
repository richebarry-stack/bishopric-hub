import ScheduleCalendar from './ScheduleCalendar';

export default function BishopSchedule() {
  return (
    <ScheduleCalendar
      availableCalendars={['Bishop']}
      title="Bishop Schedule"
      subtitle="The bishop's individual appointments, separate from bishopric meetings."
    />
  );
}

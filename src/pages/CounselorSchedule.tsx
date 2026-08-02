import ScheduleCalendar from './ScheduleCalendar';

export default function CounselorSchedule() {
  return (
    <ScheduleCalendar
      availableCalendars={['First Counselor', 'Second Counselor']}
      title="Counselor Schedule"
      subtitle="Individual appointments for each counselor, separate from the bishop's schedule."
    />
  );
}

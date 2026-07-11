import InterviewsPage from '../components/interviews/InterviewsPage';
import { OTHER_TYPES } from '../components/interviews/shared';

export default function OtherInterviews() {
  return (
    <InterviewsPage
      title="Other Interviews"
      description="Calling interviews, setting apart, patriarchal blessing referrals, mission prep, and everything else — who's assigned to conduct or set up each one."
      types={[...OTHER_TYPES]}
      showRecExpires={false}
    />
  );
}

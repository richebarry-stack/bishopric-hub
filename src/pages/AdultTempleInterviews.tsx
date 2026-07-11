import InterviewsPage from '../components/interviews/InterviewsPage';
import { TEMPLE_TYPES } from '../components/interviews/shared';

export default function AdultTempleInterviews() {
  return (
    <InterviewsPage
      title="Adult Temple Interviews"
      description="Temple recommend interviews for adult members — who's due, who's coming due, and who's assigned to conduct or set up each interview."
      types={[...TEMPLE_TYPES]}
      showRecExpires
    />
  );
}

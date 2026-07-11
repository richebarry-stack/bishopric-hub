import InterviewsPage from '../components/interviews/InterviewsPage';
import { TEMPLE_TYPES } from '../components/interviews/shared';

export default function AdultTempleInterviews() {
  return (
    <InterviewsPage
      title="Adult Temple Interviews"
      description="Temple recommend interviews for adult members — Endowed and Limited-use recommends. Anyone with a recommend expiring within 2 months is added here automatically (set recommend type/expiration on Ward Members)."
      types={[...TEMPLE_TYPES]}
      showRecExpires
    />
  );
}

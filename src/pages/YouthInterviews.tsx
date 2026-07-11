import InterviewsPage from '../components/interviews/InterviewsPage';
import { YOUTH_TYPES } from '../components/interviews/shared';

export default function YouthInterviews() {
  return (
    <InterviewsPage
      title="Youth Interviews"
      description="Every youth (ages 12–17) is interviewed every 6 months: for ages 12–15, alternate between the bishop and the counselor over that youth's quorum/class; for ages 16–17, both interviews should be with the bishop himself, if possible. Kept in sync with the ward roster automatically — status is computed from the interview dates rather than set by hand."
      types={[...YOUTH_TYPES]}
      showAge
      showRecExpires
      mergedSectionLabel="Youth Interviews"
    />
  );
}

import { useCallback, useEffect, useState } from 'react';
import type { CouncilAgendaEntry, CovenantAgendaEntry } from '../../shared/covenantPath';

/**
 * People picked on the Covenant Path page for upcoming meetings. The server drops
 * entries once the person is off that list, so this is always the current agenda.
 * Ward council users get only name, neutral topic and note.
 */
export function useCovenantAgenda<T extends CovenantAgendaEntry | CouncilAgendaEntry>() {
  const [entries, setEntries] = useState<T[]>([]);
  const [loaded, setLoaded] = useState(false);
  const reload = useCallback(async () => {
    try {
      const res = await fetch('/api/covenant-path-agenda/active');
      if (res.ok) setEntries(await res.json() as T[]);
    } finally {
      setLoaded(true);
    }
  }, []);
  useEffect(() => { reload(); }, [reload]);
  return { entries, loaded, reload };
}


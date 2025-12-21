import { useEffect } from 'react';
import { supabase } from '../config/supabaseClient';

export const useRealtimeMatches = (
  userId: string | null | undefined,
  onNewMatch: (match: any) => void,
) => {
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('matches-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'matches',
        },
        (payload) => {
          const match = payload.new as any;
          if (match.user1_id === userId || match.user2_id === userId) {
            onNewMatch(match);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, onNewMatch]);
};

import { useEffect } from 'react';
import { supabase } from '../config/supabaseClient';

export const useRealtimeMessages = (
  onNewMessage: (message: any) => void,
) => {
  useEffect(() => {
    const channel = supabase
      .channel('messages-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const message = payload.new as any;
          onNewMessage(message);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onNewMessage]);
};

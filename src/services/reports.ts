import { supabase } from '../config/supabaseClient';

export type ReportReason =
  | 'harassment'
  | 'spam'
  | 'fake_profile'
  | 'inappropriate_content'
  | 'scam'
  | 'other';

export interface Report {
  id: string;
  reporter_id: string;
  reported_user_id: string | null;
  reported_message_id: string | null;
  reason: ReportReason;
  description: string | null;
  created_at: string;
}

export const submitReport = async (
  reporterId: string,
  reportedUserId: string | null,
  reportedMessageId: string | null,
  reason: ReportReason,
  description?: string,
): Promise<Report> => {
  const { data, error } = await supabase
    .from('reports')
    .insert({
      reporter_id: reporterId,
      reported_user_id: reportedUserId,
      reported_message_id: reportedMessageId,
      reason,
      description: description || null,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as Report;
};


export type NotificationType =
  | 'proposal_submitted'
  | 'proposal_approved'
  | 'proposal_rejected'
  | 'sme_assigned'
  | 'sme_removed'
  | 'stream_deleted';

export interface Notification {
  id: number;
  recipient_email: string;
  type: NotificationType;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

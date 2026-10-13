export type ExistingPushRegistration = {
  user_id: string;
  p256dh: string;
  auth: string;
  failure_count: number | null;
  unacked_count: number | null;
  last_success_at: string | null;
  last_ack_at: string | null;
};

export function registrationLiveness(
  existing: ExistingPushRegistration | null,
  userId: string,
  p256dh: string,
  auth: string,
) {
  const identityChanged =
    !existing || existing.user_id !== userId || existing.p256dh !== p256dh || existing.auth !== auth;

  return {
    identityChanged,
    failure_count: identityChanged ? 0 : (existing.failure_count ?? 0),
    unacked_count: identityChanged ? 0 : (existing.unacked_count ?? 0),
    last_success_at: identityChanged ? null : (existing.last_success_at ?? null),
    last_ack_at: identityChanged ? null : (existing.last_ack_at ?? null),
  };
}

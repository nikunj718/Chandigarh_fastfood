export function isVerifiedUser(user: { email?: string | null; email_confirmed_at?: string | null; is_anonymous?: boolean }) {
  return !user.is_anonymous && Boolean(user.email && user.email_confirmed_at);
}

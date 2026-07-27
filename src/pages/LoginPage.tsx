import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { api, getUserMessage, setAccessToken, setRefreshToken } from '../lib/api';
import { useUser } from '../context/UserContext';
import type { AuthResponse, AppUser, Invitation } from '../lib/types';
import { AppleMark, BrandMark, GoogleMark } from '../components/ui-kit';
import { PRIVACY_URL, TERMS_URL } from '../lib/legalLinks';
import { getSocialIdentity, getSocialProviders, type SocialProvider } from '../lib/socialAuth';

export default function LoginPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { setCurrentUser } = useUser();

  const [error, setError] = useState('');
  const [waking, setWaking] = useState(false);
  const [socialLoading, setSocialLoading] = useState<SocialProvider | null>(null);
  const socialProviders = getSocialProviders();

  const tryJoinFromInvitation = async (user: AppUser) => {
    if (user.collectiveCode) return user;

    const invites = await api.get<Invitation[]>(`/invitations?email=${encodeURIComponent(user.email)}`);
    const pending = invites.find((invite) => !invite.accepted);
    if (!pending) return user;

    const joined = await api.post<AppUser>('/onboarding/collectives/join', {
      userId: user.id,
      joinCode: pending.collectiveCode,
    });
    return joined;
  };

  const completeAuth = async (res: AuthResponse) => {
    await Promise.all([setAccessToken(res.accessToken), setRefreshToken(res.refreshToken)]);
    // Auto-joining a pending invitation is a convenience, not part of signing in. Letting it
    // throw here used to abandon an already-successful login before setCurrentUser/navigate ran,
    // stranding the user on this screen with an error while their tokens were already stored —
    // and it ran for everyone without a collective, i.e. every freshly registered account.
    let user = res.user;
    try {
      user = await tryJoinFromInvitation(res.user);
    } catch {
      // Fall through with the signed-in user; they can join from the household screen instead.
    }
    setCurrentUser(user);
    navigate(user.collectiveCode ? '/' : '/create-household', { replace: true });
  };

  // Signing up and signing in are the same call: the backend links the social identity to an
  // existing member by email and creates one otherwise, so this screen needs no separate register.
  const handleSocialLogin = async (provider: SocialProvider) => {
    setError('');
    setSocialLoading(provider);
    const slowTimer = setTimeout(() => setWaking(true), 4000);
    try {
      const identity = await getSocialIdentity(provider);
      const res = await api.post<AuthResponse>(`/onboarding/oauth/${provider}`, identity);
      await completeAuth(res);
    } catch (err: unknown) {
      setError(getUserMessage(err, t('errors.generic')));
    } finally {
      clearTimeout(slowTimer);
      setWaking(false);
      setSocialLoading(null);
    }
  };

  const busy = socialLoading !== null;

  return (
    <div className="app-viewport bg-background flex flex-col px-6 safe-top safe-bottom">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto flex w-full max-w-sm flex-1 flex-col"
      >
        {/* items-center would size each child to its content, which stops the long headline from
            wrapping and overflows the viewport — hence w-full on everything textual below. */}
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <BrandMark className="h-14 w-14 text-primary" />
          <p className="mt-3 font-display text-2xl font-extrabold tracking-[-.03em]">{t('app.name')}</p>

          {/* No .mark highlighter here: at display-xl's tight leading the bar covers the lower half
              of the glyphs, and dark text on the indigo wash is hard to read. The reference is
              plain type anyway. */}
          <h1 className="mt-9 w-full text-balance display-xl">
            {t('auth.headingLead')} {t('auth.headingMark')}
          </h1>
          <p className="mt-4 w-full font-display text-xl font-extrabold tracking-[-.02em]">
            {t('auth.tagline')}
          </p>
          <p className="mt-1.5 w-full text-[0.7rem] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            {t('auth.taglineSub')}
          </p>
        </div>

        <div className="w-full space-y-3 pb-6">
          {error && <p className="text-center text-sm text-destructive">{error}</p>}
          {waking && !error && (
            <p className="text-center text-sm text-muted-foreground">{t('auth.wakingServer')}</p>
          )}

          {socialProviders.length === 0 ? (
            // With email/password gone, no configured provider means there is no way into the app
            // at all. Say so plainly instead of rendering a screen with no way forward.
            <p className="text-center text-sm text-destructive">{t('auth.noProviders')}</p>
          ) : (
            socialProviders.map((provider) => (
              <button
                key={provider}
                type="button"
                disabled={busy}
                onClick={() => void handleSocialLogin(provider)}
                className={`w-full font-bold disabled:opacity-60 ${
                  // Apple's guidelines want a black button on a light background and a white one on
                  // dark — which is exactly the theme's foreground/background pair, inverted.
                  provider === 'apple' ? 'btn-pine !bg-foreground !text-background' : 'btn-ghost'
                }`}
              >
                {socialLoading === provider ? (
                  t('auth.pleaseWait')
                ) : (
                  <>
                    {provider === 'apple' ? <AppleMark className="h-5 w-5" /> : <GoogleMark className="h-5 w-5" />}
                    {t(`auth.continueWith_${provider}`)}
                  </>
                )}
              </button>
            ))
          )}

          <p className="px-2 pt-1 text-center text-xs leading-relaxed text-muted-foreground">
            {t('auth.terms.prefix')}{' '}
            <a href={TERMS_URL} target="_blank" rel="noreferrer" className="font-bold text-primary underline-offset-2 hover:underline dark:text-secondary">
              {t('auth.terms.terms')}
            </a>{' '}
            {t('auth.terms.and')}{' '}
            <a href={PRIVACY_URL} target="_blank" rel="noreferrer" className="font-bold text-primary underline-offset-2 hover:underline dark:text-secondary">
              {t('auth.terms.privacy')}
            </a>
            .
          </p>
        </div>
      </motion.div>
    </div>
  );
}

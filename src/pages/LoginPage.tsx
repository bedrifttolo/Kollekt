import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { api, getUserMessage, setAccessToken, setRefreshToken } from '../lib/api';
import { useUser } from '../context/UserContext';
import type { AuthResponse, AppUser, Invitation } from '../lib/types';
import { BrandMark, Field } from '../components/ui-kit';
import { getSocialIdentity, getSocialProviders, type SocialProvider } from '../lib/socialAuth';

type Mode = 'login' | 'register' | 'forgot';

export default function LoginPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { setCurrentUser } = useUser();

  const [mode, setMode] = useState<Mode>('login');
  const [loginName, setLoginName] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<SocialProvider | null>(null);
  const socialProviders = getSocialProviders();

  const switchMode = (next: Mode) => {
    setMode(next);
    setError('');
    setForgotSent(false);
  };

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
    const userWithInvite = await tryJoinFromInvitation(res.user);
    setCurrentUser(userWithInvite);
    navigate(userWithInvite.collectiveCode ? '/' : '/create-household', { replace: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        const res = await api.post<AuthResponse>('/onboarding/login', { name: loginName, password });
        await completeAuth(res);
      } else if (mode === 'register') {
        const res = await api.post<AuthResponse>('/onboarding/users', { name, email, password });
        await completeAuth(res);
      } else {
        await api.post('/onboarding/password-reset/request', { email: forgotEmail });
        setForgotSent(true);
      }
    } catch (err: unknown) {
      setError(getUserMessage(err, t('errors.generic')));
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: SocialProvider) => {
    setError('');
    setSocialLoading(provider);
    try {
      const identity = await getSocialIdentity(provider);
      const res = await api.post<AuthResponse>(`/onboarding/oauth/${provider}`, identity);
      await completeAuth(res);
    } catch (err: unknown) {
      setError(getUserMessage(err, t('errors.generic')));
    } finally {
      setSocialLoading(null);
    }
  };

  const isForgot = mode === 'forgot';

  return (
    <div className="app-viewport bg-background flex flex-col px-6 safe-top safe-bottom">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm mx-auto flex flex-1 flex-col pt-8"
      >
        <div className="flex items-center gap-2.5">
          <BrandMark className="h-7 w-7 text-primary dark:text-foreground" />
          <span className="font-display text-2xl font-extrabold text-primary dark:text-secondary">Kollekt</span>
        </div>

        <div className="mt-7">
          <h1 className="font-display text-[2.75rem] leading-[.96] font-extrabold tracking-[-.05em]">
            {isForgot ? (
              <>{t('auth.forgot.headingLead')} <span className="mark">{t('auth.forgot.headingMark')}</span></>
            ) : (
              <>{t('auth.headingLead')} <span className="mark">{t('auth.headingMark')}</span></>
            )}
          </h1>
          <p className="mt-3 text-base text-muted-foreground">
            {isForgot ? t('auth.forgot.subtitle') : t('auth.tagline')}
          </p>
        </div>

        {!isForgot && (
          <div className="seg mt-6">
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className={`flex-1 py-2.5 rounded-[.85rem] text-sm font-bold transition-all ${
                  mode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                }`}
              >
                {m === 'login' ? t('auth.loginTab') : t('auth.signUpTab')}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          {mode === 'register' && (
            <Field
              label={t('auth.labels.name')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('auth.placeholders.name')}
              autoComplete="name"
              required
            />
          )}

          {mode === 'login' && (
            <Field
              label={t('auth.labels.email')}
              value={loginName}
              onChange={(e) => setLoginName(e.target.value)}
              placeholder={t('auth.placeholders.email')}
              autoComplete="username"
              required
            />
          )}

          {mode === 'register' && (
            <Field
              label={t('auth.labels.email')}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth.placeholders.email')}
              autoComplete="email"
              required
            />
          )}

          {isForgot && (
            <Field
              label={t('auth.labels.email')}
              type="email"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              placeholder={t('auth.placeholders.email')}
              autoComplete="email"
              required
            />
          )}

          {!isForgot && (
            <Field
              label={t('auth.labels.password')}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'register' ? t('auth.placeholders.newPassword') : t('auth.placeholders.password')}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              required
              {...(mode === 'register' ? { minLength: 8 } : {})}
            />
          )}

          {mode === 'login' && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => switchMode('forgot')}
                className="text-sm font-bold text-primary dark:text-secondary"
              >
                {t('auth.forgotPassword')}
              </button>
            </div>
          )}

          {forgotSent && (
            <p className="text-sm text-primary dark:text-secondary text-center">{t('auth.forgot.sent')}</p>
          )}

          {error && <p className="text-sm text-destructive text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className={`w-full font-bold disabled:opacity-60 ${mode === 'register' ? 'btn-lemon' : 'btn-pine'}`}
          >
            {loading
              ? t('auth.pleaseWait')
              : isForgot
                ? t('auth.forgot.submit')
                : mode === 'login'
                  ? t('auth.logIn')
                  : t('auth.createAccount')}
          </button>
        </form>

        {mode === 'login' && socialProviders.length > 0 && (
          <div className="mt-5 space-y-3">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              {t('auth.continueWith')}
              <span className="h-px flex-1 bg-border" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {socialProviders.map((provider) => (
                <button
                  key={provider}
                  type="button"
                  disabled={socialLoading !== null}
                  onClick={() => void handleSocialLogin(provider)}
                  className="btn-ghost font-bold disabled:opacity-60"
                >
                  {socialLoading === provider ? t('auth.pleaseWait') : t(`auth.${provider}`)}
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === 'register' && (
          <p className="mt-5 text-center text-sm text-muted-foreground">
            {t('auth.terms.prefix')}{' '}
            <span className="font-bold text-primary dark:text-secondary">{t('auth.terms.link')}</span>.
          </p>
        )}

        {isForgot && (
          <button
            type="button"
            onClick={() => switchMode('login')}
            className="mt-5 text-center text-sm font-bold text-muted-foreground"
          >
            {t('auth.forgot.backToLogin')}
          </button>
        )}

        <p className="mt-auto pt-8 pb-2 text-center text-sm text-muted-foreground">{t('auth.buildLabel')}</p>
      </motion.div>
    </div>
  );
}

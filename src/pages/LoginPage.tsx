import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { api, getUserMessage, setAccessToken, setRefreshToken } from '../lib/api';
import { useUser } from '../context/UserContext';
import type { AuthResponse, AppUser, Invitation } from '../lib/types';
import { BrandMark } from '../components/ui-kit';
import { getSocialIdentity, getSocialProviders, type SocialProvider } from '../lib/socialAuth';

export default function LoginPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { setCurrentUser } = useUser();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [loginName, setLoginName] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const res = await api.post<AuthResponse>('/onboarding/login', { name: loginName, password });
        await Promise.all([
          setAccessToken(res.accessToken),
          setRefreshToken(res.refreshToken),
        ]);
        const userWithInvite = await tryJoinFromInvitation(res.user);
        setCurrentUser(userWithInvite);
        navigate(userWithInvite.collectiveCode ? '/' : '/create-household', { replace: true });

      } else if (mode === 'register') {
        const res = await api.post<AuthResponse>('/onboarding/users', { name, email, password });
        await Promise.all([
          setAccessToken(res.accessToken),
          setRefreshToken(res.refreshToken),
        ]);
        const userWithInvite = await tryJoinFromInvitation(res.user);
        setCurrentUser(userWithInvite);
        navigate(userWithInvite.collectiveCode ? '/' : '/create-household', { replace: true });

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
      await Promise.all([setAccessToken(res.accessToken), setRefreshToken(res.refreshToken)]);
      const userWithInvite = await tryJoinFromInvitation(res.user);
      setCurrentUser(userWithInvite);
      navigate(userWithInvite.collectiveCode ? '/' : '/create-household', { replace: true });
    } catch (err: unknown) {
      setError(getUserMessage(err, t('errors.generic')));
    } finally {
      setSocialLoading(null);
    }
  };

  return (
    <div className="relative app-viewport bg-background flex flex-col items-center justify-center px-6 safe-top safe-bottom overflow-hidden">
      <div className="absolute -top-24 -right-20 h-72 w-72 rounded-full bg-secondary/30 blur-3xl" />
      <div className="absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-accent/25 blur-3xl" />
      <div className="absolute top-4 right-4 z-10">
        <LanguageSwitcher />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-sm space-y-6"
      >
        <div className="flex items-center gap-3 text-primary">
          <BrandMark className="h-7 w-7" />
          <span className="font-display text-2xl font-extrabold">Kollekt</span>
        </div>

        <div>
          <h1 className="font-display text-[2.75rem] leading-[.96] font-extrabold tracking-[-.05em]">
            {mode === 'login' ? <>Welcome <span className="mark">home.</span></> : <>Find your <span className="mark">people.</span></>}
          </h1>
          <p className="text-base text-muted-foreground mt-3">{t('app.tagline')}</p>
        </div>

        <div className="seg">
          {(['login', 'register'] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(''); }}
              className={`flex-1 py-2.5 rounded-[.85rem] text-sm font-bold transition-all ${
                mode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
              }`}
            >
              {m === 'login' ? t('auth.loginTab') : t('auth.signUpTab')}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <AnimatePresence mode="wait">
            <motion.div
              key="auth"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              {mode === 'register' && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                  <div className="field flex items-center gap-3">
                    <User className="h-4 w-4 text-muted-foreground shrink-0" />
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t('auth.fullName')}
                      className="w-full bg-transparent py-3 text-sm placeholder:text-muted-foreground focus:outline-none"
                      required
                    />
                  </div>
                </motion.div>
              )}

              {mode === 'login' ? (
                <div className="field flex items-center gap-3">
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                  <input
                    type="text"
                    value={loginName}
                    onChange={(e) => setLoginName(e.target.value)}
                    placeholder={t('auth.identifier')}
                    className="w-full bg-transparent py-3 text-sm placeholder:text-muted-foreground focus:outline-none"
                    required
                  />
                </div>
              ) : (
                <div className="field flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('auth.emailAddress')}
                    className="w-full bg-transparent py-3 text-sm placeholder:text-muted-foreground focus:outline-none"
                    required
                  />
                </div>
              )}

              <div className="field flex items-center gap-3">
                <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('auth.password')}
                  className="w-full bg-transparent py-3 text-sm placeholder:text-muted-foreground focus:outline-none"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                >
                  {showPassword
                    ? <EyeOff className="h-4 w-4 text-muted-foreground" />
                    : <Eye className="h-4 w-4 text-muted-foreground" />}
                </button>
              </div>
            </motion.div>
          </AnimatePresence>

          {error && (
            <p className="text-xs text-destructive text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-pine w-full disabled:opacity-60"
          >
            {loading ? t('auth.pleaseWait') : (
              <>
                {mode === 'login' ? t('auth.logIn') : t('auth.createAccount')}
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        {mode === 'login' && socialProviders.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
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
                  className="btn-ghost disabled:opacity-60"
                >
                  <span className="font-display text-lg font-extrabold">{provider === 'google' ? 'G' : '●'}</span>
                  {socialLoading === provider ? t('auth.pleaseWait') : t(`auth.${provider}`)}
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground">
          {t('auth.inviteHint')}
        </p>
      </motion.div>
    </div>
  );
}

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { api, getUserMessage } from '../lib/api';
import { BrandMark, Field } from '../components/ui-kit';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/onboarding/password-reset/confirm', { token, newPassword: password });
      setDone(true);
    } catch (err: unknown) {
      setError(getUserMessage(err, t('errors.generic')));
    } finally {
      setLoading(false);
    }
  };

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
            {t('auth.reset.headingLead')} <span className="mark">{t('auth.reset.headingMark')}</span>
          </h1>
          <p className="mt-3 text-base text-muted-foreground">{t('auth.reset.subtitle')}</p>
        </div>

        {!token ? (
          <p className="mt-6 text-sm text-destructive">{t('auth.reset.invalidToken')}</p>
        ) : done ? (
          <p className="mt-6 text-sm text-primary dark:text-secondary">{t('auth.reset.success')}</p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-3">
            <Field
              label={t('auth.labels.password')}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('auth.placeholders.newPassword')}
              autoComplete="new-password"
              required
              minLength={8}
            />
            {error && <p className="text-sm text-destructive text-center">{error}</p>}
            <button type="submit" disabled={loading} className="btn-pine w-full font-bold disabled:opacity-60">
              {loading ? t('auth.pleaseWait') : t('auth.reset.submit')}
            </button>
          </form>
        )}

        <button
          type="button"
          onClick={() => navigate('/login', { replace: true })}
          className="mt-5 text-center text-sm font-bold text-muted-foreground"
        >
          {t('auth.reset.backToLogin')}
        </button>

        <p className="mt-auto pt-8 pb-2 text-center text-sm text-muted-foreground">{t('auth.buildLabel')}</p>
      </motion.div>
    </div>
  );
}

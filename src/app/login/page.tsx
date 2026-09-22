'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './login.module.css';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync browser autofill values into React state so labels float immediately
  useEffect(() => {
    const syncAutofill = () => {
      const emailEl = document.getElementById('emailInput') as HTMLInputElement | null;
      const passEl = document.getElementById('passwordInput') as HTMLInputElement | null;
      if (emailEl && emailEl.value) {
        setEmail(emailEl.value);
      }
      if (passEl && passEl.value) {
        setPassword(passEl.value);
      }
    };

    syncAutofill();
    const t1 = setTimeout(syncAutofill, 100);
    const t2 = setTimeout(syncAutofill, 500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  const isEmailActive = emailFocused || email.trim().length > 0;
  const isPasswordActive = passwordFocused || password.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setStatus('loading');
    setErrorMessage(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, rememberMe }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setStatus('idle');
        setErrorMessage(data.error || 'Invalid email or password');
        return;
      }

      setStatus('success');
      setTimeout(() => {
        router.push('/');
        router.refresh();
      }, 500);
    } catch {
      setStatus('idle');
      setErrorMessage('Failed to connect to authentication server. Please try again.');
    }
  };

  return (
    <div className={styles.loginContainer}>
      <main className={styles.loginWrapper}>
        <form
          className={styles.loginCard}
          onSubmit={handleSubmit}
          autoComplete="off"
        >
          <h1 className={styles.cardTitle}>LOGIN</h1>

          {/* Error Message */}
          {errorMessage && (
            <div
              style={{
                color: '#991b1b',
                backgroundColor: 'rgba(254, 226, 226, 0.85)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                backdropFilter: 'blur(6px)',
                borderRadius: '10px',
                padding: '9px 14px',
                fontSize: '13px',
                textAlign: 'center',
                marginBottom: '22px',
                fontWeight: 500,
                lineHeight: 1.4,
              }}
            >
              {errorMessage}
            </div>
          )}

          {/* Email Field */}
          <div className={`${styles.formField} ${isEmailActive ? styles.active : ''}`}>
            <label htmlFor="emailInput">Email</label>
            <input
              type="email"
              id="emailInput"
              className={styles.input}
              placeholder=" "
              required
              autoComplete="off"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
            />
            <span className={styles.fieldIcon} aria-hidden="true">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect width="20" height="16" x="2" y="4" rx="2"></rect>
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
              </svg>
            </span>
            <div className={styles.borderLine}></div>
          </div>

          {/* Password Field */}
          <div className={`${styles.formField} ${isPasswordActive ? styles.active : ''}`}>
            <label htmlFor="passwordInput">Password</label>
            <input
              type={showPassword ? 'text' : 'password'}
              id="passwordInput"
              className={styles.input}
              placeholder=" "
              required
              autoComplete="off"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
            />
            <button
              type="button"
              className={`${styles.fieldIcon} ${styles.togglePassword}`}
              onClick={() => setShowPassword(!showPassword)}
              aria-label="Toggle password visibility"
            >
              {showPassword ? (
                /* Eye (Password Visible) */
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              ) : (
                /* Eye Off (Password Hidden) */
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"></path>
                  <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"></path>
                  <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"></path>
                  <line x1="2" x2="22" y1="2" y2="22"></line>
                </svg>
              )}
            </button>
            <div className={styles.borderLine}></div>
          </div>

          {/* Forgot Password Link */}
          <div className={styles.forgotWrapper}>
            <a href="#forgot" className={styles.forgotLink}>
              Forgot <strong>Password?</strong>
            </a>
          </div>

          {/* Remember Me Checkbox */}
          <div className={styles.rememberWrapper}>
            <label className={styles.checkboxLabel} htmlFor="rememberMe">
              <input
                type="checkbox"
                id="rememberMe"
                className={styles.checkboxInput}
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span className={styles.checkboxCustom}>
                <svg
                  className={styles.checkSvg}
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </span>
              <span className={styles.checkboxText}>Remember Me</span>
            </label>
          </div>

          {/* Login Button */}
          <button
            type="submit"
            className={styles.btnLogin}
            disabled={status === 'loading'}
            style={
              status === 'success'
                ? { background: 'linear-gradient(180deg, #38a169 0%, #22543d 100%)' }
                : status === 'loading'
                ? { opacity: 0.85 }
                : undefined
            }
          >
            {status === 'loading'
              ? 'Logging in...'
              : status === 'success'
              ? 'Login Successful!'
              : 'Login'}
          </button>

          {/* Register Footer */}
          <div className={styles.registerFooter}>
            <span className={styles.noAccount}>Don&apos;t have an Account?</span>
            <a href="#register" className={styles.registerLink}>
              Register
            </a>
          </div>
        </form>
      </main>
    </div>
  );
}

'use client';

// Color Admin SCSS — only loaded for admin routes
import '@/styles/nextjs.scss';
import 'react-perfect-scrollbar/dist/css/styles.css';

import { useEffect, useCallback, useState } from 'react';
import Header from '@/components/header/header';
import Sidebar from '@/components/sidebar/sidebar';
import ThemePanel from '@/components/theme-panel/theme-panel';
import { AppSettingsProvider, useAppSettings } from '@/config/app-settings';
import { usePathname, useRouter } from 'next/navigation';
import { useSessionStore } from '@/stores/session';
import { useBrandStore } from '@/stores/brand';
import { setAuthFailureHandler } from '@/lib/api/client';
import { loginHref, markSessionExpired } from '@/lib/auth-redirect';
import StepUpDialog from '@/components/shared/StepUpDialog';
import LockBanner from '@/components/shared/LockBanner';

function AdminShell({ children }: { children: React.ReactNode }) {
  const { settings } = useAppSettings();

  const handleScroll = useCallback(() => {
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const totalScroll = window.scrollY;
      const elm = document.querySelector('.app');
      if (elm) {
        if (totalScroll > 0) {
          elm.classList.add('has-scroll');
        } else {
          elm.classList.remove('has-scroll');
        }
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.addEventListener('scroll', handleScroll);
    }
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll]);

  return (
    <div className={
      'app ' +
      (settings.appClass ? settings.appClass + ' ' : '') +
      (settings.appBoxedLayout ? 'app-boxed-layout ' : '') +
      (settings.appContentFullHeight ? 'app-content-full-height ' : '') +
      (settings.appHeaderNone ? 'app-without-header ' : '') +
      (settings.appHeaderFixed && !settings.appHeaderNone ? 'app-header-fixed ' : '') +
      (settings.appSidebarWide ? 'app-with-wide-sidebar ' : '') +
      (settings.appSidebarTwo ? 'app-with-two-sidebar ' : '') +
      (settings.appSidebarEnd ? 'app-with-end-sidebar ' : '') +
      (settings.appSidebarHover ? 'app-with-hover-sidebar ' : '') +
      (settings.appSidebarEndToggled ? 'app-sidebar-end-toggled ' : '') +
      (settings.appSidebarEndMobileToggled ? 'app-sidebar-end-mobile-toggled ' : '') +
      (settings.appSidebarNone ? 'app-without-sidebar ' : '') +
      (settings.appSidebarFixed ? 'app-sidebar-fixed ' : '') +
      (settings.appSidebarMinified ? 'app-sidebar-minified ' : '') +
      (settings.appSidebarMobileToggled ? 'app-sidebar-mobile-toggled' : '') +
      (settings.appFooter ? 'app-footer-fixed ' : '') +
      (settings.appTopMenu ? 'app-with-top-menu ' : '') +
      (settings.appGradientEnabled ? 'app-gradient-enabled ' : '')
    }>
      {!settings.appHeaderNone && <Header />}
      {!settings.appSidebarNone && <Sidebar />}
      {!settings.appContentNone && <div className={'app-content ' + settings.appContentClass}>{children}</div>}
      {settings.appContentNone && <>{children}</>}
      {!settings.appHeaderNone && <ThemePanel />}
    </div>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const hydrate = useSessionStore((s) => s.hydrate);
  const clear = useSessionStore((s) => s.clear);
  const hydrated = useSessionStore((s) => s.hydrated);
  const token = useSessionStore((s) => s.token);
  const fetchBrand = useBrandStore((s) => s.fetchBrand);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Re-registered on navigation so the ?next= carries the page the user was
  // actually on when the 401 came back.
  useEffect(() => {
    setAuthFailureHandler(() => {
      markSessionExpired();
      clear();
      router.replace(loginHref(pathname));
    });
  }, [clear, router, pathname]);

  useEffect(() => {
    if (!hydrated) return;
    if (!token) {
      router.replace(loginHref(pathname));
      return;
    }
    setReady(true);
  }, [hydrated, token, router, pathname]);

  useEffect(() => {
    fetchBrand();
  }, [fetchBrand]);

  if (!ready) {
    return (
      <AppSettingsProvider>
        <div className="d-flex justify-content-center align-items-center vh-100">
          <div className="spinner-border text-theme" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </AppSettingsProvider>
    );
  }

  return (
    <AppSettingsProvider>
      <AdminShell>{children}</AdminShell>
      <LockBanner />
      <StepUpDialog />
    </AppSettingsProvider>
  );
}

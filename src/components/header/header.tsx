'use client';

import Link from 'next/link';
import DropdownProfile from './dropdown/profile';
import BalancePill from '@/components/shared/balance-pill';
import { useAppSettings } from '@/config/app-settings';
import { useBrandStore } from '@/stores/brand';

export default function Header() {
  const { settings, updateSettings } = useAppSettings();
  const brand = useBrandStore((s) => s.brand);

  const toggleAppSidebarMobile = () => {
    updateSettings({
      appSidebarMobileToggled: true,
    });
  };

  return (
    <div
      id="header"
      className="app-header"
      data-bs-theme={settings.appHeaderInverse ? 'dark' : ''}
    >
      <div className="navbar-header">
        <Link href="/" className="navbar-brand">
          <span className="navbar-logo"></span> <b>{brand.label}</b>
        </Link>

        {!settings.appSidebarNone && (
          <button
            type="button"
            className="navbar-mobile-toggler"
            onClick={toggleAppSidebarMobile}
          >
            <span className="icon-bar"></span>
            <span className="icon-bar"></span>
            <span className="icon-bar"></span>
          </button>
        )}
      </div>

      <div className="navbar-nav">
        <BalancePill />
        <DropdownProfile />
      </div>
    </div>
  );
}

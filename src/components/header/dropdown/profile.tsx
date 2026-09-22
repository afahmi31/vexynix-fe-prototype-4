'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSessionStore } from '@/stores/session';
import { authApi } from '@/lib/api/auth';

export default function DropdownProfile() {
  const router = useRouter();
  const username = useSessionStore((s) => s.username);
  const clear = useSessionStore((s) => s.clear);

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      await authApi.logout();
    } catch {
      // Fire-and-forget — clear locally regardless
    }
    clear();
    router.push('/login');
  };

  return (
    <div className="navbar-item navbar-user dropdown">
      <a href="#" className="navbar-link dropdown-toggle d-flex align-items-center" data-bs-toggle="dropdown">
      	<div className="image image-icon bg-gray-800 text-gray-600">
					<i className="fa fa-user"></i>
				</div>
        <span>
          <span className="d-none d-md-inline fw-bold">{username || 'Guest'}</span>
          <b className="caret"></b>
        </span>
      </a>
      <div className="dropdown-menu dropdown-menu-end me-1">
        <Link href="/account" className="dropdown-item">Account</Link>
        <div className="dropdown-divider"></div>
        <a href="#" className="dropdown-item" onClick={handleLogout}>Log Out</a>
      </div>
    </div>
  );
}

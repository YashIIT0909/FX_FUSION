'use client';

import { useWalletStore } from '@/src/lib/store';
import { LandingPage } from '@/src/components/landing-page';
import { redirect } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const isConnected = useWalletStore(state => state.isConnected);

  useEffect(() => {
    if (isConnected) {
      redirect('/dashboard');
    }
  }, [isConnected]);

  return <LandingPage />;
}
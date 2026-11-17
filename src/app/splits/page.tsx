'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SplitsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/?tab=splits');
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="flex items-center gap-3 text-cyan-600 dark:text-cyan-400 font-bold text-sm">
        <span className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        <span>Opening Splits & IOU Recovery Hub...</span>
      </div>
    </div>
  );
}

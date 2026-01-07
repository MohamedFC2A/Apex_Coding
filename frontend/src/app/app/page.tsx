import dynamic from 'next/dynamic';

const IDEClient = dynamic(() => import('./IDEClient'), { ssr: false });

export default function IDEPage() {
  return (
    <main className="h-full min-h-0">
      <IDEClient />
    </main>
  );
}


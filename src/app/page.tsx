'use client'

import { useState, useEffect } from 'react';
import Image from "next/image";
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export default function Home() {
  const [progress, setProgress] = useState<number>(0);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const unlisten = Promise.all([
      listen('download-progress', (event: any) => {
        const [downloaded, total] = event.payload;
        const percentage = Math.round((downloaded / total) * 100);
        setProgress(percentage);
      }),
      listen('download-complete', () => {
        setDownloading(false);
        setProgress(0);
      }),
      listen('download-error', (event: any) => {
        setDownloading(false);
        setProgress(0);
        console.error('Download failed:', event.payload);
      })
    ]);

    return () => {
      unlisten.then(listeners => listeners.forEach(u => u()));
    };
  }, []);

  const handleSubmit = async () => {
    const urlInput = document.querySelector('input[type="url"]') as HTMLInputElement;
    if (urlInput?.value) {
      setDownloading(true);
      try {
        await invoke('download_file', { 
          url: urlInput.value,
          output: 'downloaded_file.zip',
          numthreads: 4
        });
      } catch (error) {
        console.error('Failed to start download:', error);
        setDownloading(false);
      }
    }
  };

  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start">
        <Image
          className="dark:invert"
          src="/next.svg"
          alt="Next.js logo"
          width={180}
          height={38}
          priority
        />
        <ol className="list-inside list-decimal text-sm text-center sm:text-left font-[family-name:var(--font-geist-mono)]">
          <li className="mb-2">
            Get started by editing{" "}
            <code className="bg-black/[.05] dark:bg-white/[.06] px-1 py-0.5 rounded font-semibold">
              src/app/page.tsx
            </code>
            .
          </li>
          <li>Save and see your changes instantly.</li>
        </ol>

        <div className="flex gap-4 items-center flex-col sm:flex-row">
          <a
            className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5"
            href="https://vercel.com/new?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              className="dark:invert"
              src="/vercel.svg"
              alt="Vercel logomark"
              width={20}
              height={20}
            />
            Deploy now
          </a>
          <a
            className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:min-w-44"
            href="https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            Read our docs
          </a>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
          <input 
            type="url"
            placeholder="Enter URL"
            className="flex-1 px-4 py-2 rounded-md border border-black/[.08] dark:border-white/[.145] focus:outline-none focus:ring-2 focus:ring-foreground dark:bg-[#1a1a1a]"
          />
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <button 
              onClick={handleSubmit}
              disabled={downloading}
              className="w-full sm:w-auto px-6 py-2 rounded-md bg-foreground text-background hover:bg-[#383838] dark:hover:bg-[#ccc] transition-colors disabled:opacity-50"
            >
              {downloading ? `${progress}%` : 'Submit'}
            </button>
            {downloading && (
              <div className="w-full sm:w-32 h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </main>
      <footer className="row-start-3 flex gap-6 flex-wrap items-center justify-center">
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/file.svg"
            alt="File icon"
            width={16}
            height={16}
          />
          Learn
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/window.svg"
            alt="Window icon"
            width={16}
            height={16}
          />
          Examples
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://nextjs.org?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/globe.svg"
            alt="Globe icon"
            width={16}
            height={16}
          />
          Go to nextjs.org →
        </a>
      </footer>
    </div>
  );
}

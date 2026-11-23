import type { ReactNode } from 'react';

/** login.png / register.png: big greeting on the left (desktop), form card on the right. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-content items-center justify-between gap-50 px-15 py-40 xl:px-0">
      <p aria-hidden="true" className="hidden max-w-[640px] text-display text-fg-primary lg:block">
        Hi!
        <br />
        It’s nice to see you!
      </p>
      <section aria-labelledby="auth-title" className="mx-auto w-full max-w-[380px] bg-canvas-base p-40 lg:mx-0">
        <h1 id="auth-title" className="text-h1 text-fg-primary">{title}</h1>
        <p className="mt-5 text-label text-fg-muted">{subtitle}</p>
        <div className="mt-30">{children}</div>
      </section>
    </div>
  );
}

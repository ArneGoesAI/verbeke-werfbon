import type { ReactNode } from "react";

export const metadata = { title: "Werfbon" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="nl-BE">
      <body>{children}</body>
    </html>
  );
}

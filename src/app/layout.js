import "./globals.css";

export const metadata = {
  title: "Faceless 2.0 — YouTube Automation Studio",
  description: "A production workspace for creating, composing, and automating faceless YouTube channels with Faceless 2.0.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&display=swap"
        />
      </head>
      <body
        suppressHydrationWarning
        className="bg-paper text-ink font-sans antialiased min-h-screen selection:bg-signal/20 selection:text-signal"
      >
        {children}
      </body>
    </html>
  );
}

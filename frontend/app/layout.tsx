export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <title>LUCARNE — World Cup Signal Intelligence</title>
        <meta name="description" content="On-chain momentum signals for 32 nations. Powered by X Layer." />
      </head>
      <body style={{ background: "#0A0F0D", color: "#E5E7EB", fontFamily: "monospace", margin: 0 }}>
        {children}
      </body>
    </html>
  );
}

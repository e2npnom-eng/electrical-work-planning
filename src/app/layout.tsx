import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ปฏิทินแผนงาน ผปบ.กฟจ.นครพนม",
  description: "ระบบปฏิทินแผนงานด้านไฟฟ้า",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⚡</text></svg>"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Anuphan:wght@400;500;600;700&display=swap"
        />
      </head>
      <body><div className="app-shell">{children}</div></body>
    </html>
  );
}

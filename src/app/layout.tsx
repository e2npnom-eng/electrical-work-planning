import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Electrical Work Planning",
  description: "ระบบปฏิทินแผนงานด้านไฟฟ้า"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="th"><body><div className="app-shell">{children}</div></body></html>;
}

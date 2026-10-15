import "./page.css";

export const metadata = {
  title: "Byte Shop",
  description: "A small PC shop, with an AI agent that investigates service faults.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

import React from "react";
import "./styles/globals.scss";
import "./styles/markdown.scss";
import "./styles/prism.scss";

export const metadata = {
  title: "Gemma3 Next Web",
  description: "Your personal Gemma3 Chat Bot.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta
          name="viewport"
          content="width=device-width, user-scalable=no, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0"
        />
        <link rel="manifest" href="/site.webmanifest"></link>
      </head>
      <body>{children}</body>
    </html>
  );
}

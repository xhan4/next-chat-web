import { Analytics } from "@vercel/analytics/react";
import { Home } from './components/home'
import React from "react";

export default function App() {
  return (
    <>
      <Home />
      <Analytics />
    </>
  );
}

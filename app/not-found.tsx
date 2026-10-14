"use client";

import { Wind404 } from "@/components/effects/Wind404";

export default function NotFound() {
  return (
    <Wind404
      title="404"
      subtitle="Nothing at this address but the wind."
      backText="Back to sign in"
      onBack={() => {
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
      }}
    />
  );
}

"use client";

import { useEffect } from "react";

import { useStudioUiStore } from "@/lib/ui/store";

export function ThemeProvider({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const theme = useStudioUiStore((state) => state.theme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  return children;
}

import { NextResponse } from "next/server";

import type { PromptGenerationResponse } from "@/lib/studio/types";

export async function POST() {
  const payload: PromptGenerationResponse = {
    status: "stub",
    message: "Prompt-based SVG generation is reserved for V2.",
  };

  return NextResponse.json(payload, { status: 501 });
}

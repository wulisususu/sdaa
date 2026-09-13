import type { QuestionCompilerStage } from "@ask-better/domain";

export interface StageVisual {
  background: string;
  foreground: "light" | "dark";
  accent: string;
  surface: string;
}

export const stageVisuals: Record<QuestionCompilerStage, StageVisual> = {
  input: {
    background: "#F2C96D",
    foreground: "dark",
    accent: "#6A4600",
    surface: "#FFF8E8"
  },
  clarify: {
    background: "#E97951",
    foreground: "dark",
    accent: "#5E2618",
    surface: "#FFF0EB"
  },
  diagnose: {
    background: "#A85A76",
    foreground: "light",
    accent: "#F1B7CD",
    surface: "#4C2638"
  },
  coverage: {
    background: "#665BC6",
    foreground: "light",
    accent: "#DDD9FF",
    surface: "#2E286B"
  },
  result: {
    background: "#287B6C",
    foreground: "light",
    accent: "#C8ECE4",
    surface: "#123D36"
  }
};

export const motionTokens = {
  micro: 0.16,
  reduced: 0.16,
  fast: 0.24,
  standard: 0.42,
  scene: 0.76,
  staggerXs: 0.04,
  staggerSm: 0.07
} as const;

import type { QuestionCompilerStage } from "@ask-better/domain";

interface StageBackdropProps {
  stage: QuestionCompilerStage;
}

export function StageBackdrop({ stage }: StageBackdropProps) {
  return (
    <div
      className={`stage-backdrop stage-backdrop-${stage}`}
      data-stage-backdrop={stage}
      aria-hidden="true"
    >
      <span className="stage-backdrop-shape stage-backdrop-shape-primary" />
      <span className="stage-backdrop-shape stage-backdrop-shape-secondary" />
    </div>
  );
}

import {
  canVisitStage,
  getStageIndex,
  questionCompilerStages,
  stageEnglishLabels,
  stageLabels,
  type QuestionCompilerStage
} from "@ask-better/domain";

interface StageStepperProps {
  stage: QuestionCompilerStage;
  maxVisited: QuestionCompilerStage;
  onChange?: (stage: QuestionCompilerStage) => void;
}

export function StageStepper({ stage, maxVisited, onChange }: StageStepperProps) {
  return (
    <nav className="stage-stepper" aria-label="问题整理进度">
      {questionCompilerStages.map((item, index) => {
        const active = item === stage;
        const visited = getStageIndex(item) <= getStageIndex(maxVisited);
        const enabled = canVisitStage(item, maxVisited);
        return (
          <button
            key={item}
            type="button"
            className={`stage-step ${active ? "is-active" : ""} ${visited ? "is-visited" : ""}`}
            onClick={() => enabled && onChange?.(item)}
            disabled={!enabled}
            aria-current={active ? "step" : undefined}
          >
            <span className="stage-index">{index + 1}</span>
            <span className="stage-copy"><strong>{stageLabels[item]}</strong><small>{stageEnglishLabels[item]}</small></span>
          </button>
        );
      })}
    </nav>
  );
}

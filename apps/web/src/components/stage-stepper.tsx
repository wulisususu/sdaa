import {
  questionCompilerStages,
  stageEnglishLabels,
  stageLabels,
  type QuestionCompilerStage
} from "@ask-better/domain";

interface StageStepperProps {
  stage: QuestionCompilerStage;
  onChange?: (stage: QuestionCompilerStage) => void;
}

export function StageStepper({ stage, onChange }: StageStepperProps) {
  return (
    <nav className="stage-stepper" aria-label="问题编译进度">
      {questionCompilerStages.map((item, index) => {
        const active = item === stage;
        return (
          <button key={item} type="button" className={`stage-step ${active ? "is-active" : ""}`} onClick={() => onChange?.(item)}>
            <span className="stage-index">{index + 1}</span>
            <span className="stage-copy"><strong>{stageLabels[item]}</strong><small>{stageEnglishLabels[item]}</small></span>
          </button>
        );
      })}
    </nav>
  );
}

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
  const currentIndex = getStageIndex(stage);
  const currentNumber = currentIndex + 1;
  const totalStages = questionCompilerStages.length;
  const progress = `${(currentNumber / totalStages) * 100}%`;

  return (
    <>
      <div className="mobile-stage-progress" aria-label={`当前进度：${currentNumber} / ${totalStages}，${stageLabels[stage]}`}>
        <div className="mobile-stage-progress-copy">
          <span>{currentNumber} / {totalStages}</span>
          <strong>{stageLabels[stage]}</strong>
          <small>{stageEnglishLabels[stage]}</small>
        </div>
        <div className="mobile-stage-progress-track" aria-hidden="true">
          <span style={{ width: progress }} />
        </div>
      </div>

      <nav className="stage-stepper desktop-stage-stepper" aria-label="问题整理进度">
        {questionCompilerStages.map((item, index) => {
          const active = item === stage;
          const visited = getStageIndex(item) <= getStageIndex(maxVisited);
          const completed = visited && index < currentIndex;
          const enabled = canVisitStage(item, maxVisited);

          return (
            <button
              key={item}
              type="button"
              className={`stage-step ${active ? "is-active" : ""} ${visited ? "is-visited" : ""} ${completed ? "is-completed" : ""}`}
              onClick={() => enabled && onChange?.(item)}
              disabled={!enabled}
              aria-current={active ? "step" : undefined}
            >
              <span className="stage-index" aria-hidden="true">
                {completed ? "✓" : index + 1}
              </span>
              <span className="stage-copy">
                <strong>{stageLabels[item]}</strong>
                <small>{completed ? "已完成" : stageEnglishLabels[item]}</small>
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
}

import {
  canVisitStage,
  getStageIndex,
  questionCompilerStages,
  stageEnglishLabels,
  stageLabels,
  type QuestionCompilerStage
} from "@ask-better/domain";
import { stageVisuals } from "../lib/stage-visuals";

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
  const tone = stageVisuals[stage].foreground;
  const toneClass = `stage-stepper-tone-${tone}`;

  return (
    <>
      <div className={`mobile-stage-progress ${toneClass}`} data-tone={tone} aria-label={`当前进度：${currentNumber} / ${totalStages}，${stageLabels[stage]}`}>
        <div className="mobile-stage-progress-copy">
          <span data-motion="stage-number">{currentNumber} / {totalStages}</span>
          <strong data-motion="headline">{stageLabels[stage]}</strong>
          <small>{stageEnglishLabels[stage]}</small>
        </div>
        <div className="mobile-stage-progress-track" aria-hidden="true">
          <span style={{ width: progress }} />
        </div>
      </div>

      <nav className={`stage-stepper desktop-stage-stepper ${toneClass}`} data-tone={tone} aria-label="问题整理进度">
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
              <span className="stage-index" data-motion={active ? "stage-number" : undefined} aria-hidden="true">
                {completed ? "✓" : index + 1}
              </span>
              <span className="stage-copy">
                <strong data-motion={active ? "headline" : undefined}>{stageLabels[item]}</strong>
                <small>{completed ? "已完成" : stageEnglishLabels[item]}</small>
              </span>
            </button>
          );
        })}
      </nav>

      <style>{`
        .mobile-stage-progress {
          display: none;
        }

        @media (max-width: 767px) {
          .desktop-stage-stepper {
            display: none;
          }

          .mobile-stage-progress {
            display: grid;
            gap: 10px;
            margin-bottom: 14px;
            padding: 12px 13px;
            border: 1px solid var(--border);
            border-radius: 14px;
            background: rgba(255, 255, 255, 0.9);
            box-shadow: var(--shadow-sm);
            backdrop-filter: blur(12px);
          }

          .mobile-stage-progress-copy {
            display: grid;
            grid-template-columns: auto 1fr auto;
            align-items: baseline;
            gap: 8px;
          }

          .mobile-stage-progress-copy > span {
            color: var(--accent);
            font-size: 11px;
            font-weight: 800;
          }

          .mobile-stage-progress-copy > strong {
            color: var(--text-primary);
            font-size: 13px;
          }

          .mobile-stage-progress-copy > small {
            color: var(--text-tertiary);
            font-size: 9px;
          }

          .mobile-stage-progress-track {
            height: 4px;
            overflow: hidden;
            border-radius: 999px;
            background: var(--surface-muted);
          }

          .mobile-stage-progress-track > span {
            display: block;
            height: 100%;
            border-radius: inherit;
            background: linear-gradient(90deg, var(--accent), #7c6ff2);
            transition: width var(--transition-ui);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .mobile-stage-progress-track > span {
            transition: none;
          }
        }
      `}</style>
    </>
  );
}

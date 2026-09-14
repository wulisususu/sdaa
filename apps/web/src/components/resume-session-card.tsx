import { ActionIcon } from "./action-icons";

interface ResumeSessionCardProps {
  rawQuestion: string;
  onResume: () => void;
  onDiscard: () => void;
}

export function ResumeSessionCard({
  rawQuestion,
  onResume,
  onDiscard
}: ResumeSessionCardProps) {
  return (
    <section className="resume-session-card" data-motion="resume-session">
      <div className="resume-session-heading">
        <ActionIcon name="history" />
        <span className="resume-session-title">继续上次</span>
      </div>
      <p className="resume-session-question">{rawQuestion}</p>
      <div className="resume-session-actions">
        <button className="secondary-button" type="button" onClick={onResume}>
          <ActionIcon name="history" />
          继续上次
        </button>
        <button className="ghost-button" type="button" onClick={onDiscard}>
          <ActionIcon name="plus" />
          新问题
        </button>
      </div>
    </section>
  );
}

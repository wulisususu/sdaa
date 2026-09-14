import { ActionIcon } from "./action-icons";
import type { QuestionSessionSummaryV2 } from "../lib/question-session-storage";

interface ResumeSessionCardProps {
  session: QuestionSessionSummaryV2;
  onResume: () => void;
  onDismiss: () => void;
}

export function ResumeSessionCard({ session, onResume, onDismiss }: ResumeSessionCardProps) {
  return (
    <section className="resume-session-card" data-motion="resume-session">
      <div className="resume-session-heading">
        <ActionIcon name="history" />
        <span className="resume-session-title">继续上次</span>
      </div>
      <p className="resume-session-question">{session.rawQuestion}</p>
      <div className="resume-session-actions">
        <button className="secondary-button" type="button" onClick={onResume}>
          <ActionIcon name="history" />
          继续上次
        </button>
        <button className="ghost-button" type="button" onClick={onDismiss}>
          <ActionIcon name="plus" />
          新问题
        </button>
      </div>
    </section>
  );
}

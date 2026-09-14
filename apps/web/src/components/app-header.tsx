import { ActionIcon } from "./action-icons";

interface AppHeaderProps {
  onOpenHistory: () => void;
  onNewQuestion: () => void;
}

export function AppHeader({ onOpenHistory, onNewQuestion }: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="brand-block">
        <div className="brand-mark">问</div>
        <div>
          <div className="brand-title">问得更好</div>
          <div className="brand-subtitle">Ask Better · AI 提问编译器</div>
        </div>
      </div>
      <div className="app-header-actions">
        <button className="ghost-button" type="button" onClick={onOpenHistory}>
          <ActionIcon name="history" />
          历史
        </button>
        <button className="ghost-button" type="button" onClick={onNewQuestion}>
          <ActionIcon name="plus" />
          新建问题
        </button>
      </div>
    </header>
  );
}

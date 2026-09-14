"use client";

import type { ClarificationAnswers, ClarificationQuestion } from "@ask-better/domain";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { useRef, useState } from "react";

gsap.registerPlugin(useGSAP);

interface ClarificationStageProps {
  questions: ClarificationQuestion[];
  answers: ClarificationAnswers;
  answeredCount: number;
  onAnswer: (questionId: string, option: string) => void;
  onBack: () => void;
  onContinue: () => void;
}

export function findFirstUnansweredIndex(
  questions: ClarificationQuestion[],
  answers: ClarificationAnswers
): number {
  const index = questions.findIndex((question) => !answers[question.id]);
  return index === -1 ? Math.max(questions.length - 1, 0) : index;
}

export function clampClarificationIndex(index: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(Math.max(index, 0), total - 1);
}

export function ClarificationStage({
  questions,
  answers,
  onAnswer,
  onBack,
  onContinue
}: ClarificationStageProps) {
  const questionRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(() =>
    clampClarificationIndex(findFirstUnansweredIndex(questions, answers), questions.length)
  );

  const total = questions.length;
  const safeIndex = clampClarificationIndex(activeIndex, total);
  const activeQuestion = questions[safeIndex];

  // Within-stage question change: a short local motion that must never move the
  // full scene canvas (the 0.68s full-scene handoff belongs to the viewport).
  useGSAP(
    () => {
      if (!questionRef.current || total <= 1) return;
      gsap.fromTo(
        questionRef.current,
        { x: 14, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.2, ease: "power2.out" }
      );
    },
    { dependencies: [safeIndex], scope: questionRef }
  );

  if (!activeQuestion) return null;

  const isLastQuestion = safeIndex >= total - 1;
  const answered = Boolean(answers[activeQuestion.id]);
  const positions = String(total).length;

  function handleOption(option: string) {
    if (!activeQuestion) return;
    onAnswer(activeQuestion.id, option);
    if (!isLastQuestion) {
      setActiveIndex((index) => clampClarificationIndex(index + 1, total));
    }
  }

  function handleSkip() {
    // Skipping never writes a fabricated answer value.
    setActiveIndex((index) => clampClarificationIndex(index + 1, total));
  }

  return (
    <section className="flow-stage">
      <div className="flow-card">
        <div className="flow-heading flow-heading-split">
          <div>
            <span className="section-kicker">02 / 05 · CLARIFY</span>
            <h2 data-motion="headline">把真正会影响答案的条件补完整</h2>
            <small>高信息增益，只问关键条件</small>
          </div>
        </div>
        <p className="stage-lead">只问高信息增益的问题。不确定的可以跳过，系统不会把未提供的信息当成你的真实背景。</p>

        <div className="clarification-focus">
          <div
            className={`clarification-focus-card ${answered ? "is-answered" : ""}`}
            ref={questionRef}
            data-motion="clarification-question"
          >
            <div className="clarification-title-row">
              <h3>{activeQuestion.question}</h3>
              {answered && <span className="answered-label">已补充</span>}
            </div>
            {activeQuestion.helper && <p className="clarification-helper">{activeQuestion.helper}</p>}
            <div className="clarification-focus-options">
              {activeQuestion.options.map((option) => {
                const selected = answers[activeQuestion.id] === option;
                return (
                  <button
                    type="button"
                    key={option}
                    className={`option-button ${selected ? "is-selected" : ""}`}
                    data-motion="option"
                    aria-pressed={selected}
                    onClick={() => handleOption(option)}
                  >
                    <span className="option-check" aria-hidden="true">{selected ? "✓" : ""}</span>
                    <span>{option}</span>
                  </button>
                );
              })}
            </div>
            <div className="clarification-focus-footer">
              <span className="clarification-position" aria-live="polite">
                {safeIndex + 1} / {total}
              </span>
              <div className="clarification-focus-nav">
                {safeIndex > 0 && (
                  <button
                    type="button"
                    className="ghost-button clarification-quiet-button"
                    onClick={() => setActiveIndex((index) => clampClarificationIndex(index - 1, total))}
                  >
                    ← 上一题
                  </button>
                )}
                {!isLastQuestion && (
                  <button
                    type="button"
                    className="ghost-button clarification-quiet-button"
                    onClick={handleSkip}
                  >
                    跳过 <span aria-hidden="true">→</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="stage-action-bar">
          <button className="secondary-button" type="button" onClick={onBack}>返回修改问题</button>
          <button className="primary-button" type="button" onClick={onContinue}>继续问题体检 <span aria-hidden="true">→</span></button>
        </div>
      </div>
    </section>
  );
}

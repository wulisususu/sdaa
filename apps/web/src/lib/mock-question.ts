import type { QuestionCompilerState } from "@ask-better/domain";

export const mockQuestionState: QuestionCompilerState = {
  stage: "diagnose",
  rawQuestion: "现在转码还有前途吗？",
  intent: ["职业转换", "就业判断", "技能投入回报", "时间敏感"],
  clarificationQuestions: [
    {
      id: "background",
      question: "你目前最接近哪种情况？",
      helper: "不同背景会直接改变转型成本和建议顺序。",
      options: ["在校生", "刚毕业", "已经工作", "其他"]
    },
    {
      id: "goal",
      question: "你说的“有前途”，最关心什么？",
      helper: "我们只保留真正影响问题质量的条件。",
      options: ["就业机会", "薪资", "稳定性", "长期成长"]
    },
    {
      id: "direction",
      question: "你更想转向哪类岗位？",
      options: ["AI 应用开发", "前后端开发", "暂时不确定"]
    }
  ],
  diagnostics: [
    { "code": "W001", "title": "范围太大", "summary": "“转码”可能包含前端、后端、AI 应用等不同方向。", "level": "warning" },
    { "code": "W003", "title": "缺少关键背景", "summary": "当前专业、毕业时间和技术基础会改变建议。", "level": "warning" },
    { "code": "W005", "title": "判断标准不清楚", "summary": "“有前途”可能指就业、薪资、稳定性或长期成长。", "level": "high" },
    { "code": "W010", "title": "可能已有类似问题", "summary": "后续会检索知乎已有讨论，避免重复提问。", "level": "info" }
  ],
  existingCoverage: [
    { "id": "career-switch", "title": "非科班能否转码", "detail": "已有较多通用讨论", "strength": "high" },
    { "id": "web-route", "title": "传统 Web 学习路线", "detail": "已有较完整经验分享", "strength": "high" },
    { "id": "ai-impact", "title": "AI Coding 对初级岗位的影响", "detail": "近两年讨论明显增多", "strength": "medium" }
  ],
  knowledgeGaps: [
    { "id": "graduate-2027", "title": "2027 届毕业生的时间窗口", "detail": "当前检索内容对这一毕业批次的针对性仍不足。" },
    { "id": "ai-vs-web", "title": "AI 应用开发与传统 Web 的投入回报", "detail": "两条路线在学习成本与招聘机会上的直接比较较少。" },
    { "id": "non-cs-transfer", "title": "非计算机专业的技能迁移成本", "detail": "需要结合个人背景重新限定问题。" }
  ],
  compiledQuestion: {
    title: "27 届非计算机专业本科生，在 AI Coding 工具普及后，如果目标是转向 AI 应用开发，相比传统前后端，就业机会和学习投入分别如何？",
    background: "目前处于毕业前的职业方向选择阶段，希望评估转向软件 / AI 岗位的现实可行性。",
    goal: "在有限时间内选择更值得投入的技术路线，并形成可用于求职的能力。",
    constraints: ["需要考虑 2026–2027 招聘环境", "重点关注初级岗位机会", "希望比较学习投入与回报"],
    coreUncertainty: "应该先系统补齐传统 Web 工程基础，还是直接以 AI 应用开发为主线？",
    expectedAnswer: ["招聘环境", "能力门槛", "学习顺序", "项目深度", "求职风险"]
  }
};

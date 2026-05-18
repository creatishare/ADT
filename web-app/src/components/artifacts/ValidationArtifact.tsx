"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AlertTriangle, CheckCircle2, ShieldCheck, ShieldAlert, Lock } from "lucide-react";
import type {
  DimensionScore,
  ValidationReport,
} from "@/lib/chat/artifactParser";
import { SectionLabel } from "@/components/workspace/primitives/SectionLabel";

/**
 * 硬门槛维度配置 (2026-05-14)
 *
 * VALIDATOR_PROMPT 的 5 维评分里有 4 条"一票否决"硬门槛：
 *   - 非魔法性 ≥ 4
 *   - 代码-舞台一致性 ≥ 4
 *   - 知识点必要性 ≥ 4   ← 2026-05-14 新增的"硬贴剧情"防线
 *   - 儿童认知适配 ≥ 3
 *
 * 维度数据按名称模糊匹配——和 prompt 表头同源，未来改名要同步。
 *
 * "necessity" 标记的是"知识点必要性"——它的硬门槛是整个'知识点长在剧情里'闭环
 * 的核心抓手。低于阈值时给出最显眼的红色 + lock 图标 + 一段"硬门槛违反"说明，
 * 避免被当成普通的"扣分项"略过。
 */
const HARD_GATE_CONFIG: ReadonlyArray<{
  match: RegExp;
  threshold: number;
  necessity?: boolean;
}> = [
  { match: /非魔法/, threshold: 4 },
  { match: /一致性/, threshold: 4 },
  { match: /必要性/, threshold: 4, necessity: true },
  { match: /认知/, threshold: 3 },
];

/**
 * 给定一个维度，判定它是否触发硬门槛违反，以及是否是"知识点必要性"这条
 * 关键硬门槛（用于 UI 上做差异化高亮）。
 */
function classifyDimension(dim: DimensionScore): {
  isHardGateViolation: boolean;
  isNecessityGate: boolean;
} {
  for (const cfg of HARD_GATE_CONFIG) {
    if (cfg.match.test(dim.name)) {
      return {
        isHardGateViolation: dim.scoreValue < cfg.threshold,
        isNecessityGate: cfg.necessity === true,
      };
    }
  }
  return { isHardGateViolation: false, isNecessityGate: false };
}

interface ValidationArtifactProps {
  report: ValidationReport;
  rawContent: string;
  testId?: string;
}

interface Conclusion {
  title: string;
  subtitle: string;
  icon: typeof ShieldCheck;
  bg: string;
  ink: string;
  border: string;
}

function getConclusionVisual(report: ValidationReport): Conclusion {
  const failingCount = report.dimensions.filter((d) => !d.passed).length;
  const fallbackCount = Math.max(
    0,
    Math.max(report.suggestions.length, report.risks.length, 0)
  );
  if (report.conclusion === "通过") {
    return {
      title: "可推进至文档编写",
      subtitle:
        report.suggestions.length > 0
          ? `验证通过，附 ${report.suggestions.length} 项可选优化建议`
          : "全部校验通过，无阻塞偏差",
      icon: ShieldCheck,
      bg: "var(--success-soft)",
      ink: "var(--success-ink)",
      border: "color-mix(in oklch, var(--success) 25%, transparent)",
    };
  }
  if (report.conclusion === "不通过，需修改") {
    const detected = failingCount > 0 ? failingCount : report.risks.length;
    return {
      title: "需修改后重新验证",
      subtitle:
        detected > 0
          ? `检测到 ${detected} 项扣分维度，请按建议修订`
          : "存在阻塞性偏差，请按建议修订",
      icon: ShieldAlert,
      bg: "var(--danger-soft)",
      ink: "var(--danger-ink)",
      border: "color-mix(in oklch, var(--danger) 25%, transparent)",
    };
  }
  return {
    title: "需要人工判断",
    subtitle:
      fallbackCount > 0
        ? `自动验证不确定，请人工复核 ${fallbackCount} 项`
        : "自动验证未给出明确结论，请人工复核",
    icon: AlertTriangle,
    bg: "var(--accent-soft)",
    ink: "var(--accent-ink)",
    border: "color-mix(in oklch, var(--accent) 25%, transparent)",
  };
}

interface StatStripProps {
  passCount: number;
  warnCount: number;
  blockCount: number;
}

function StatStrip({ passCount, warnCount, blockCount }: StatStripProps) {
  const stats: { value: number; label: string; color: string }[] = [
    { value: passCount, label: "通过", color: "var(--success-ink)" },
    { value: warnCount, label: "偏差", color: "var(--accent-ink)" },
    { value: blockCount, label: "阻塞", color: "var(--danger-ink)" },
  ];
  return (
    <div className="flex shrink-0 items-center gap-3">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="flex flex-col items-end leading-tight"
        >
          <span
            className="font-mono text-[18px] font-semibold"
            style={{ color: stat.color }}
          >
            {stat.value}
          </span>
          <span
            className="font-mono text-[10px] uppercase tracking-[0.12em]"
            style={{ color: "var(--fg-faint)" }}
          >
            {stat.label}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Dimensions whose score did not reach the maximum — the real "items to fix". */
function getFailingDimensions(report: ValidationReport): DimensionScore[] {
  return report.dimensions.filter((d) => !d.passed);
}

/**
 * 总分横幅 —— 2026-05-14 新增。
 *
 * 把 5 维评分的"已达成 / 满分"做成一个进度条，让用户在不读 markdown 的
 * 情况下也能一眼判断"离通过线还差多远"。
 *
 * 通过线：
 *   - standard / integration 模式：≥ 18/25
 *   - single-group 模式（剧情连贯性 N/A，只剩 4 维）：≥ 14/20
 *
 * 阈值是按"实际维度满分总和"动态计算的——parser 会自动跳过 N/A 行，所以
 * `dimensions.length × maxScore` 自然反映了模式。
 */
function TotalScoreBar({ dimensions }: { dimensions: DimensionScore[] }) {
  if (dimensions.length === 0) return null;

  const earned = dimensions.reduce((acc, d) => acc + d.scoreValue, 0);
  const total = dimensions.reduce((acc, d) => acc + d.maxScore, 0);
  const ratio = total > 0 ? earned / total : 0;
  // 通过阈值 = 总分 × 0.72（18/25 = 14/20 = 0.72 倍系数）
  const passThreshold = Math.ceil(total * 0.72);
  const reachedThreshold = earned >= passThreshold;

  // 没达标用 danger 调色，达标用 success 调色
  const tone = reachedThreshold
    ? { fill: "var(--success-ink)", soft: "var(--success-soft)" }
    : { fill: "var(--danger-ink)", soft: "var(--danger-soft)" };

  return (
    <div className="mb-3 flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span
          className="text-[11px] font-medium uppercase tracking-[0.08em]"
          style={{ color: "var(--fg-faint)" }}
        >
          总分
        </span>
        <span className="flex items-baseline gap-1.5">
          <span
            className="font-mono text-[18px] font-semibold tabular-nums"
            style={{ color: tone.fill }}
          >
            {earned}
          </span>
          <span
            className="font-mono text-[12px] tabular-nums"
            style={{ color: "var(--fg-faint)" }}
          >
            /{total}
          </span>
          <span
            className="ml-1 text-[10px]"
            style={{ color: "var(--fg-faint)" }}
          >
            通过线 ≥{passThreshold}
          </span>
        </span>
      </div>
      <div
        className="relative h-1.5 overflow-hidden rounded-full"
        style={{ background: tone.soft }}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all"
          style={{
            width: `${Math.min(100, ratio * 100)}%`,
            background: tone.fill,
          }}
        />
        {/* 通过线刻度 */}
        <div
          className="absolute inset-y-0 w-px"
          style={{
            left: `${Math.min(100, (passThreshold / total) * 100)}%`,
            background: "var(--fg-faint)",
            opacity: 0.5,
          }}
          aria-label={`通过线 ${passThreshold}`}
        />
      </div>
    </div>
  );
}

/**
 * 单个维度的评分行 —— progress bar + 得分 + 描述。
 *
 * 三种状态：
 *   1. 满分 (passed=true)：success 调色 + ✓ 标记
 *   2. 硬门槛违反 (isHardGateViolation)：danger 调色 + 锁形图标 + "硬门槛"标签
 *      - 进一步 isNecessityGate 时会在描述区上方加一条"<4 触发一票否决"提示
 *   3. 其他扣分：accent (warning) 调色 + ⚠️ 标记
 */
function DimensionRow({ dim }: { dim: DimensionScore }) {
  const { isHardGateViolation, isNecessityGate } = classifyDimension(dim);
  const ratio = dim.maxScore > 0 ? dim.scoreValue / dim.maxScore : 0;

  const tone = dim.passed
    ? {
        fill: "var(--success-ink)",
        soft: "var(--success-soft)",
        text: "var(--success-ink)",
      }
    : isHardGateViolation
    ? {
        fill: "var(--danger-ink)",
        soft: "var(--danger-soft)",
        text: "var(--danger-ink)",
      }
    : {
        fill: "var(--accent-ink)",
        soft: "var(--accent-soft)",
        text: "var(--accent-ink)",
      };

  const StatusIcon = dim.passed
    ? CheckCircle2
    : isHardGateViolation
    ? Lock
    : AlertTriangle;

  return (
    <li className="flex flex-col gap-1.5 rounded-lg px-2 py-2">
      <div className="flex items-center gap-2">
        <span
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
          style={{ background: tone.soft }}
        >
          <StatusIcon className="h-3 w-3" style={{ color: tone.text }} />
        </span>
        <span
          className="text-[12px] font-semibold"
          style={{ color: "var(--fg-primary)" }}
        >
          {dim.name}
        </span>
        {isHardGateViolation ? (
          <span
            className="rounded-full px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.08em]"
            style={{ background: tone.soft, color: tone.text }}
          >
            硬门槛
          </span>
        ) : null}
        <span
          className="ml-auto font-mono text-[11px] tabular-nums"
          style={{ color: tone.text }}
        >
          {dim.score}
        </span>
      </div>
      <div
        className="relative h-1 overflow-hidden rounded-full"
        style={{ background: tone.soft }}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all"
          style={{ width: `${ratio * 100}%`, background: tone.fill }}
        />
      </div>
      {isHardGateViolation && isNecessityGate ? (
        <p
          className="text-[10.5px] leading-[1.5]"
          style={{ color: tone.text }}
        >
          ⚠️ &lt;4 触发一票否决——必须重写概念把代码结构和剧情物理绑死（做&ldquo;替换测试&rdquo;），而非&ldquo;扣分通过&rdquo;。
        </p>
      ) : null}
      {dim.description ? (
        <p
          className="text-[11px] leading-5"
          style={{ color: "var(--fg-secondary)" }}
        >
          {dim.description}
        </p>
      ) : null}
    </li>
  );
}

export function ValidationArtifact({
  report,
  rawContent,
  testId,
}: ValidationArtifactProps) {
  const visual = getConclusionVisual(report);
  const ConclusionIcon = visual.icon;

  const failingDimensions = getFailingDimensions(report);
  const hasDimensionData = report.dimensions.length > 0;

  // Counts derived from the actual scoring table when available; fall back
  // to the legacy heuristic only when the report has no dimension rows.
  let passCount: number;
  let warnCount: number;
  let blockCount: number;
  if (hasDimensionData) {
    passCount = report.dimensions.filter((d) => d.passed).length;
    // Treat a score of 0 as "blocked" and any other partial score as "warning".
    blockCount = failingDimensions.filter((d) => d.scoreValue === 0).length;
    warnCount = failingDimensions.length - blockCount;
  } else {
    blockCount =
      report.conclusion === "不通过，需修改" ? report.risks.length : 0;
    warnCount =
      report.conclusion === "不通过，需修改"
        ? Math.max(report.risks.length - blockCount, 0)
        : report.risks.length;
    passCount = report.conclusion === "通过" ? Math.max(6 - warnCount, 4) : 0;
  }

  return (
    <div data-testid={testId} className="flex flex-col gap-4">
      {/* Conclusion strip */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3"
        style={{
          background: visual.bg,
          boxShadow: `inset 0 0 0 1px ${visual.border}`,
        }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{ background: "var(--surface-card)" }}
          >
            <ConclusionIcon
              className="h-4 w-4"
              style={{ color: visual.ink }}
              strokeWidth={1.75}
            />
          </div>
          <div className="min-w-0">
            <div
              className="text-[14px] font-semibold"
              style={{ color: visual.ink }}
            >
              {visual.title}
            </div>
            <div
              className="text-[11px]"
              style={{ color: visual.ink, opacity: 0.75 }}
            >
              {visual.subtitle}
            </div>
          </div>
        </div>
        <StatStrip
          passCount={passCount}
          warnCount={warnCount}
          blockCount={blockCount}
        />
      </div>

      {/* Two-column: per-dimension scoring / suggestions */}
      {(hasDimensionData ||
        report.risks.length > 0 ||
        report.suggestions.length > 0) ? (
        <div className="grid gap-3 md:grid-cols-[1.1fr_1fr]">
          <div
            className="rounded-2xl p-4"
            style={{
              background: "var(--surface-card)",
              boxShadow: "inset 0 0 0 1px var(--border)",
            }}
          >
            <SectionLabel className="mb-3">5 维评分全景</SectionLabel>
            {hasDimensionData ? (
              <>
                <TotalScoreBar dimensions={report.dimensions} />
                <ul className="flex flex-col gap-1">
                  {report.dimensions.map((dim) => (
                    <DimensionRow key={dim.name} dim={dim} />
                  ))}
                </ul>
              </>
            ) : report.risks.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {report.risks.map((risk, idx) => (
                  <li
                    key={`${idx}-${risk}`}
                    className="flex items-start gap-2.5 rounded-lg px-2 py-1.5"
                  >
                    <span
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                      style={{ background: "var(--accent-soft)" }}
                    >
                      <AlertTriangle
                        className="h-3 w-3"
                        style={{ color: "var(--accent-ink)" }}
                      />
                    </span>
                    <span
                      className="text-[12px] leading-6"
                      style={{ color: "var(--fg-secondary)" }}
                    >
                      {risk}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p
                className="text-[12px]"
                style={{ color: "var(--fg-muted)" }}
              >
                未检测到偏差。
              </p>
            )}
          </div>

          <div
            className="rounded-2xl p-4"
            style={{
              background: "var(--surface-card)",
              boxShadow: "inset 0 0 0 1px var(--border)",
            }}
          >
            <SectionLabel className="mb-3">修改建议</SectionLabel>
            {report.suggestions.length > 0 ? (
              <ol className="flex flex-col gap-2">
                {report.suggestions.map((item, idx) => (
                  <li
                    key={`${idx}-${item}`}
                    className="flex items-start gap-2.5 rounded-lg px-2 py-1.5"
                  >
                    <span
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-semibold"
                      style={{
                        background: "var(--surface-elev)",
                        color: "var(--fg-secondary)",
                      }}
                    >
                      {idx + 1}
                    </span>
                    <span
                      className="text-[12px] leading-6"
                      style={{ color: "var(--fg-secondary)" }}
                    >
                      {item.replace(/^\d+\.\s*/, "")}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p
                className="text-[12px]"
                style={{ color: "var(--fg-muted)" }}
              >
                暂未自动提取到修改建议，请查看原文。
              </p>
            )}
          </div>
        </div>
      ) : null}

      {/* Raw report */}
      <details
        className="rounded-2xl"
        style={{
          background: "var(--surface-card)",
          boxShadow: "inset 0 0 0 1px var(--border)",
        }}
      >
        <summary
          className="cursor-pointer select-none px-4 py-3 text-[12px] font-medium"
          style={{ color: "var(--fg-secondary)" }}
        >
          查看原始验证报告
        </summary>
        <div className="border-t border-[var(--border)] px-4 py-3">
          <div className="prose max-w-none prose-headings:text-[var(--fg-primary)] prose-p:text-[var(--fg-secondary)] prose-li:text-[var(--fg-secondary)] prose-h2:text-[14px] prose-h3:text-[13px]">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {rawContent}
            </ReactMarkdown>
          </div>
        </div>
      </details>
    </div>
  );
}

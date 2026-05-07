"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AlertTriangle, CheckCircle2, ShieldCheck, ShieldAlert } from "lucide-react";
import type {
  DimensionScore,
  ValidationReport,
} from "@/lib/chat/artifactParser";
import { SectionLabel } from "@/components/workspace/primitives/SectionLabel";

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
            <SectionLabel className="mb-3">逐项校验</SectionLabel>
            {hasDimensionData ? (
              failingDimensions.length > 0 ? (
                <ul className="flex flex-col gap-2">
                  {failingDimensions.map((dim) => {
                    const isBlocked = dim.scoreValue === 0;
                    const tone = isBlocked
                      ? {
                          bg: "var(--danger-soft)",
                          ink: "var(--danger-ink)",
                        }
                      : {
                          bg: "var(--accent-soft)",
                          ink: "var(--accent-ink)",
                        };
                    return (
                      <li
                        key={dim.name}
                        className="flex items-start gap-2.5 rounded-lg px-2 py-1.5"
                      >
                        <span
                          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                          style={{ background: tone.bg }}
                        >
                          <AlertTriangle
                            className="h-3 w-3"
                            style={{ color: tone.ink }}
                          />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span
                              className="text-[12px] font-semibold"
                              style={{ color: "var(--fg-primary)" }}
                            >
                              {dim.name}
                            </span>
                            <span
                              className="font-mono text-[11px] tabular-nums"
                              style={{ color: tone.ink }}
                            >
                              {dim.score}
                            </span>
                          </div>
                          {dim.description ? (
                            <p
                              className="mt-0.5 text-[11px] leading-5"
                              style={{ color: "var(--fg-secondary)" }}
                            >
                              {dim.description}
                            </p>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="flex items-start gap-2.5 rounded-lg px-2 py-1.5">
                  <span
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                    style={{ background: "var(--success-soft)" }}
                  >
                    <CheckCircle2
                      className="h-3 w-3"
                      style={{ color: "var(--success-ink)" }}
                    />
                  </span>
                  <span
                    className="text-[12px] leading-6"
                    style={{ color: "var(--fg-secondary)" }}
                  >
                    所有维度均为满分，无扣分项。
                  </span>
                </div>
              )
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

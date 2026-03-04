"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import jsPDF from "jspdf";
import {
  ArrowLeft,
  BarChart3,
  Brain,
  Download,
  Flame,
  Gauge,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Info,
  Loader2,
  ShieldAlert,
  Target,
  TrendingDown,
  TrendingUp,
  Waves,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Define the API response type
interface StockAnalysisResponse {
  analysis_text?: string;
  stock_analysis?: string;
  news?: NewsArticle[];
  analysis_sections?: {
    key?: string;
    title?: string;
    content?: string;
  }[];
  scores?: {
    risk_score?: number;
    risk_level?: string;
    confidence_score?: number;
    buy_probability?: number;
    sell_probability?: number;
  };
  indicators?: {
    price?: {
      current?: number;
      sma_50?: number;
      sma_200?: number;
      ema_20?: number;
      bullish_trend?: boolean;
      trend_alignment?: boolean;
    };
    momentum?: {
      rsi?: number;
      macd?: {
        value?: number;
        signal?: number;
      };
      stochastic?: {
        k?: number;
        d?: number;
      };
    };
    volatility?: {
      atr?: number;
      bollinger?: {
        upper?: number;
        lower?: number;
      };
    };
    volume?: {
      obv?: number;
      volume_ma_20?: number;
      volume_above_avg?: boolean;
      obv_increasing?: boolean;
    };
    fundamentals?: {
      revenue?: number;
      net_income?: number;
      profit_margin?: number;
      debt_ratio?: number;
      free_cash_flow_margin?: number;
      market_cap?: number;
      pe_ratio?: number;
      pb_ratio?: number;
    };
  };
  error?: string;
}

interface NewsArticle {
  title?: string;
  source?: string;
  url?: string;
  published_at?: string;
  description?: string;
}

interface ReportSection {
  key: string;
  title: string;
  content: string;
}

interface ChartPoint {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

const CHART_TIMEFRAMES = ["1W", "1M", "6M", "1Y"] as const;
type ChartTimeframe = (typeof CHART_TIMEFRAMES)[number];

const CHART_RANGE_MAP: Record<ChartTimeframe, string> = {
  "1W": "1w",
  "1M": "1m",
  "6M": "6m",
  "1Y": "1y",
};

const inFlightStockRequests = new Map<string, Promise<StockAnalysisResponse>>();

function stripMarkdownForPdf(content: string): string {
  return content
    .replace(/\r/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1 ($2)")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function sanitizeReportContent(content: string): string {
  return content
    .replace(/\[\^\d+\]/g, "")
    .replace(/^\s*\[\^\d+\]:.*$/gm, "")
    .replace(/^\s*Not enough signal clarity to provide this section\.\s*$/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/(^|\s)_(.+?)_(?=\s|$)/g, "$1$2")
    .replace(/(^|\s)\*(.+?)\*(?=\s|$)/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\$(?=\s*\d)/g, "Rs. ")
    .replace(/₹/g, "Rs. ")
    .replace(/¹/g, "Rs. ")
    .replace(/<\/?sup>/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function fetchStockAnalysis(symbol: string): Promise<StockAnalysisResponse> {
  const existingRequest = inFlightStockRequests.get(symbol);
  if (existingRequest) {
    return existingRequest;
  }

  const request = fetch(`/api/stock/${encodeURIComponent(symbol)}`)
    .then(async (response) => {
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        const message = payload?.error ?? `Error fetching stock data: ${response.statusText}`;
        throw new Error(message);
      }

      return (await response.json()) as StockAnalysisResponse;
    })
    .finally(() => {
      inFlightStockRequests.delete(symbol);
    });

  inFlightStockRequests.set(symbol, request);
  return request;
}

export default function ResultsPage() {
  const searchParams = useSearchParams();
  const symbol = searchParams.get("symbol");
  const [loading, setLoading] = useState(true);
  const [stockData, setStockData] = useState("");
  const [analysisPayload, setAnalysisPayload] = useState<StockAnalysisResponse | null>(null);
  const [error, setError] = useState("");
  const [isMounted, setIsMounted] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [chartLoading, setChartLoading] = useState(false);
  const [activeTimeframe, setActiveTimeframe] = useState<ChartTimeframe>("1M");
  const [chartData, setChartData] = useState<ChartPoint[]>([]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!symbol) {
      setError("No stock symbol provided");
      setLoading(false);
      return;
    }

    async function fetchStockData() {
      try {
        setLoading(true);
        setError("");
        const data = await fetchStockAnalysis(symbol as string);

        if (data.error) {
          throw new Error(data.error);
        }

        const analysisText = data.analysis_text ?? data.stock_analysis;

        if (!analysisText) {
          throw new Error("No analysis data received");
        }

        setStockData(analysisText);
        setAnalysisPayload(data);
      } catch (err) {
        console.error("Error fetching stock data:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch stock data");
        setAnalysisPayload(null);
      } finally {
        setLoading(false);
      }
    }

    fetchStockData();
  }, [symbol]);

  useEffect(() => {
    if (!symbol) return;

    const controller = new AbortController();

    async function fetchChartData() {
      try {
        setChartLoading(true);
        const range = CHART_RANGE_MAP[activeTimeframe];
        const response = await fetch(`/api/stock/${encodeURIComponent(symbol as string)}?range=${range}`, {
          signal: controller.signal,
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch chart data: ${response.statusText}`);
        }

        const payload = (await response.json()) as { chartData?: ChartPoint[] };
        setChartData(Array.isArray(payload.chartData) ? payload.chartData : []);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("Error fetching chart data:", err);
          setChartData([]);
        }
      } finally {
        setChartLoading(false);
      }
    }

    fetchChartData();

    return () => {
      controller.abort();
    };
  }, [symbol, activeTimeframe]);

  const normalizedReport = useMemo(() => stockData.replace(/\r/g, ""), [stockData]);

  const latestPrice = analysisPayload?.indicators?.price?.current ?? null;
  const sma = analysisPayload?.indicators?.price?.sma_50 ?? null;
  const rsi = analysisPayload?.indicators?.momentum?.rsi ?? null;
  const macd = analysisPayload?.indicators?.momentum?.macd?.value ?? null;
  const trendLabel = latestPrice !== null && sma !== null ? (latestPrice >= sma ? "Above SMA" : "Below SMA") : "Unavailable";

  const riskScore = analysisPayload?.scores?.risk_score ?? 0;
  const riskLabel = analysisPayload?.scores?.risk_level ?? "Unavailable";
  const confidenceScore = analysisPayload?.scores?.confidence_score ?? 0;
  const probability = {
    buy: analysisPayload?.scores?.buy_probability ?? 50,
    sell: analysisPayload?.scores?.sell_probability ?? 50,
  };
  const newsArticles = useMemo(() => analysisPayload?.news ?? [], [analysisPayload?.news]);

  const sentiment = useMemo(() => {
    if (probability.buy > probability.sell) return "Bullish";
    if (probability.sell > probability.buy) return "Bearish";
    return "Neutral";
  }, [probability.buy, probability.sell]);

  const sentimentClasses =
    sentiment === "Bullish"
      ? "border-emerald-300/40 bg-emerald-500/15 text-emerald-200"
      : sentiment === "Bearish"
        ? "border-rose-300/40 bg-rose-500/15 text-rose-200"
        : "border-amber-300/40 bg-amber-500/15 text-amber-100";

  const rsiLabel = rsi === null ? "Unavailable" : rsi < 30 ? "Oversold" : rsi > 70 ? "Overbought" : "Neutral";
  const rsiClasses = rsi === null ? "text-slate-200" : rsi < 30 ? "text-red-400" : rsi > 70 ? "text-emerald-400" : "text-amber-300";

  const confidenceColor = confidenceScore < 40 ? "#ef4444" : confidenceScore < 70 ? "#f59e0b" : "#22c55e";


  const lineColor = useMemo(() => {
    if (chartData.length < 2) return "#22c55e";
    return chartData[chartData.length - 1].close > chartData[0].close ? "#22c55e" : "#ef4444";
  }, [chartData]);

  const reportSections = useMemo<ReportSection[]>(() => {
    const structuredSections = analysisPayload?.analysis_sections;
    if (Array.isArray(structuredSections) && structuredSections.length > 0) {
      return structuredSections
        .map((section, index) => ({
          key: section.key ?? `${index}-${section.title ?? "section"}`,
          title: section.title?.trim() || `Section ${index + 1}`,
          content: sanitizeReportContent(section.content ?? "") || "Not enough signal clarity to provide this section.",
        }))
        .filter((section) => section.content.length > 0);
    }

    if (!normalizedReport.trim()) return [];

    const lines = normalizedReport.split("\n");
    const sections: ReportSection[] = [];
    let currentTitle = "Overview";
    let buffer: string[] = [];

    const pushSection = () => {
      const content = sanitizeReportContent(buffer.join("\n"));
      if (content) {
        sections.push({
          key: `${sections.length}-${currentTitle}`,
          title: currentTitle,
          content,
        });
      }
      buffer = [];
    };

    for (const line of lines) {
      const headingMatch = line.match(/^#{2,3}\s+(.+)$/);
      if (headingMatch) {
        pushSection();
        currentTitle = headingMatch[1].trim();
      } else {
        buffer.push(line);
      }
    }
    pushSection();

    const wanted = ["price trend", "momentum", "volatility", "fundamental", "risk"];
    const selected = sections.filter((section) => wanted.some((word) => section.title.toLowerCase().includes(word)));
    return selected.length > 0 ? selected : sections;
  }, [analysisPayload?.analysis_sections, normalizedReport]);

  const metricCards = [
    {
      title: "Latest Price",
      value: latestPrice !== null ? latestPrice.toFixed(2) : "N/A",
      hint: "Current market price",
      icon: <BarChart3 className="h-4 w-4" />,
      accent: "text-blue-300",
    },
    {
      title: "RSI",
      value: rsi !== null ? rsi.toFixed(2) : "N/A",
      hint: rsiLabel,
      icon: <Gauge className="h-4 w-4" />,
      accent: rsiClasses,
    },
    {
      title: "MACD",
      value: macd !== null ? macd.toFixed(2) : "N/A",
      hint: "Momentum signal",
      icon: <Waves className="h-4 w-4" />,
      accent: "text-indigo-300",
    },
    {
      title: "Trend",
      value: trendLabel,
      hint: "Relative to SMA 50",
      icon: trendLabel === "Above SMA" ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />,
      accent: trendLabel === "Above SMA" ? "text-emerald-400" : trendLabel === "Below SMA" ? "text-rose-400" : "text-slate-300",
    },
  ];

  const generatedDate = useMemo(
    () =>
      new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date()),
    []
  );

  const pdfNewsArticles = useMemo(() => newsArticles.slice(0, 5), [newsArticles]);

  const pdfAnalysisSections = useMemo(() => {
    const orderedTitles = [
      "Executive Summary",
      "Trend Position",
      "Momentum Signals",
      "Volatility & Risk Context",
      "Fundamentals Snapshot",
      "Final Interpretation",
    ];

    const sectionMap = new Map(reportSections.map((section) => [section.title, section]));
    const ordered = orderedTitles
      .map((title) => sectionMap.get(title))
      .filter((section): section is ReportSection => Boolean(section));

    return ordered.length > 0 ? ordered : reportSections;
  }, [reportSections]);

  const pdfFormattedSections = useMemo(
    () =>
      pdfAnalysisSections.map((section) => ({
        ...section,
        pdfContent: stripMarkdownForPdf(section.content),
      })),
    [pdfAnalysisSections]
  );

  const chartChangePercent = useMemo(() => {
    if (chartData.length < 2) return null;
    const firstClose = chartData[0].close;
    const lastClose = chartData[chartData.length - 1].close;
    if (!Number.isFinite(firstClose) || firstClose === 0 || !Number.isFinite(lastClose)) return null;
    return ((lastClose - firstClose) / firstClose) * 100;
  }, [chartData]);

  const reportOutlookLine = useMemo(() => {
    const riskTone = riskScore >= 70 ? "elevated" : riskScore >= 40 ? "moderate" : "contained";
    const confidenceTone = confidenceScore >= 70 ? "high" : confidenceScore >= 40 ? "balanced" : "limited";
    return `${symbol ?? "This stock"} shows a ${sentiment.toLowerCase()} directional bias with ${riskTone} risk and ${confidenceTone} confidence.`;
  }, [confidenceScore, riskScore, sentiment, symbol]);

  const handleDownloadPdf = async () => {
    if (!symbol) return;

    try {
      setIsExporting(true);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: "a4",
        compress: true,
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const marginX = 36;
      const topY = 36;
      const footerY = pageHeight - 22;
      const footerRuleY = pageHeight - 34;
      const contentBottomY = pageHeight - 42;
      const contentWidth = pageWidth - marginX * 2;
      let cursorY = topY;

      const ensureSpace = (requiredHeight: number) => {
        if (cursorY + requiredHeight > contentBottomY) {
          pdf.addPage();
          cursorY = topY;
        }
      };

      const writeWrapped = (
        text: string,
        fontSize = 11,
        style: "normal" | "bold" = "normal",
        lineHeight = 14,
        color: [number, number, number] = [30, 41, 59]
      ) => {
        if (!text.trim()) return;
        pdf.setTextColor(color[0], color[1], color[2]);
        pdf.setFont("helvetica", style);
        pdf.setFontSize(fontSize);
        const lines = pdf.splitTextToSize(text, contentWidth) as string[];
        for (const line of lines) {
          ensureSpace(lineHeight);
          pdf.text(line, marginX, cursorY);
          cursorY += lineHeight;
        }
      };

      const addGap = (height = 8) => {
        ensureSpace(height);
        cursorY += height;
      };

      const writeSectionTitle = (title: string) => {
        ensureSpace(34);
        pdf.setFillColor(239, 246, 255);
        pdf.roundedRect(marginX - 4, cursorY - 15, contentWidth + 8, 24, 6, 6, "F");
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(14);
        pdf.setTextColor(30, 64, 175);
        pdf.text(title, marginX, cursorY);
        cursorY += 13;
        pdf.setDrawColor(226, 232, 240);
        pdf.line(marginX, cursorY, pageWidth - marginX, cursorY);
        cursorY += 10;
      };

      ensureSpace(102);
      const brandCardX = marginX;
      const brandCardY = cursorY - 6;
      const brandCardWidth = contentWidth;
      const brandCardHeight = 64;
      pdf.setFillColor(2, 6, 23);
      pdf.roundedRect(brandCardX, brandCardY, brandCardWidth, brandCardHeight, 8, 8, "F");

      const iconX = brandCardX + 14;
      const iconY = brandCardY + 24;
      pdf.setDrawColor(56, 189, 248);
      pdf.setLineWidth(2.2);
      pdf.line(iconX, iconY + 14, iconX + 10, iconY + 4);
      pdf.line(iconX + 10, iconY + 4, iconX + 17, iconY + 11);
      pdf.line(iconX + 17, iconY + 11, iconX + 24, iconY + 1);
      pdf.line(iconX + 19, iconY + 1, iconX + 24, iconY + 1);
      pdf.line(iconX + 24, iconY + 1, iconX + 24, iconY + 6);

      pdf.setTextColor(241, 245, 249);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(28);
      pdf.text("StockAssist", brandCardX + 42, brandCardY + 30);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(12);
      pdf.setTextColor(148, 163, 184);
      pdf.text("AI-Powered Stock Intelligence Report", brandCardX + 42, brandCardY + 50);
      cursorY += 72;

      const infoDescriptionLines = pdf.splitTextToSize(reportOutlookLine, contentWidth - 20) as string[];
      const infoCardHeight = 74;

      pdf.setFillColor(239, 246, 255);
      pdf.roundedRect(marginX, cursorY - 4, contentWidth, infoCardHeight, 6, 6, "F");
      pdf.setTextColor(30, 64, 175);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.text(`Symbol: ${symbol}`, marginX + 10, cursorY + 12);
      pdf.text(`Generated On: ${generatedDate}`, marginX + 10, cursorY + 30);
      const outlookText = `Market Outlook: ${sentiment}`;
      const outlookWidth = pdf.getTextWidth(outlookText);
      pdf.text(outlookText, pageWidth - marginX - 10 - outlookWidth, cursorY + 12);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(51, 65, 85);
      pdf.setFontSize(10);
      const visibleInfoLines = infoDescriptionLines.slice(0, 2);
      visibleInfoLines.forEach((line, index) => {
        pdf.text(line, marginX + 10, cursorY + 48 + index * 12);
      });
      cursorY += infoCardHeight + 8;

      ensureSpace(64);
      pdf.setFillColor(254, 242, 242);
      pdf.setDrawColor(252, 165, 165);
      pdf.roundedRect(marginX, cursorY - 4, contentWidth, 52, 6, 6, "FD");
      pdf.setTextColor(185, 28, 28);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.text("Disclosure", marginX + 10, cursorY + 12);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9.5);
      const disclosureLine1 = "This report is generated from model-based analysis and is intended for informational use only.";
      const disclosureLine2 = "It is not financial advice, investment recommendation, or a guarantee of future performance.";
      pdf.text(disclosureLine1, marginX + 10, cursorY + 27);
      pdf.text(disclosureLine2, marginX + 10, cursorY + 40);
      cursorY += 62;

      addGap(10);
      writeSectionTitle("Section 1 — Investment Snapshot");
      const snapshotLines = [
        `Current Price: ${latestPrice !== null ? `Rs. ${latestPrice.toFixed(2)}` : "N/A"}`,
        `RSI: ${rsi !== null ? rsi.toFixed(2) : "N/A"}`,
        `MACD: ${macd !== null ? macd.toFixed(2) : "N/A"}`,
        `Trend: ${trendLabel}`,
        `Risk Score: ${riskScore}%`,
        `Confidence Score: ${confidenceScore}%`,
        `Buy vs Sell: ${probability.buy}% / ${probability.sell}%`,
        `1M Price Move: ${chartChangePercent !== null ? `${chartChangePercent >= 0 ? "+" : ""}${chartChangePercent.toFixed(2)}%` : "N/A"}`,
      ];
      for (const line of snapshotLines) {
        writeWrapped(`• ${line}`, 11, "normal", 14);
      }

      addGap(8);
      writeSectionTitle("Section 2 — AI Analysis");
      if (pdfFormattedSections.length === 0) {
        writeWrapped("No analysis sections available in this report.", 11, "normal", 14);
      } else {
        for (const section of pdfFormattedSections) {
          writeWrapped(section.title, 12, "bold", 16);
          const blocks = section.pdfContent
            .split(/\n{2,}/)
            .map((block) => block.trim())
            .filter((block) => block.length > 0);

          if (blocks.length === 0) {
            writeWrapped("Not enough signal clarity to provide this section.", 11, "normal", 14);
          } else {
            for (const block of blocks) {
              writeWrapped(block, 10.5, "normal", 14);
              addGap(14);
            }
          }
          addGap(8);
        }
      }

      writeSectionTitle("Section 3 — Actionable Highlights");
      writeWrapped(`• Directional Bias: ${sentiment} (${probability.buy}% buy probability)`, 11, "normal", 14);
      writeWrapped(`• Risk Stance: ${riskLabel} risk (${riskScore}/100)`, 11, "normal", 14);
      writeWrapped(`• Momentum Read: RSI ${rsi !== null ? rsi.toFixed(2) : "N/A"}, MACD ${macd !== null ? macd.toFixed(2) : "N/A"}`, 11, "normal", 14);
      writeWrapped(`• Trend Context: ${trendLabel} relative to SMA 50`, 11, "normal", 14);

      writeSectionTitle("Section 4 — Latest News");
      if (pdfNewsArticles.length === 0) {
        writeWrapped("No recent market news found for this symbol.", 11, "normal", 14);
      } else {
        pdfNewsArticles.forEach((article, index) => {
          writeWrapped(`${index + 1}. ${article.title ?? "Untitled article"}`, 11, "bold", 14);
          writeWrapped(`${article.source ?? "Unknown source"}${article.published_at ? ` — ${new Date(article.published_at).toLocaleDateString("en-IN", { timeZone: "UTC" })}` : ""}`, 10, "normal", 13);
          if (article.description) writeWrapped(article.description, 10, "normal", 13);
          if (article.url) writeWrapped(article.url, 9.5, "normal", 12, [37, 99, 235]);
          addGap(5);
        });
      }

      const pageCount = pdf.getNumberOfPages();
      for (let page = 1; page <= pageCount; page++) {
        pdf.setPage(page);
        pdf.setDrawColor(226, 232, 240);
        pdf.line(marginX, footerRuleY, pageWidth - marginX, footerRuleY);
        pdf.setTextColor(71, 85, 105);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.text("Generated by StockAssist", marginX, footerY - 4);
        pdf.text("For informational purposes only. Not investment advice.", marginX, footerY + 7);
        const dateTextWidth = pdf.getTextWidth(generatedDate);
        pdf.text(generatedDate, pageWidth / 2 - dateTextWidth / 2, footerY - 4);
        const pageLabel = `Page ${page} of ${pageCount}`;
        const pageLabelWidth = pdf.getTextWidth(pageLabel);
        pdf.text(pageLabel, pageWidth - marginX - pageLabelWidth, footerY - 4);
      }

      pdf.save(`stockassist-report-${symbol}.pdf`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      className={`relative min-h-screen overflow-hidden bg-gradient-to-b from-slate-950 via-blue-950 to-indigo-950 text-white transition-all duration-700 ${
        isMounted ? "opacity-100" : "translate-y-2 opacity-0"
      }`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.22),transparent_35%),radial-gradient(circle_at_80%_10%,rgba(99,102,241,0.18),transparent_35%),radial-gradient(circle_at_50%_80%,rgba(14,165,233,0.12),transparent_45%)]" />

      <div className="dashboard-ui">
      <header className="sticky top-0 z-20 w-full border-b border-white/10 bg-slate-950/60 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-blue-400" />
            <span className="text-xl font-semibold tracking-tight">StockAssist</span>
          </Link>

          <Button
            onClick={handleDownloadPdf}
            disabled={isExporting || loading || Boolean(error)}
            className="rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-900/30 transition-all duration-200 hover:scale-[1.01] hover:from-blue-400 hover:to-indigo-500"
          >
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating PDF...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Download PDF
              </>
            )}
          </Button>
        </div>
      </header>
      <main className="relative z-10 flex-1 py-16">
        <div className="mx-auto max-w-6xl space-y-12 px-6">
          <div className="mb-8 flex items-center justify-between gap-4">
            <Button
              variant="outline"
              size="sm"
              asChild
              className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            >
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Search
              </Link>
            </Button>

            {symbol && (
              <div className="rounded-full border border-blue-300/20 bg-blue-400/10 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.2em] text-blue-200">
                {symbol}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-rose-300/40 bg-rose-500/15 px-4 py-3 text-center shadow-sm">
            <p className="animate-pulse text-sm font-semibold tracking-wide text-rose-100">
              Disclaimer: This analysis is for informational purposes only and is not financial or investment advice.
            </p>
          </div>

          {loading ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-12 text-center shadow-2xl backdrop-blur-sm">
              <div className="mx-auto h-16 w-16 rounded-full border-4 border-blue-300/40 border-t-blue-400 animate-spin" />
              <p className="mt-5 text-slate-200">Generating stock analysis for {symbol}...</p>
            </div>
          ) : error ? (
            <div className="rounded-3xl border border-rose-300/25 bg-rose-300/10 p-8 text-center shadow-xl backdrop-blur-sm">
              <h2 className="mb-2 text-2xl font-semibold text-rose-200">Error</h2>
              <p className="text-sm text-rose-100/90">{error}</p>
              <Button
                className="mt-5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-900/30 transition-all duration-200 hover:scale-[1.01] hover:from-blue-400 hover:to-indigo-500"
                asChild
              >
                <Link href="/">Try Another Search</Link>
              </Button>
            </div>
          ) : (
            <div id="report-content" className="space-y-8">
              <Card className="rounded-3xl border border-white/20 bg-white/10 text-white shadow-xl backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-2xl">
                <CardHeader className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-200">StockAssist</p>
                      <CardTitle className="mt-2 text-3xl font-bold tracking-tight text-white">Stock Analysis Report</CardTitle>
                      <p className="mt-2 text-sm text-slate-300">AI-Powered Stock Intelligence</p>
                      <p className="mt-1 text-sm text-slate-300">Investment Report: {symbol}</p>
                    </div>
                    <Badge className={`border ${sentimentClasses}`}>{sentiment}</Badge>
                  </div>
                  <div className="h-px w-full bg-white/20" />
                </CardHeader>
              </Card>

              <div className="grid gap-6 lg:grid-cols-3">
                <Card className="rounded-3xl border border-slate-800 bg-[#0f172a] shadow-2xl lg:col-span-1">
                  <CardHeader>
                    <CardTitle className="text-xl font-semibold text-white">Price Trend</CardTitle>
                    <div className="flex flex-wrap gap-2">
                      {CHART_TIMEFRAMES.map((timeframe) => (
                        <Button
                          key={timeframe}
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setActiveTimeframe(timeframe)}
                          className={
                            activeTimeframe === timeframe
                              ? "border-emerald-500/40 bg-emerald-600 text-white hover:bg-emerald-500"
                              : "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white"
                          }
                        >
                          {timeframe}
                        </Button>
                      ))}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {chartLoading ? (
                      <div className="flex h-64 items-center justify-center text-sm text-slate-300">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading chart...
                      </div>
                    ) : chartData.length > 0 ? (
                      <div className="h-64 w-full overflow-hidden rounded-3xl shadow-md">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 8 }}>
                            <defs>
                              <linearGradient id="chartLineFill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={lineColor} stopOpacity={0.28} />
                                <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid stroke="rgba(148,163,184,0.15)" strokeDasharray="3 3" />
                            <XAxis dataKey="time" tick={{ fill: "#94a3b8", fontSize: 10 }} stroke="#334155" minTickGap={24} />
                            <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} stroke="#334155" domain={["auto", "auto"]} width={48} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "#0f172a",
                                border: "1px solid rgba(148,163,184,0.3)",
                                borderRadius: "12px",
                                color: "#e2e8f0",
                              }}
                              formatter={(value: number | string | undefined, name: string | undefined) => [value !== undefined ? Number(value).toFixed(2) : "N/A", (name ?? "").toUpperCase()]}
                            />
                            <Line
                              type="monotone"
                              dataKey="close"
                              stroke={lineColor}
                              strokeWidth={3}
                              dot={false}
                              isAnimationActive
                              animationDuration={600}
                            />
                            <Line
                              type="monotone"
                              dataKey="close"
                              stroke="url(#chartLineFill)"
                              strokeWidth={12}
                              dot={false}
                              strokeOpacity={0.35}
                              isAnimationActive={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>

                <Card className="rounded-3xl border border-white/20 bg-white/10 shadow-xl backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-2xl lg:col-span-1">
                  <CardHeader>
                    <CardTitle className="text-xl font-semibold text-white">Signal Strength</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="relative h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadialBarChart
                          data={[{ name: "confidence", value: confidenceScore, fill: confidenceColor }]}
                          innerRadius="55%"
                          outerRadius="100%"
                          startAngle={180}
                          endAngle={0}
                          barSize={22}
                        >
                          <RadialBar background dataKey="value" cornerRadius={20} />
                        </RadialBarChart>
                      </ResponsiveContainer>
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 pt-8">
                        <Brain className="h-5 w-5 text-blue-300" />
                        <p className="text-xs uppercase tracking-wider text-slate-300">Signal Strength</p>
                        <p className="text-3xl font-bold text-white">{confidenceScore}%</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-3xl border border-white/20 bg-white/10 shadow-xl backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-2xl lg:col-span-1">
                  <CardHeader>
                    <CardTitle className="text-xl font-semibold text-white">Probability Outlook</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="relative h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: "Buy", value: probability.buy, fill: "#22c55e" },
                              { name: "Sell", value: probability.sell, fill: "#ef4444" },
                            ]}
                            innerRadius={62}
                            outerRadius={98}
                            paddingAngle={2}
                            dataKey="value"
                          >
                            <Cell fill="#22c55e" />
                            <Cell fill="#ef4444" />
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#0f172a",
                              border: "1px solid rgba(148,163,184,0.3)",
                              borderRadius: "12px",
                              color: "#e2e8f0",
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                        <Target className="h-5 w-5 text-blue-300" />
                        <p className="mt-1 text-xs uppercase tracking-wider text-slate-300">Buy / Sell</p>
                        <p className="text-lg font-semibold text-emerald-300">{probability.buy}% / {probability.sell}%</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="rounded-3xl border border-white/20 bg-white/10 shadow-xl backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-2xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl font-semibold text-white">
                    <ShieldAlert className="h-5 w-5 text-amber-300" />
                    Risk Gauge
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-5">
                    <div className="relative h-4 overflow-hidden rounded-full bg-slate-800">
                      <div className="h-full w-full bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500" />
                      <div
                        className="absolute top-1/2 h-6 w-1.5 -translate-y-1/2 rounded-full bg-white shadow"
                        style={{ left: `calc(${riskScore}% - 3px)` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-300">
                      <span>Low Risk</span>
                      <span>Moderate</span>
                      <span>High Risk</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-slate-300">Risk Level</p>
                      <Badge className="border border-white/20 bg-white/10 text-white">{riskLabel} ({riskScore}%)</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-3xl border border-white/20 bg-white/10 shadow-xl backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-2xl">
                <CardHeader>
                  <CardTitle className="text-xl font-semibold text-white">Summary Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {metricCards.map((item) => (
                      <div key={item.title} className="rounded-2xl border border-white/20 bg-white/10 p-4 shadow-sm backdrop-blur-sm">
                        <div className="mb-2 flex items-center gap-2 text-slate-200">
                          {item.icon}
                          <p className="text-xs font-medium uppercase tracking-wide">{item.title}</p>
                        </div>
                        <p className={`text-xl font-bold ${item.accent}`}>{item.value}</p>
                        <p className="mt-1 text-xs text-slate-300">{item.hint}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {rsi !== null && rsi < 30 && <Badge className="bg-rose-100 text-rose-700">Oversold</Badge>}
                    {rsi !== null && rsi > 70 && <Badge className="bg-emerald-100 text-emerald-700">Overbought</Badge>}
                    {macd !== null && <Badge className="bg-indigo-100 text-indigo-700">Strong Momentum</Badge>}
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-3xl border border-white/20 bg-white/10 shadow-xl backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-2xl">
                <CardHeader>
                  <CardTitle className="text-xl font-semibold text-white">Market News</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  {newsArticles.length > 0 ? (
                    <div className="space-y-3">
                      {newsArticles.map((article, index) => (
                        <a
                          key={`${article.url ?? article.title ?? "article"}-${index}`}
                          href={article.url ?? "#"}
                          target="_blank"
                          rel="noreferrer"
                          className="block rounded-2xl border border-white/15 bg-white/5 p-4 transition-colors hover:border-blue-300/40 hover:bg-white/10"
                        >
                          <p className="text-sm font-semibold leading-snug text-white">{article.title ?? "Untitled article"}</p>
                          <p className="mt-1 text-xs text-slate-300">
                            {article.source ?? "Unknown source"}
                            {article.published_at ? ` • ${new Date(article.published_at).toLocaleString()}` : ""}
                          </p>
                          {article.description && <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-300">{article.description}</p>}
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-white/15 bg-white/5 p-4 text-sm text-slate-300">
                      No recent market news found for this symbol.
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="space-y-8">
                {reportSections.map((section) => (
                  <Card
                    key={section.key}
                    className="rounded-3xl border border-white/20 bg-white/10 shadow-xl backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-2xl"
                  >
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-xl font-semibold text-white">
                        <Flame className="h-5 w-5 text-blue-500" />
                        {section.title}
                      </CardTitle>
                      <div className="h-px w-full bg-white/15" />
                    </CardHeader>
                    <CardContent className="text-lg leading-relaxed text-slate-100">
                      <div className="prose prose-invert max-w-none prose-p:mb-6 prose-p:text-lg prose-p:leading-relaxed">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            table: ({ children }) => (
                              <div className="my-8 overflow-x-auto rounded-xl border border-white/20">
                                <table className="min-w-full divide-y divide-white/20">{children}</table>
                              </div>
                            ),
                            th: ({ children }) => (
                              <th className="bg-white/10 px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-200">
                                {children}
                              </th>
                            ),
                            td: ({ children }) => <td className="px-6 py-4 text-sm text-slate-100">{children}</td>,
                            tr: ({ children }) => <tr className="bg-transparent even:bg-white/5">{children}</tr>,
                            strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
                            em: ({ children }) => <span className="text-slate-100 not-italic">{children}</span>,
                            code: ({ children }) => <span className="text-slate-100 font-normal">{children}</span>,
                            sup: ({ children }) => <span>{children}</span>,
                          }}
                        >
                          {section.content}
                        </ReactMarkdown>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* <Card className="rounded-2xl border border-amber-300/30 bg-amber-100/90 text-slate-800 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start gap-2">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                    <p className="text-sm leading-relaxed text-slate-700">
                      This analysis is generated for informational purposes only and does not constitute financial or
                      investment advice. Always conduct your own research before making investment decisions.
                    </p>
                  </div>
                </CardContent>
              </Card> */}
            </div>
          )}
        </div>
      </main>

      <footer className="relative z-10 border-t border-white/10 py-6">
        <div className="container text-center text-sm text-slate-400">
          <p>&copy; {new Date().getFullYear()} StockAssist. All rights reserved.</p>
        </div>
      </footer>
      </div>
    </div>
  );
}

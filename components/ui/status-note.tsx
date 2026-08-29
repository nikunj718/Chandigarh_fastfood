import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatusNote({ tone = "info", children }: { tone?: "info" | "error" | "success"; children: React.ReactNode }) {
  const Icon = tone === "error" ? AlertCircle : tone === "success" ? CheckCircle2 : Info;
  return <div className={cn("flex gap-2 rounded-xl px-3 py-2 text-sm", tone === "error" && "bg-red-50 text-red-700", tone === "success" && "bg-emerald-50 text-emerald-700", tone === "info" && "bg-orange-50 text-orange-800")}><Icon className="mt-0.5 h-4 w-4 shrink-0" />{children}</div>;
}

import { Badge } from "@/components/ui";
import type { Achievement, ValueStatus } from "@/lib/calc";
import {
  ACHIEVEMENT_LABEL,
  DEAL_STATUS_LABEL,
  POC_STATUS_LABEL,
  VALUE_STATUS_LABEL,
  type DealStatus,
  type PocStatus,
} from "@/lib/format";

const ACHIEVEMENT_TONE = { wip: "neutral", achieved: "good", partial: "warn", not_achieved: "bad" } as const;
// On Hold = warn karena POC berhenti dan butuh keputusan
const STATUS_TONE = {
  upcoming: "neutral",
  running: "info",
  on_hold: "warn",
  done: "good",
  cancelled: "neutral",
} as const;
const DEAL_TONE = { awaiting_deal: "warn", won: "good", lost: "bad" } as const;

export function DealBadge({ value }: { value: DealStatus | null }) {
  if (!value) return <span className="text-muted">Belum diisi</span>;
  return <Badge tone={DEAL_TONE[value]}>{DEAL_STATUS_LABEL[value]}</Badge>;
}
const VALUE_TONE = { met: "good", partial: "warn", not_met: "bad" } as const;

export function AchievementBadge({ value, overridden }: { value: Achievement; overridden?: boolean }) {
  return (
    <Badge tone={ACHIEVEMENT_TONE[value]}>
      {ACHIEVEMENT_LABEL[value]}
      {overridden && " (override)"}
    </Badge>
  );
}

export function StatusBadge({ value }: { value: PocStatus }) {
  return <Badge tone={STATUS_TONE[value]}>{POC_STATUS_LABEL[value]}</Badge>;
}

export function ValueBadge({ value }: { value: ValueStatus }) {
  return <Badge tone={VALUE_TONE[value]}>{VALUE_STATUS_LABEL[value]}</Badge>;
}

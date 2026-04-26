import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type Lang, t } from "@/lib/i18n";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

/**
 * Compact horizontal volume control. Designed to live under the AAFCO panel —
 * the user rarely changes the starting volume after the first edit, so this is
 * tucked out of the main composition flow.
 */
export function StartingVolumeStrip({
  startingVolume,
  setStartingVolume,
  used,
  lang,
}: {
  startingVolume: number;
  setStartingVolume: (v: number) => void;
  used: number;
  lang: Lang;
}) {
  const remaining = startingVolume - used;
  const percentUsed = startingVolume > 0 ? Math.min((used / startingVolume) * 100, 100) : 0;
  const overflow = used > startingVolume;
  // Default to collapsed; user rarely changes this after first edit.
  const [expanded, setExpanded] = useState<boolean>(false);

  return (
    <Card className="p-4 space-y-3">
      {/* Header (always visible). When collapsed, shows compact summary. */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => setExpanded((x) => !x)}
          className="flex-1 flex items-center justify-between gap-3 text-left"
        >
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground whitespace-nowrap cursor-pointer">
            {t("starting_volume", lang)}
          </Label>
          <div className="flex items-center gap-3 text-xs">
            <span data-numeric="true" className="text-foreground font-medium">{startingVolume}g</span>
            <span className="text-muted-foreground">
              {t("used", lang)}:{" "}
              <span data-numeric="true" className="text-foreground font-medium">{used.toFixed(0)}g</span>
            </span>
            <span className={overflow ? "text-destructive font-medium" : "text-muted-foreground"}>
              <span data-numeric="true" className="font-medium">{remaining.toFixed(0)}g</span> {t("remaining", lang)}
            </span>
          </div>
        </button>
        <Button variant="ghost" size="sm" onClick={() => setExpanded((x) => !x)} className="h-7 w-7 p-0">
          {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </Button>
      </div>

      {/* Always show progress bar so the visual signal is never hidden. */}
      <div className="relative h-1.5 bg-secondary rounded-full overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 ${overflow ? "bg-destructive" : "bg-primary"} transition-all`}
          style={{ width: `${percentUsed}%` }}
        />
      </div>

      {/* Expanded: edit input + over-volume warning */}
      {expanded && (
        <div className="flex items-center gap-3 pt-2 border-t border-border/60">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">{t("starting_volume", lang)}</Label>
          <Input
            type="number"
            min={1}
            step={50}
            data-numeric="true"
            value={startingVolume}
            onChange={(e) => setStartingVolume(parseFloat(e.target.value) || 0)}
            className="h-8 w-32"
          />
          <span className="text-xs text-muted-foreground" data-numeric="true">g</span>
          {overflow && (
            <span className="ml-auto text-[10px] uppercase tracking-wider text-destructive font-medium">
              {t("over_volume", lang)}
            </span>
          )}
        </div>
      )}
    </Card>
  );
}

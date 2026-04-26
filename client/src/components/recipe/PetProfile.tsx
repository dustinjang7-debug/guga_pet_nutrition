import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { type Lang, t } from "@/lib/i18n";
import {
  CAT_LIFE_STAGES, DOG_LIFE_STAGES,
  type CatLifeStage, type DogLifeStage, type LifeStageFactor, type Species,
} from "@shared/aafco";
import { Cat, Dog } from "lucide-react";

export interface PetProfileState {
  species: Species;
  bodyWeightKg: number;
  lifeStageKey: string; // DogLifeStage | CatLifeStage
  factor: number;
  feedingMode: "normal" | "weight_loss";
  petName: string;
  petId: string;
}

export function defaultPetProfile(): PetProfileState {
  return {
    species: "dog",
    bodyWeightKg: 10,
    lifeStageKey: "adult_neutered",
    factor: DOG_LIFE_STAGES.adult_neutered.factor,
    feedingMode: "normal",
    petName: "",
    petId: "",
  };
}

function lifeStagesFor(species: Species): LifeStageFactor[] {
  return Object.values(species === "dog" ? DOG_LIFE_STAGES : CAT_LIFE_STAGES);
}

function lifeStageLabel(s: LifeStageFactor, lang: Lang): string {
  if (lang === "zh") return s.label_zh;
  if (lang === "th") return s.label_th;
  return s.label_en;
}

export function PetProfilePane({
  value,
  onChange,
  lang,
}: {
  value: PetProfileState;
  onChange: (v: PetProfileState) => void;
  lang: Lang;
}) {
  const stages = lifeStagesFor(value.species);
  const currentStage = stages.find((s) => s.key === value.lifeStageKey) ?? stages[0];
  const hasRange = currentStage?.min !== undefined && currentStage?.max !== undefined;

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">{t("pet_profile", lang)}</h2>
      </div>

      {/* Species toggle */}
      <div className="grid grid-cols-2 gap-2">
        {(["dog", "cat"] as Species[]).map((sp) => (
          <button
            key={sp}
            onClick={() => {
              const stages2 = lifeStagesFor(sp);
              const newStage = stages2.find((s) => s.key === value.lifeStageKey) ?? stages2[1];
              onChange({
                ...value,
                species: sp,
                lifeStageKey: newStage.key,
                factor: newStage.factor,
              });
            }}
            className={`flex items-center justify-center gap-2 py-3 rounded-md border transition-all ${
              value.species === sp
                ? "border-primary bg-primary/5 text-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {sp === "dog" ? <Dog className="size-4" /> : <Cat className="size-4" />}
            <span className="text-sm font-medium">{sp === "dog" ? t("species_dog", lang) : t("species_cat", lang)}</span>
          </button>
        ))}
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">{t("body_weight", lang)}</Label>
        <Input
          type="number"
          min={0.1}
          max={200}
          step={0.1}
          data-numeric="true"
          value={value.bodyWeightKg}
          onChange={(e) => onChange({ ...value, bodyWeightKg: parseFloat(e.target.value) || 0 })}
          className="mt-1.5"
        />
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">{t("life_stage", lang)}</Label>
        <Select
          value={value.lifeStageKey}
          onValueChange={(v) => {
            const s = stages.find((x) => x.key === v);
            if (s) onChange({ ...value, lifeStageKey: v, factor: s.factor });
          }}
        >
          <SelectTrigger className="mt-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {stages.map((s) => (
              <SelectItem key={s.key} value={s.key}>
                {lifeStageLabel(s, lang)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">
          {t("life_stage_factor", lang)}
          {hasRange ? ` (${currentStage.min} – ${currentStage.max})` : ""}
        </Label>
        <Input
          type="number"
          min={hasRange ? currentStage.min : currentStage.factor}
          max={hasRange ? currentStage.max : currentStage.factor}
          step={0.1}
          data-numeric="true"
          value={value.factor}
          onChange={(e) => onChange({ ...value, factor: parseFloat(e.target.value) || 0 })}
          disabled={!hasRange}
          className="mt-1.5"
        />
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">{t("feeding_mode", lang)}</Label>
        <div className="grid grid-cols-2 gap-2 mt-1.5">
          {(["normal", "weight_loss"] as const).map((m) => (
            <button
              key={m}
              onClick={() => onChange({ ...value, feedingMode: m })}
              className={`py-2 rounded-md border text-sm transition-all ${
                value.feedingMode === m
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "normal" ? t("feeding_normal", lang) : t("feeding_weight_loss", lang)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/60">
        <div>
          <Label className="text-xs text-muted-foreground">{t("pet_name", lang)}</Label>
          <Input
            value={value.petName}
            onChange={(e) => onChange({ ...value, petName: e.target.value })}
            className="mt-1.5"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">{t("pet_id", lang)}</Label>
          <Input
            value={value.petId}
            onChange={(e) => onChange({ ...value, petId: e.target.value })}
            className="mt-1.5"
          />
        </div>
      </div>
    </Card>
  );
}

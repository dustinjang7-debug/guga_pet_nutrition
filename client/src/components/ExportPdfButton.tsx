/**
 * Export-recipe-as-PDF button.
 *
 * Opens a dialog where the user picks language (EN / ZH / TH), then calls
 * `trpc.recipes.exportPdf` and triggers a browser download.
 *
 * Disabled when `recipeId` is undefined (i.e. recipe hasn't been saved yet) —
 * the server needs a persisted recipe to read.
 */

import { useState } from "react";
import { Download, FileText } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { t, useLang } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";

interface Props {
  recipeId: number | undefined;
  /** "ghost" or "outline" depending on host surface. */
  variant?: "outline" | "ghost" | "default" | "secondary";
  size?: "sm" | "default";
  className?: string;
}

type Lang = "en" | "zh" | "th";

export function ExportPdfButton({ recipeId, variant = "outline", size = "sm", className }: Props) {
  const [uiLang] = useLang();
  const [open, setOpen] = useState(false);
  const [pdfLang, setPdfLang] = useState<Lang>(uiLang);

  const exportMut = trpc.recipes.exportPdf.useMutation({
    onSuccess: ({ base64, filename }) => {
      // Decode base64 -> Blob -> trigger download
      const bytes = atob(base64);
      const buf = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
      const blob = new Blob([buf], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(t("export_pdf_success", uiLang));
      setOpen(false);
    },
    onError: (err) => {
      toast.error(`${t("export_pdf_failed", uiLang)}: ${err.message}`);
    },
  });

  const disabled = recipeId === undefined;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={className}
          disabled={disabled}
          title={disabled ? t("export_pdf_save_first", uiLang) : undefined}
        >
          <FileText className="size-4" />
          {t("export_pdf", uiLang)}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{t("export_pdf_title", uiLang)}</DialogTitle>
          <DialogDescription>
            {t("export_pdf_description", uiLang)}
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <Label className="mb-2 block text-sm font-medium">
            {t("export_pdf_language", uiLang)}
          </Label>
          <RadioGroup value={pdfLang} onValueChange={(v) => setPdfLang(v as Lang)}>
            {[
              ["en", "English"],
              ["zh", "中文 (简体)"],
              ["th", "ภาษาไทย"],
            ].map(([code, label]) => (
              <div key={code} className="flex items-center gap-2 py-1">
                <RadioGroupItem value={code} id={`pdf-lang-${code}`} />
                <Label htmlFor={`pdf-lang-${code}`} className="cursor-pointer font-normal">
                  {label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={exportMut.isPending}>
            {t("cancel", uiLang)}
          </Button>
          <Button
            onClick={() => recipeId !== undefined && exportMut.mutate({ id: recipeId, lang: pdfLang })}
            disabled={exportMut.isPending || disabled}
          >
            <Download className="size-4" />
            {exportMut.isPending ? t("export_pdf_generating", uiLang) : t("export_pdf_download", uiLang)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

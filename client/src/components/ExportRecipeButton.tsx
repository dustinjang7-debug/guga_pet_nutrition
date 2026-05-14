/**
 * Export menu — PDF (with embedded importable data) or `.guga.json` file.
 *
 * Combines what used to be ExportPdfButton with the new portable-recipe-file
 * export. PDF still asks for a language; the JSON file is single-action.
 */

import { useState } from "react";
import { Download, FileJson, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { t, useLang } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";

interface Props {
  recipeId: number | undefined;
  variant?: "outline" | "ghost" | "default" | "secondary";
  size?: "sm" | "default";
  className?: string;
}

type Lang = "en" | "zh" | "th";

function downloadBase64(base64: string, filename: string, mime: string) {
  const bytes = atob(base64);
  const buf = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
  const blob = new Blob([buf], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function ExportRecipeButton({ recipeId, variant = "outline", size = "sm", className }: Props) {
  const [uiLang] = useLang();
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [pdfLang, setPdfLang] = useState<Lang>(uiLang);

  const exportPdfMut = trpc.recipes.exportPdf.useMutation({
    onSuccess: ({ base64, filename }) => {
      downloadBase64(base64, filename, "application/pdf");
      toast.success(t("export_pdf_success", uiLang));
      setPdfDialogOpen(false);
    },
    onError: (err) => toast.error(`${t("export_pdf_failed", uiLang)}: ${err.message}`),
  });

  const exportFileMut = trpc.recipes.exportRecipeFile.useMutation({
    onSuccess: ({ base64, filename }) => {
      downloadBase64(base64, filename, "application/json");
      toast.success("Recipe file downloaded");
    },
    onError: (err) => toast.error(`Export failed: ${err.message}`),
  });

  const disabled = recipeId === undefined;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={variant}
            size={size}
            className={className}
            disabled={disabled}
            title={disabled ? t("export_pdf_save_first", uiLang) : undefined}
          >
            <Download className="size-4" />
            Export
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setPdfDialogOpen(true)}>
            <FileText className="size-4" />
            {t("export_pdf", uiLang)}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => recipeId !== undefined && exportFileMut.mutate({ id: recipeId })}
            disabled={exportFileMut.isPending}
          >
            <FileJson className="size-4" />
            Recipe file (.guga.json)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={pdfDialogOpen} onOpenChange={setPdfDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{t("export_pdf_title", uiLang)}</DialogTitle>
            <DialogDescription>{t("export_pdf_description", uiLang)}</DialogDescription>
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
            <Button variant="ghost" onClick={() => setPdfDialogOpen(false)} disabled={exportPdfMut.isPending}>
              {t("cancel", uiLang)}
            </Button>
            <Button
              onClick={() => recipeId !== undefined && exportPdfMut.mutate({ id: recipeId, lang: pdfLang })}
              disabled={exportPdfMut.isPending || disabled}
            >
              {exportPdfMut.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              {exportPdfMut.isPending ? t("export_pdf_generating", uiLang) : t("export_pdf_download", uiLang)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

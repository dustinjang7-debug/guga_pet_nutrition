/**
 * Hidden file input + button. Accepts both `.pdf` (Guga-exported PDFs carry
 * the recipe data after %%EOF) and `.guga.json` files. After a successful
 * import we navigate to the new recipe and report any dropped ingredients.
 */

import { useRef, useState } from "react";
import { Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

interface Props {
  variant?: "outline" | "ghost" | "default" | "secondary";
  size?: "sm" | "lg" | "default";
  className?: string;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Unexpected reader result"));
        return;
      }
      const base64 = result.split(",", 2)[1] ?? "";
      resolve(base64);
    };
    reader.readAsDataURL(file);
  });
}

export function ImportRecipeButton({ variant = "outline", size = "lg", className }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [pending, setPending] = useState(false);
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const importMut = trpc.recipes.import.useMutation({
    onSuccess: (data) => {
      utils.recipes.list.invalidate();
      if (data.unknownIngredientIds.length > 0) {
        toast.warning(
          `Imported with ${data.unknownIngredientIds.length} unknown ingredient${data.unknownIngredientIds.length === 1 ? "" : "s"} dropped`,
        );
      } else {
        toast.success("Recipe imported");
      }
      setLocation(`/recipe/${data.id}`);
    },
    onError: (err) => toast.error(`Import failed: ${err.message}`),
    onSettled: () => setPending(false),
  });

  async function onFile(file: File) {
    setPending(true);
    try {
      const base64 = await fileToBase64(file);
      importMut.mutate({ base64, contentType: file.type || null });
    } catch (e) {
      setPending(false);
      toast.error(`Import failed: ${(e as Error).message}`);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.json,application/pdf,application/json,application/vnd.guga.recipe+json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          // Reset so re-selecting the same file fires onChange.
          e.target.value = "";
          if (f) onFile(f);
        }}
      />
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={() => inputRef.current?.click()}
        disabled={pending}
      >
        {pending ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Upload className="size-4 mr-1.5" />}
        Import
      </Button>
    </>
  );
}

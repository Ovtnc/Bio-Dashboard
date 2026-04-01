"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useSession } from "next-auth/react";
import { Loader2Icon, NotebookPenIcon, SaveIcon } from "lucide-react";
import { toast } from "sonner";

import { useActiveAnalysis } from "@/hooks/useActiveAnalysis";
import { fetchApiWithAuth } from "@/lib/authenticated-fetch";
import {
  analysisNotebookResponseSchema,
  analysisNotebookUpdateRequestSchema,
} from "@/lib/schemas/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const GLOBAL_NOTES_KEY = "bio-dash.quick-lab-notes.global";

function notebookDraftKey(analysisId: number | null) {
  if (!analysisId) {
    return GLOBAL_NOTES_KEY;
  }
  return `bio-dash.quick-lab-notes.analysis.${analysisId}`;
}

export function QuickLabNotes() {
  const { data: session } = useSession();
  const { activeAnalysisId } = useActiveAnalysis();

  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [markdown, setMarkdown] = useState("");
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");

  const saveTimerRef = useRef<number | null>(null);
  const lastLoadedAnalysisRef = useRef<number | null>(null);
  const hasRemoteScope = Boolean(activeAnalysisId && session?.user);

  const helperText = useMemo(() => {
    if (hasRemoteScope) {
      return `Analiz #${activeAnalysisId} için notlar DB'de saklanır.`;
    }
    return "Aktif analiz seçili değil veya oturum yok. Notlar yalnızca bu tarayıcıda saklanır.";
  }, [activeAnalysisId, hasRemoteScope]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const draft = window.localStorage.getItem(notebookDraftKey(activeAnalysisId)) ?? "";
    setMarkdown(draft);
  }, [activeAnalysisId]);

  useEffect(() => {
    if (!open || !hasRemoteScope || !activeAnalysisId) {
      return;
    }

    if (lastLoadedAnalysisRef.current === activeAnalysisId) {
      return;
    }

    let cancelled = false;
    const loadNotebook = async () => {
      setIsLoading(true);
      try {
        const response = await fetchApiWithAuth(`/api/analysis/${activeAnalysisId}/notebook`, {
          method: "GET",
          cache: "no-store",
        });
        const payload = await response.json().catch(() => null);
        if (response.status === 404) {
          return;
        }
        if (!response.ok) {
          const detail =
            payload && typeof payload === "object" && "detail" in payload
              ? String(payload.detail)
              : "Notebook içeriği alınamadı.";
          throw new Error(detail);
        }

        const parsed = analysisNotebookResponseSchema.safeParse(payload);
        if (!parsed.success) {
          throw new Error("Notebook cevap formatı doğrulanamadı.");
        }

        if (!cancelled) {
          setMarkdown(parsed.data.notebookMarkdown);
          if (typeof window !== "undefined") {
            window.localStorage.setItem(
              notebookDraftKey(activeAnalysisId),
              parsed.data.notebookMarkdown
            );
          }
          lastLoadedAnalysisRef.current = activeAnalysisId;
        }
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error ? error.message : "Notebook verisi alınamadı.";
          toast.error(message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadNotebook();
    return () => {
      cancelled = true;
    };
  }, [activeAnalysisId, hasRemoteScope, open]);

  const persistLocal = (value: string) => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(notebookDraftKey(activeAnalysisId), value);
  };

  const saveRemote = async (value: string, options?: { silent?: boolean }) => {
    if (!hasRemoteScope || !activeAnalysisId) {
      return;
    }

    const parsedRequest = analysisNotebookUpdateRequestSchema.safeParse({ markdown: value });
    if (!parsedRequest.success) {
      if (!options?.silent) {
        toast.error("Notebook içeriği çok uzun veya geçersiz.");
      }
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetchApiWithAuth(`/api/analysis/${activeAnalysisId}/notebook`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(parsedRequest.data),
      });

      const payload = await response.json().catch(() => null);
      if (response.status === 404) {
        if (!options?.silent) {
          toast.info("Notebook endpoint'i bulunamadı. Notlar local olarak saklanıyor.");
        }
        return;
      }
      if (!response.ok) {
        const detail =
          payload && typeof payload === "object" && "detail" in payload
            ? String(payload.detail)
            : "Notebook kaydedilemedi.";
        throw new Error(detail);
      }

      const parsed = analysisNotebookResponseSchema.safeParse(payload);
      if (!parsed.success) {
        throw new Error("Notebook kaydı doğrulanamadı.");
      }

      if (!options?.silent) {
        toast.success("Notebook kaydedildi.");
      }
    } catch (error) {
      if (!options?.silent) {
        const message = error instanceof Error ? error.message : "Notebook kaydedilemedi.";
        toast.error(message);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const scheduleAutoSave = (value: string) => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      void saveRemote(value, { silent: true });
    }, 1200);
  };

  useEffect(() => {
    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  const handleMarkdownChange = (value: string) => {
    setMarkdown(value);
    persistLocal(value);
    if (hasRemoteScope) {
      scheduleAutoSave(value);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            type="button"
            size="lg"
            className="fixed right-5 bottom-5 z-50 rounded-full shadow-lg"
          />
        }
      >
        <NotebookPenIcon className="mr-2 size-4" />
        Quick Lab Notes
      </DialogTrigger>

      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Quick Lab Notes</DialogTitle>
          <DialogDescription>{helperText}</DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as "edit" | "preview")}
        >
          <TabsList>
            <TabsTrigger value="edit">Editor</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>

          <TabsContent value="edit" className="space-y-3">
            <textarea
              value={markdown}
              onChange={(event) => handleMarkdownChange(event.target.value)}
              placeholder="Deney notları, gözlemler, hipotezler... (Markdown desteklenir)"
              className="min-h-[340px] w-full rounded-md border bg-background p-3 font-mono text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {isLoading ? "Notebook yükleniyor..." : "Markdown desteği aktif."}
              </p>
              <Button
                type="button"
                onClick={() => void saveRemote(markdown)}
                disabled={!hasRemoteScope || isSaving}
              >
                {isSaving ? (
                  <Loader2Icon className="mr-2 size-4 animate-spin" />
                ) : (
                  <SaveIcon className="mr-2 size-4" />
                )}
                Kaydet
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="preview">
            <div className="max-h-[400px] overflow-auto rounded-md border bg-muted/20 p-4 prose prose-sm dark:prose-invert">
              {markdown.trim().length > 0 ? (
                <ReactMarkdown>{markdown}</ReactMarkdown>
              ) : (
                <p className="text-sm text-muted-foreground">Henüz not eklenmedi.</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

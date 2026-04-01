"use client";

import { useEffect, useRef, useState } from "react";

type IgvBrowserHandle = { destroy?: () => void; removeAllTracks?: () => void };

type IgvCreateBrowser = (
  element: HTMLElement,
  options: Record<string, unknown>
) => Promise<IgvBrowserHandle>;

const IGV_CDN_SRC = "https://cdn.jsdelivr.net/npm/igv@3.8.0/dist/igv.min.js";

function resolveCreateBrowserExport(moduleValue: unknown): IgvCreateBrowser {
  const igvModule = moduleValue as {
    createBrowser?: IgvCreateBrowser;
    default?: { createBrowser?: IgvCreateBrowser };
  };

  const createBrowser = igvModule.createBrowser ?? igvModule.default?.createBrowser;
  if (!createBrowser) {
    throw new Error("IGV createBrowser exportu bulunamadı.");
  }

  return createBrowser;
}

async function loadCreateBrowserWithFallback(): Promise<IgvCreateBrowser> {
  try {
    return resolveCreateBrowserExport(await import("igv"));
  } catch {
    // Paket export çözümlemesi başarısızsa UMD fallback'i kullan.
  }

  if (typeof window === "undefined") {
    throw new Error("IGV sadece tarayıcı ortamında başlatılabilir.");
  }

  const fromWindow = () =>
    (window as Window & { igv?: { createBrowser?: IgvCreateBrowser } }).igv?.createBrowser;
  const existing = fromWindow();
  if (existing) {
    return existing;
  }

  await new Promise<void>((resolve, reject) => {
    const existingScript = document.getElementById("igv-cdn-script") as
      | HTMLScriptElement
      | null;

    if (existingScript) {
      if (fromWindow()) {
        resolve();
        return;
      }
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("IGV CDN script yüklenemedi.")),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.id = "igv-cdn-script";
    script.src = IGV_CDN_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("IGV CDN script yüklenemedi."));
    document.head.appendChild(script);
  });

  const createBrowser = fromWindow();
  if (!createBrowser) {
    throw new Error("IGV createBrowser exportu bulunamadı.");
  }

  return createBrowser;
}

export function IgvBrowser() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let browserInstance: IgvBrowserHandle | undefined;
    const containerEl = containerRef.current;

    const initializeBrowser = async () => {
      if (!containerEl) {
        return;
      }

      try {
        const createBrowser = await loadCreateBrowserWithFallback();

        browserInstance = await createBrowser(containerEl, {
          genome: "hg38",
          locus: "chr11:119,076,212-119,102,218",
          minimumBases: 40,
          showCenterGuide: true,
          showCursorTrackingGuide: true,
          showNavigation: true,
          showRuler: true,
          tracks: [
            {
              name: "Sample Alignment (BAM)",
              type: "alignment",
              format: "bam",
              url: "https://raw.githubusercontent.com/igvteam/igv.js/master/test/data/bam/HG002_chr11_119076212_119102218_2.bam",
              indexURL:
                "https://raw.githubusercontent.com/igvteam/igv.js/master/test/data/bam/HG002_chr11_119076212_119102218_2.bam.bai",
              visibilityWindow: 300000,
              height: 320,
            },
          ],
        });
      } catch (error) {
        if (isMounted) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "IGV.js başlatılırken beklenmeyen bir hata oluştu."
          );
        }
      }
    };

    void initializeBrowser();

    return () => {
      isMounted = false;
      if (browserInstance?.destroy) {
        browserInstance.destroy();
      } else if (browserInstance?.removeAllTracks) {
        browserInstance.removeAllTracks();
      }

      if (containerEl) {
        containerEl.innerHTML = "";
      }
    };
  }, []);

  if (errorMessage) {
    return (
      <div className="flex h-full min-h-[520px] items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        IGV.js yüklenemedi: {errorMessage}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-full min-h-[520px] w-full rounded-lg border bg-white"
    />
  );
}

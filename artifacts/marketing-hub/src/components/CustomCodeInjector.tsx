import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/catalog-api";

interface SiteCode { headHtml: string; bodyHtml: string }

function injectInto(target: HTMLElement, html: string, marker: string): () => void {
  const container = document.createElement("div");
  container.setAttribute("data-site-code-marker", marker);
  container.innerHTML = html;
  const nodes: Node[] = [];
  Array.from(container.childNodes).forEach(node => {
    if (node.nodeName === "SCRIPT") {
      const s = node as HTMLScriptElement;
      const fresh = document.createElement("script");
      Array.from(s.attributes).forEach(a => fresh.setAttribute(a.name, a.value));
      fresh.text = s.text;
      fresh.setAttribute("data-site-code-marker", marker);
      target.appendChild(fresh);
      nodes.push(fresh);
    } else {
      const cloned = node.cloneNode(true);
      if (cloned instanceof HTMLElement) cloned.setAttribute("data-site-code-marker", marker);
      target.appendChild(cloned);
      nodes.push(cloned);
    }
  });
  return () => {
    nodes.forEach(n => { try { target.removeChild(n); } catch { /* ignore */ } });
  };
}

export function CustomCodeInjector() {
  const { data } = useQuery<SiteCode>({
    queryKey: ["public-site-code"],
    queryFn: () => apiFetch<SiteCode>("/public/site-code"),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!data) return;
    const cleanups: Array<() => void> = [];
    if (data.headHtml.trim()) {
      cleanups.push(injectInto(document.head, data.headHtml, "site-code-head"));
    }
    if (data.bodyHtml.trim()) {
      cleanups.push(injectInto(document.body, data.bodyHtml, "site-code-body"));
    }
    return () => { cleanups.forEach(c => c()); };
  }, [data?.headHtml, data?.bodyHtml]);

  return null;
}

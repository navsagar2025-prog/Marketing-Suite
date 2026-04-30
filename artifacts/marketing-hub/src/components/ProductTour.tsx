import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { X, ChevronRight, ChevronLeft, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";

const TOUR_STORAGE_KEY = "product_tour_completed";

export const TOUR_STEPS: Array<{
  target: string;
  title: string;
  description: string;
  placement?: "top" | "bottom" | "left" | "right";
}> = [
  {
    target: "[data-tour='welcome-banner']",
    title: "Welcome to SEO Command",
    description:
      "This is your Marketing Command Center. From here you can access quick actions, view your stats, and get a bird's-eye view of all your campaigns and SEO activity.",
    placement: "bottom",
  },
  {
    target: "[data-tour='sidebar-nav']",
    title: "Navigate your workspace",
    description:
      "The sidebar gives you instant access to every tool — websites, keywords, campaigns, backlinks, leads, analytics, AI tools, and more. Click any item to jump right in.",
    placement: "right",
  },
  {
    target: "[data-tour='nav-keywords']",
    title: "Keyword Tracker",
    description:
      "Track how your pages rank for target keywords. Add keywords, monitor position changes over time, and get AI-powered suggestions to climb the SERPs.",
    placement: "right",
  },
  {
    target: "[data-tour='nav-campaigns']",
    title: "Email Campaigns",
    description:
      "Build and send email campaigns to your leads. Set up sequences, track open and click rates, and automate outreach at scale.",
    placement: "right",
  },
  {
    target: "[data-tour='nav-backlinks']",
    title: "Backlink Manager",
    description:
      "Discover link-building opportunities, track secured backlinks, and monitor your domain authority growth over time.",
    placement: "right",
  },
  {
    target: "[data-tour='stats-grid']",
    title: "Your stats at a glance",
    description:
      "This panel shows live counts for websites, keywords, leads, campaigns, backlinks, and scheduled posts — everything that matters, in one place.",
    placement: "top",
  },
  {
    target: "[data-tour='getting-started']",
    title: "Getting Started checklist",
    description:
      "Work through these quick steps to get the most out of SEO Command. Add a website, run your first audit, track a keyword, and launch a campaign.",
    placement: "bottom",
  },
];

function getRect(selector: string): DOMRect | null {
  const el = document.querySelector(selector);
  if (!el) return null;
  return el.getBoundingClientRect();
}

const PADDING = 10;
const POPOVER_W = 320;
const POPOVER_H = 180;

function computePopoverPos(
  rect: DOMRect,
  placement: "top" | "bottom" | "left" | "right" | undefined
): { top: number; left: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let top = 0;
  let left = 0;

  switch (placement) {
    case "bottom":
      top = rect.bottom + PADDING;
      left = rect.left + rect.width / 2 - POPOVER_W / 2;
      break;
    case "top":
      top = rect.top - POPOVER_H - PADDING;
      left = rect.left + rect.width / 2 - POPOVER_W / 2;
      break;
    case "left":
      top = rect.top + rect.height / 2 - POPOVER_H / 2;
      left = rect.left - POPOVER_W - PADDING;
      break;
    case "right":
    default:
      top = rect.top + rect.height / 2 - POPOVER_H / 2;
      left = rect.right + PADDING;
      break;
  }

  left = Math.max(PADDING, Math.min(left, vw - POPOVER_W - PADDING));
  top = Math.max(PADDING, Math.min(top, vh - POPOVER_H - PADDING));

  return { top, left };
}

function centeredPopoverPos(): { top: number; left: number } {
  return {
    top: Math.max(PADDING, window.innerHeight / 2 - POPOVER_H / 2),
    left: Math.max(PADDING, window.innerWidth / 2 - POPOVER_W / 2),
  };
}

interface SpotlightProps {
  rect: DOMRect | null;
  stepIndex: number;
  totalSteps: number;
  step: (typeof TOUR_STEPS)[number];
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}

function Spotlight({
  rect,
  stepIndex,
  totalSteps,
  step,
  onNext,
  onPrev,
  onClose,
}: SpotlightProps) {
  const isLast = stepIndex === totalSteps - 1;

  const popPos = rect
    ? computePopoverPos(rect, step.placement)
    : centeredPopoverPos();

  const popover = (
    <div
      className="absolute bg-card border border-border rounded-xl shadow-2xl"
      style={{
        top: popPos.top,
        left: popPos.left,
        width: POPOVER_W,
        pointerEvents: "all",
      }}
      data-testid="tour-popover"
    >
      {/* Header */}
      <div className="flex items-start justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">
            {stepIndex + 1}
          </span>
          <h3 className="text-sm font-semibold leading-snug">{step.title}</h3>
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors ml-2 mt-0.5 shrink-0"
          aria-label="Close tour"
          data-testid="button-tour-close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <p className="text-xs text-muted-foreground leading-relaxed px-4 pb-3">
        {step.description}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/40 rounded-b-xl">
        <span className="text-xs text-muted-foreground">
          {stepIndex + 1} / {totalSteps}
        </span>
        <div className="flex items-center gap-2">
          {stepIndex > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={onPrev}
              data-testid="button-tour-prev"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Back
            </Button>
          )}
          <Button
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={isLast ? onClose : onNext}
            data-testid="button-tour-next"
          >
            {isLast ? (
              "Finish"
            ) : (
              <>
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );

  if (!rect) {
    return createPortal(
      <div
        className="fixed inset-0 z-[9999]"
        style={{ pointerEvents: "all" }}
        aria-modal="true"
        role="dialog"
        aria-label={step.title}
      >
        <div
          className="absolute inset-0"
          style={{ background: "rgba(0,0,0,0.55)" }}
        />
        {popover}
      </div>,
      document.body
    );
  }

  const sp = {
    top: rect.top - PADDING,
    left: rect.left - PADDING,
    width: rect.width + PADDING * 2,
    height: rect.height + PADDING * 2,
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999]"
      style={{ pointerEvents: "all" }}
      aria-modal="true"
      role="dialog"
      aria-label={step.title}
    >
      {/* Dark overlay with cutout via SVG mask — intercepts clicks outside popover */}
      <svg
        className="absolute inset-0 w-full h-full"
        style={{ pointerEvents: "none" }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white" />
            <rect
              x={sp.left}
              y={sp.top}
              width={sp.width}
              height={sp.height}
              rx={10}
              fill="black"
            />
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.55)"
          mask="url(#tour-mask)"
        />
        <rect
          x={sp.left}
          y={sp.top}
          width={sp.width}
          height={sp.height}
          rx={10}
          fill="transparent"
          stroke="hsl(var(--primary))"
          strokeWidth="2.5"
          strokeDasharray="6 4"
        />
      </svg>
      {popover}
    </div>,
    document.body
  );
}

export function useTour() {
  const completed = () =>
    typeof window !== "undefined" &&
    localStorage.getItem(TOUR_STORAGE_KEY) === "true";

  const [active, setActive] = useState(false);

  const startTour = useCallback(() => {
    setActive(true);
  }, []);

  const autoStart = useCallback(() => {
    if (!completed()) {
      setActive(true);
    }
  }, []);

  return { active, setActive, startTour, autoStart };
}

interface ProductTourProps {
  active: boolean;
  onClose: () => void;
}

export function ProductTour({ active, onClose }: ProductTourProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const rafRef = useRef<number | null>(null);

  const currentStep = TOUR_STEPS[stepIndex];

  const updateRect = useCallback(() => {
    if (!active) return;
    const r = getRect(currentStep.target);
    if (r) {
      const el = document.querySelector(currentStep.target) as HTMLElement | null;
      if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
    setRect(r);
  }, [active, currentStep.target]);

  useEffect(() => {
    if (!active) return;
    setStepIndex(0);
  }, [active]);

  useEffect(() => {
    if (!active) return;
    rafRef.current = requestAnimationFrame(() => {
      updateRect();
    });
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [active, updateRect]);

  useEffect(() => {
    if (!active) return;
    window.addEventListener("resize", updateRect);
    return () => window.removeEventListener("resize", updateRect);
  }, [active, updateRect]);

  const handleClose = useCallback(() => {
    localStorage.setItem(TOUR_STORAGE_KEY, "true");
    onClose();
  }, [onClose]);

  const handleNext = useCallback(() => {
    let next = stepIndex + 1;
    while (next < TOUR_STEPS.length && !document.querySelector(TOUR_STEPS[next].target)) {
      next++;
    }
    if (next < TOUR_STEPS.length) {
      setStepIndex(next);
    } else {
      localStorage.setItem(TOUR_STORAGE_KEY, "true");
      onClose();
    }
  }, [stepIndex, onClose]);

  const handlePrev = useCallback(() => {
    let prev = stepIndex - 1;
    while (prev >= 0 && !document.querySelector(TOUR_STEPS[prev].target)) {
      prev--;
    }
    if (prev >= 0) {
      setStepIndex(prev);
    }
  }, [stepIndex]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        localStorage.setItem(TOUR_STORAGE_KEY, "true");
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, onClose]);

  if (!active) return null;

  return (
    <Spotlight
      rect={rect}
      stepIndex={stepIndex}
      totalSteps={TOUR_STEPS.length}
      step={currentStep}
      onNext={handleNext}
      onPrev={handlePrev}
      onClose={handleClose}
    />
  );
}

export function TourLaunchButton({
  onStart,
}: {
  onStart: () => void;
}) {
  return (
    <Button
      variant="secondary"
      size="sm"
      className="bg-white/20 hover:bg-white/30 text-primary-foreground border-white/20 border backdrop-blur-sm gap-1.5"
      onClick={onStart}
      data-testid="button-take-tour"
    >
      <MapPin className="h-3.5 w-3.5" />
      Take the tour
    </Button>
  );
}

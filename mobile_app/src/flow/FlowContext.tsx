// Shared state for the guest purchase/session flow — the mobile
// counterpart to what used to be +page.svelte's top-level `$state`
// variables. Needed because Expo Router screens are separate route files
// with no implicit parent-child state sharing (unlike the old single
// AppRouter component); provided once in app/_layout.tsx, read via
// useFlow() from each route file. Screen presentational components
// (src/screens/*.tsx) don't know this exists — they still just take plain
// props, same as before this restructure; only the route files wire them
// to this context.
import { createContext, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { PACKAGES, getWarningThreshold, type Package, type Activator as ActivatorRecord } from "@/lib/data";

export type Activator = ActivatorRecord | null;

export type FlowContextValue = {
  appMode: "simulation" | "active";
  setAppMode: (m: "simulation" | "active") => void;
  selectedPkg: Package;
  setSelectedPkg: Dispatch<SetStateAction<Package>>;
  selectedActivator: Activator;
  setSelectedActivator: (a: Activator) => void;
  phone: string;
  setPhone: (p: string) => void;
  activeInitialRemaining: number | null;
  setActiveInitialRemaining: (n: number | null) => void;
  cameFromConnecting: boolean;
  setCameFromConnecting: (b: boolean) => void;
  expectRealSession: boolean;
  setExpectRealSession: (b: boolean) => void;
  warningRemaining: number;
  setWarningRemaining: (n: number) => void;
  paymentFailReason: { title: string; detail: string } | null;
  setPaymentFailReason: (r: { title: string; detail: string } | null) => void;
  simulatePaymentFailure: boolean;
  setSimulatePaymentFailure: (b: boolean) => void;
  paymentReference: string | null;
  setPaymentReference: (s: string | null) => void;
  // Where TimelineScreen's own Back should return to — 'packages' (normal
  // entry) or 'active' (reached via ActiveScreen's Explore tile, mid-session).
  timelineOrigin: "packages" | "active";
  setTimelineOrigin: (o: "packages" | "active") => void;
};

const FlowContext = createContext<FlowContextValue | null>(null);

export function FlowProvider({ children }: { children: ReactNode }) {
  const [appMode, setAppMode] = useState<"simulation" | "active">("simulation");
  const [selectedPkg, setSelectedPkg] = useState<Package>(() => PACKAGES.find((p) => p.id === "weekly")!);
  const [selectedActivator, setSelectedActivator] = useState<Activator>(null);
  const [phone, setPhone] = useState("");
  const [activeInitialRemaining, setActiveInitialRemaining] = useState<number | null>(null);
  const [cameFromConnecting, setCameFromConnecting] = useState(false);
  const [expectRealSession, setExpectRealSession] = useState(true);
  const [warningRemaining, setWarningRemaining] = useState(() => getWarningThreshold(selectedPkg.demoSecs));
  const [paymentFailReason, setPaymentFailReason] = useState<{ title: string; detail: string } | null>(null);
  const [simulatePaymentFailure, setSimulatePaymentFailure] = useState(false);
  const [paymentReference, setPaymentReference] = useState<string | null>(null);
  const [timelineOrigin, setTimelineOrigin] = useState<"packages" | "active">("packages");

  const value: FlowContextValue = {
    appMode,
    setAppMode,
    selectedPkg,
    setSelectedPkg,
    selectedActivator,
    setSelectedActivator,
    phone,
    setPhone,
    activeInitialRemaining,
    setActiveInitialRemaining,
    cameFromConnecting,
    setCameFromConnecting,
    expectRealSession,
    setExpectRealSession,
    warningRemaining,
    setWarningRemaining,
    paymentFailReason,
    setPaymentFailReason,
    simulatePaymentFailure,
    setSimulatePaymentFailure,
    paymentReference,
    setPaymentReference,
    timelineOrigin,
    setTimelineOrigin,
  };

  return <FlowContext.Provider value={value}>{children}</FlowContext.Provider>;
}

export function useFlow(): FlowContextValue {
  const ctx = useContext(FlowContext);
  if (!ctx) throw new Error("useFlow() must be used within <FlowProvider>");
  return ctx;
}

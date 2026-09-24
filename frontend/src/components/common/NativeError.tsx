import type { ReactNode } from "react";

const COPY: Record<string, { title: string; body: string }> = {
  offline: { title: "Jev is offline here", body: "The eSketcher server isn't reachable, so Jev can't decide. Paint it yourself, or reload to reconnect." },
  network: { title: "Studio link interrupted", body: "The backend can't be reached. Your canvas is safe; changes will sync when it's back." },
  jev_unavailable: { title: "Jev connection interrupted", body: "The material field couldn't be evaluated." },
  jev_timeout: { title: "Jev took too long", body: "The decision timed out before the field settled." },
  jev_auth: { title: "Jev refused the key", body: "The backend's TypeSafe key was rejected. Check TYPESAFE_API_KEY." },
  jev_quota: { title: "Jev is out of credit", body: "The TypeSafe account has no credit left for decisions." },
  jev_malformed: { title: "Jev answered in noise", body: "The response couldn't be read as a material field." },
  rate_limited: { title: "Too many decisions", body: "Give Jev a few seconds to cool down." },
  daily_limit: { title: "Today's decisions are used up", body: "You've reached today's Jev limit. It resets at midnight UTC; you can still paint manually." },
  jev_budget: { title: "Jev is resting for today", body: "This server has used today's Jev budget. It resets at midnight UTC; you can still paint manually." },
  bad_candidates: { title: "No field to decide over", body: "There aren't enough candidate materials left. Unpin or reset rejections." },
};

export function errorCopy(code: string) {
  return COPY[code] ?? { title: "Jev connection interrupted", body: "The material field couldn't be evaluated." };
}

export function NativeError({ code, children }: { code: string; children?: ReactNode }) {
  const copy = errorCopy(code);
  return (
    <div role="alert" className="border border-err/40 bg-err/[0.06] p-4">
      <div className="flex items-center gap-2">
        <span className="es-dot bg-err" />
        <span className="es-label !text-err">{copy.title}</span>
      </div>
      <p className="mt-3 text-[13px] leading-relaxed text-bone/80">{copy.body}</p>
      {children && <div className="mt-4 flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

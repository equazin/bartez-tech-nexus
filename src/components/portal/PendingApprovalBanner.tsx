import { useLocation, Link } from "react-router-dom";
import { useOrderApprovals } from "@/hooks/useOrderApprovals";
import { ClipboardCheck, ArrowRight } from "lucide-react";

interface PendingApprovalBannerProps {
  /** b2b_role of the current user — only managers (and admin via SECURITY DEFINER) get the banner */
  role?: string | null;
}

/**
 * Shows a slim banner when the active manager has orders waiting approval.
 * Hidden on the approvals page itself to avoid noise.
 */
export function PendingApprovalBanner({ role }: PendingApprovalBannerProps) {
  const location = useLocation();
  const isManagerOrAdmin = role === "manager" || role === "admin";
  const { pending, loading } = useOrderApprovals();

  if (!isManagerOrAdmin) return null;
  if (loading) return null;
  if (pending.length === 0) return null;
  if (location.pathname.startsWith("/portal/pedidos/aprobar")) return null;

  return (
    <div className="border-b border-warning/40 bg-warning-soft px-4 py-2 text-sm text-warning md:px-6">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 shrink-0" />
          <span className="font-medium">
            {pending.length === 1
              ? "1 pedido espera tu aprobación"
              : `${pending.length} pedidos esperan tu aprobación`}
          </span>
        </div>
        <Link
          to="/portal/pedidos/aprobar"
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold underline-offset-4 hover:underline"
        >
          Revisar
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

import B2BPortal from "@/pages/B2BPortal";

/**
 * AccountPage forwards to the legacy AccountCenter via B2BPortal `cuenta` tab.
 * The internal `?section=` searchParam still drives the active sub-section
 * inside AccountCenter (resumen, datos, listas, reposicion, etc.). Sprint 5
 * will split AccountCenter into real sub-routes.
 */
function AccountPage() {
  return <B2BPortal chrome="shell" forcedTab="cuenta" />;
}

export default AccountPage;

import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Cpu, Search, ShoppingBag, Database, FileDown, FileCheck2, Loader2, PlugZap, Check, Minus } from "lucide-react";
import { useGetSettings, useGetShopifyStatus, useConnectShopify, useListThemes, getGetSettingsQueryKey, getGetShopifyStatusQueryKey, getListThemesQueryKey } from "@workspace/api-client-react";
import { PageHeader, ErrorState, Sk, Btn, Tag, Notice } from "@/components/bits";
import { errMsg } from "@/lib/run-utils";
import { cn } from "@/lib/utils";

function Row({ icon, name, ok, status, message, missing, children }: { icon: ReactNode; name: string; ok: boolean; status: string; message: string; missing?: string[]; children?: ReactNode }) {
  return (
    <div className="grid gap-4 p-5 md:grid-cols-[220px_1fr]">
      <div className="flex items-center gap-3">
        <div className={cn("grid h-9 w-9 place-items-center rounded-lg border", ok ? "border-[hsl(var(--jade)/0.3)] text-[hsl(var(--jade))]" : "border-[hsl(var(--amber)/0.3)] text-[hsl(var(--amber))]")}>{icon}</div>
        <div><div className="text-sm font-medium">{name}</div><div className="flex items-center gap-1 text-xs text-muted-foreground">{ok ? <Check className="h-3 w-3" /> : <Minus className="h-3 w-3" />}{status}</div></div>
      </div>
      <div className="min-w-0">
        <p className="text-[13.5px] text-foreground/80">{message}</p>
        {missing && missing.length > 0 && (
          <div className="mt-2.5"><div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Missing environment variables</div>
            <div className="flex flex-wrap gap-1.5">{missing.map((m) => <code key={m} data-testid={`text-missing-${m}`} className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11.5px]">{m}</code>)}</div></div>
        )}
        {children}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const qc = useQueryClient();
  const s = useGetSettings();
  const shop = useGetShopifyStatus();
  const connected = !!shop.data?.connected;
  const themes = useListThemes({ query: { enabled: connected, queryKey: getListThemesQueryKey() } });
  const connect = useConnectShopify({ mutation: { onSettled: () => {
    qc.invalidateQueries({ queryKey: getGetShopifyStatusQueryKey() });
    qc.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
    qc.invalidateQueries({ queryKey: getListThemesQueryKey() });
  } } });

  return (
    <>
      <PageHeader eyebrow="Readiness" title="Integrations & readiness" sub="What is configured, what is missing, and how to test Shopify safely. Secrets are set in the environment, never in this UI." />
      <Notice tone="muted">This page only lists the <b>names</b> of missing environment variables. Add values through your deployment's secret manager, then refresh.</Notice>
      <div className="mt-6">
        {s.error ? <ErrorState message={errMsg(s.error)} onRetry={() => s.refetch()} /> : s.isLoading || !s.data ? <Sk className="h-80" /> : (
          <div className="panel divide-y divide-border">
            <Row icon={<Cpu className="h-4 w-4" />} name="AI model" ok={s.data.ai.configured} status={s.data.ai.configured ? `${s.data.ai.provider} configured` : "Not configured"} message={s.data.ai.message} />
            <Row icon={<Search className="h-4 w-4" />} name="Web search" ok={s.data.search.configured} status={s.data.search.configured ? `${s.data.search.provider} configured` : "Not configured"} message={s.data.search.message}>
              {!s.data.search.configured && <p className="mt-2 text-xs text-muted-foreground">Competitor research is unavailable until search is configured. Generation still works and discloses the gap.</p>}
            </Row>
            <Row icon={<ShoppingBag className="h-4 w-4" />} name="Shopify" ok={connected} status={connected ? `Connected${shop.data?.shop ? ` · ${shop.data.shop}` : ""}` : s.data.shopify.configured ? "Configured, not connected" : "Not configured"}
              message={shop.data?.message ?? s.data.shopify.message} missing={shop.data?.missing ?? s.data.shopify.missing}>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Btn data-testid="button-test-shopify" variant="outline" disabled={connect.isPending || !(shop.data?.configured ?? s.data.shopify.configured)} onClick={() => connect.mutate()}>
                  {connect.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />} Test connection
                </Btn>
                {connect.data && <Tag tone={connect.data.connected ? "jade" : "danger"}>{connect.data.message}</Tag>}
                {connect.error && <Tag tone="danger">{errMsg(connect.error)}</Tag>}
              </div>
              {connected && (
                <div className="mt-4"><div className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Themes</div>
                  {themes.isLoading ? <Sk className="h-16" /> : themes.error ? <ErrorState message={errMsg(themes.error)} onRetry={() => themes.refetch()} /> :
                    <ul className="divide-y divide-border rounded-lg border border-border">{(themes.data ?? []).map((t) => (
                      <li key={t.id} className="flex items-center justify-between px-3 py-2 text-sm"><span>{t.name}</span><Tag tone={t.role === "main" ? "danger" : "muted"}>{t.role === "main" ? "live, never published to" : t.role}</Tag></li>))}</ul>}
                </div>
              )}
            </Row>
            <Row icon={<Database className="h-4 w-4" />} name="Database" ok={/ok|connected|ready/i.test(s.data.database)} status={s.data.database} message="Runs, designs, feedback and memory persist here. No demo data is seeded." />
          </div>
        )}
      </div>
      <h2 className="mb-3 mt-10 font-display text-2xl">Documents</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <a href={s.data?.requirementsUrl || "/api/requirements"} data-testid="link-requirements" className="panel group flex items-center gap-4 p-5 hover:bg-muted/40">
          <FileDown className="h-5 w-5 text-[hsl(var(--seal))]" /><div><div className="text-sm font-medium">Requirements checklist</div><div className="text-xs text-muted-foreground">Download the HR checklist</div></div>
        </a>
        <a href="/api/submission" target="_blank" rel="noreferrer" data-testid="link-submission" className="panel group flex items-center gap-4 p-5 hover:bg-muted/40">
          <FileCheck2 className="h-5 w-5 text-[hsl(var(--seal))]" /><div><div className="text-sm font-medium">Acceptance & submission</div><div className="text-xs text-muted-foreground">Open the submission document</div></div>
        </a>
      </div>
    </>
  );
}

import type { ColumnDef } from "@tanstack/react-table";
import type { LinkRecord, ReferringDomain, AnchorRecord, PageRow } from "./api";
import { METRICS } from "./metrics";

export const linkColumns: ColumnDef<LinkRecord, unknown>[] = [
  { accessorKey: "referring_domain", header: "Referring Domain", meta: { tooltip: METRICS.referring_domain.short } },
  {
    accessorKey: "referring_url",
    header: "Referring URL",
    size: 400,
    meta: { tooltip: METRICS.referring_url.short },
    cell: ({ getValue }) => {
      const url = getValue() as string;
      return (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-600 hover:underline break-all"
          title={url}
        >
          {url}
        </a>
      );
    },
  },
  { accessorKey: "anchor", header: "Anchor", size: 400, meta: { tooltip: METRICS.anchor.short } },
  { accessorKey: "target_path", header: "Target", size: 400, meta: { tooltip: METRICS.target.short } },
  { accessorKey: "domain_rating", header: "DR", meta: { tooltip: METRICS.dr.short } },
  { accessorKey: "url_rating", header: "UR" },
  { accessorKey: "page_traffic", header: "Page Traffic", meta: { tooltip: METRICS.page_traffic.short } },
  { accessorKey: "domain_traffic", header: "Domain Traffic", meta: { tooltip: METRICS.domain_traffic.short } },
  { accessorKey: "link_type", header: "Type", meta: { tooltip: METRICS.link_type.short } },
  {
    accessorKey: "http_code",
    header: "Status",
    meta: { tooltip: "HTTP status code of the referring page." },
    cell: ({ getValue }) => {
      const code = getValue() as number;
      if (code == null || code === 0) return <span className="text-gray-400">—</span>;
      const color = code >= 200 && code < 300 ? "text-green-600" : code >= 300 && code < 400 ? "text-yellow-600" : "text-red-600";
      return <span className={color}>{code}</span>;
    },
  },
  {
    accessorKey: "is_nofollow",
    header: "NF",
    meta: { tooltip: METRICS.nf.short },
    cell: ({ getValue }) => (getValue() ? "Yes" : ""),
  },
  {
    accessorKey: "is_sponsored",
    header: "Sponsored",
    meta: { tooltip: "Whether the link has a rel=\"sponsored\" attribute." },
    cell: ({ getValue }) => (getValue() ? "Yes" : ""),
  },
  {
    accessorKey: "is_spam",
    header: "Spam",
    meta: { tooltip: METRICS.spam.short },
    cell: ({ getValue }) => (getValue() ? "Yes" : ""),
  },
  { accessorKey: "first_seen", header: "First Seen", meta: { tooltip: METRICS.first_seen.short } },
];

export const domainColumns: ColumnDef<ReferringDomain, unknown>[] = [
  { accessorKey: "referring_domain", header: "Domain", size: 400, meta: { tooltip: METRICS.domain.short } },
  { accessorKey: "link_count", header: "Links", meta: { tooltip: METRICS.links.short } },
  { accessorKey: "max_dr", header: "DR", meta: { tooltip: METRICS.dr.short } },
  { accessorKey: "total_traffic", header: "Traffic", meta: { tooltip: METRICS.traffic.short } },
  {
    accessorKey: "is_sitewide",
    header: "Sitewide",
    meta: { tooltip: METRICS.sitewide.short },
    cell: ({ getValue }) => (getValue() ? "Yes" : ""),
  },
];

export const anchorColumns: ColumnDef<AnchorRecord, unknown>[] = [
  { accessorKey: "anchor", header: "Anchor Text", size: 400, meta: { tooltip: METRICS.anchor_text.short } },
  { accessorKey: "count", header: "Count", meta: { tooltip: METRICS.count.short } },
  { accessorKey: "category", header: "Category", meta: { tooltip: METRICS.category.short } },
  {
    accessorKey: "pct",
    header: "%",
    meta: { tooltip: METRICS.pct.short },
    cell: ({ getValue }) => `${(getValue() as number).toFixed(1)}%`,
  },
];

export const pageColumns: ColumnDef<PageRow, unknown>[] = [
  { accessorKey: "target_path", header: "Target URL", size: 400, meta: { tooltip: METRICS.target_url.short } },
  { accessorKey: "category", header: "Category", meta: { tooltip: METRICS.category.short } },
  { accessorKey: "link_count", header: "Backlinks", meta: { tooltip: METRICS.backlinks.short } },
  { accessorKey: "unique_referring_domains", header: "Ref. Domains", meta: { tooltip: METRICS.ref_domains.short } },
  {
    accessorKey: "avg_dr",
    header: "Avg DR",
    meta: { tooltip: METRICS.avg_dr.short },
    cell: ({ getValue }) => (getValue() as number)?.toFixed(1) ?? "—",
  },
  {
    accessorKey: "dofollow_ratio",
    header: "Dofollow %",
    meta: { tooltip: METRICS.dofollow_pct.short },
    cell: ({ getValue }) => `${((getValue() as number) * 100).toFixed(0)}%`,
  },
];

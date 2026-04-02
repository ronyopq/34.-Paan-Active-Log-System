import clsx from "clsx";

type KpiCardProps = {
  label: string;
  value: string | number;
  icon?: string;
  accent?: "green" | "blue" | "amber" | "rose";
  subLabel?: string;
};

export const KpiCard = ({ label, value, icon = "bi-graph-up", accent = "green", subLabel }: KpiCardProps) => {
  return (
    <article className={clsx("kpi-card", `accent-${accent}`)}>
      <div className="kpi-icon-wrap">
        <i className={`bi ${icon}`} />
      </div>
      <div>
        <p className="kpi-value mb-1">{value}</p>
        <p className="kpi-label mb-0">{label}</p>
        {subLabel && <small className="text-muted">{subLabel}</small>}
      </div>
    </article>
  );
};
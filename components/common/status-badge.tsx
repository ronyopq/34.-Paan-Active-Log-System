import clsx from "clsx";
import { EntryStatus } from "@/lib/types";

type Props = {
  status: EntryStatus;
};

export const StatusBadge = ({ status }: Props) => {
  return <span className={clsx("status-badge", `status-${status.toLowerCase()}`)}>{status}</span>;
};
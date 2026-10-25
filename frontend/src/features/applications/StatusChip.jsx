import { Chip } from "@mui/material";
import { STATUS_BY_VALUE } from "./constants";

export default function StatusChip({ status, ...props }) {
  const s = STATUS_BY_VALUE[status] ?? { label: status, color: "default" };
  return <Chip label={s.label} color={s.color} size="small" variant="outlined" {...props} />;
}

import { MenuItem, Select } from "@mui/material";
import { STATUSES } from "./constants";
import StatusChip from "./StatusChip";
import { useUpdateStatus } from "./hooks";
import { useNotify } from "../../components/Notifications";

// Select compact qui affiche le statut sous forme de Chip et le modifie en un clic.
export default function StatusSelect({ application }) {
  const updateStatus = useUpdateStatus();
  const notify = useNotify();

  const onChange = (e) => {
    updateStatus.mutate(
      { id: application.id, status: e.target.value },
      { onError: () => notify("Le statut n'a pas pu être modifié.", "error") }
    );
  };

  return (
    <Select
      value={application.status}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
      size="small"
      variant="standard"
      disableUnderline
      renderValue={(v) => <StatusChip status={v} sx={{ cursor: "pointer" }} />}
      inputProps={{ "aria-label": `Statut de ${application.position} chez ${application.company}` }}
      sx={{ "& .MuiSelect-select": { py: 0.5 } }}
    >
      {STATUSES.map((s) => (
        <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
      ))}
    </Select>
  );
}

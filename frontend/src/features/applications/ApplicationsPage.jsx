import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  Alert, Box, Button, IconButton, InputAdornment, LinearProgress, MenuItem, Paper, Skeleton, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TableSortLabel,
  TextField, Tooltip, Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import SearchIcon from "@mui/icons-material/Search";
import WorkOutlinedIcon from "@mui/icons-material/WorkOutlined";
import ConfirmDialog from "../../components/ConfirmDialog";
import { useNotify } from "../../components/Notifications";
import ApplicationFormDialog from "./ApplicationFormDialog";
import StatusSelect from "./StatusSelect";
import { PAGE_SIZE, STATUSES, formatDate } from "./constants";
import { useApplications, useDeleteApplication } from "./hooks";

const SEARCH_DEBOUNCE_MS = 300;
const DEFAULT_ORDERING = "-created_at";

const COLUMNS = [
  { id: "position", label: "Poste" },
  { id: "company", label: "Entreprise", sortable: true },
  { id: "status", label: "Statut", sortable: true },
  { id: "applied_at", label: "Candidature", sortable: true, hideOnMobile: true },
  { id: "created_at", label: "Ajoutée le", sortable: true, hideOnMobile: true },
];

export default function ApplicationsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const notify = useNotify();

  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get("status") ?? "";
  const search = searchParams.get("search") ?? "";
  const ordering = searchParams.get("ordering") ?? DEFAULT_ORDERING;
  const page = Math.max(1, Number(searchParams.get("page")) || 1);

  const updateParams = useCallback((changes, { replace = false } = {}) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, String(v)) : next.delete(k)));
      // nouveau filtre : retour en page 1
      if (!("page" in changes)) next.delete("page");
      return next;
    }, { replace });
  }, [setSearchParams]);

  const [searchInput, setSearchInput] = useState(search);
  const [syncedSearch, setSyncedSearch] = useState(search);
  if (search !== syncedSearch) {
    // URL modifiée de l'extérieur (bouton retour)
    setSyncedSearch(search);
    setSearchInput(search);
  }
  const debounceRef = useRef();
  useEffect(() => () => clearTimeout(debounceRef.current), []);
  // le minuteur doit utiliser la dernière version de updateParams
  const updateParamsRef = useRef(updateParams);
  useEffect(() => { updateParamsRef.current = updateParams; }, [updateParams]);
  const onSearchChange = (e) => {
    const value = e.target.value;
    setSearchInput(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(
      () => updateParamsRef.current({ search: value.trim() }, { replace: true }),
      SEARCH_DEBOUNCE_MS
    );
  };

  const resetFilters = () => {
    clearTimeout(debounceRef.current);
    setSearchInput("");
    setSearchParams({});
  };
  const isPristine = !status && !searchInput && ordering === DEFAULT_ORDERING && page === 1;

  const params = { status: status || undefined, search: search || undefined, ordering, page };
  const { data, isLoading, isError, error, isFetching, refetch } = useApplications(params);

  // DRF : 404 sur une page hors limites
  const isOutOfRange = isError && error.response?.status === 404 && page > 1;
  useEffect(() => {
    if (isOutOfRange) updateParams({ page: null }, { replace: true });
  }, [isOutOfRange, updateParams]);

  const onSort = (field) => {
    const isAsc = ordering === field;
    updateParams({ ordering: isAsc ? `-${field}` : field });
  };

  const [formOpen, setFormOpen] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const remove = useDeleteApplication();
  const confirmDelete = () => {
    remove.mutate(toDelete.id, {
      onSuccess: () => notify(`Candidature « ${toDelete.position} » supprimée.`),
      onError: () => notify("La suppression a échoué.", "error"),
      onSettled: () => setToDelete(null),
    });
  };

  const hasFilters = Boolean(status || search);
  const rows = data?.results ?? [];

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}>
        <Box>
          <Typography variant="h4" component="h1">Candidatures</Typography>
          <Typography variant="body2" color="text.secondary">
            {data ? `${data.count} candidature${data.count > 1 ? "s" : ""}` : " "}
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setFormOpen(true)}>
          Nouvelle candidature
        </Button>
      </Stack>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: { sm: "center" } }}>
        <TextField
          value={searchInput}
          onChange={onSearchChange}
          placeholder="Entreprise, poste, note…"
          size="small"
          sx={{ width: { xs: "100%", sm: 300 } }}
          slotProps={{
            input: { startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> },
            htmlInput: { "aria-label": "Rechercher" },
          }}
        />
        <TextField
          select
          label="Statut"
          value={status}
          onChange={(e) => updateParams({ status: e.target.value })}
          size="small"
          sx={{ minWidth: 180 }}
          slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
        >
          <MenuItem value="">Tous</MenuItem>
          {STATUSES.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
        </TextField>
        <Button
          startIcon={<RestartAltIcon />}
          onClick={resetFilters}
          disabled={isPristine}
          sx={{ alignSelf: { xs: "flex-start", sm: "center" } }}
        >
          Réinitialiser
        </Button>
      </Stack>

      {isError && !isOutOfRange ? (
        <Alert
          severity="error"
          action={<Button color="inherit" size="small" onClick={() => refetch()}>Réessayer</Button>}
        >
          Impossible de charger les candidatures.
        </Alert>
      ) : (
        <Paper variant="outlined" sx={{ position: "relative", overflow: "hidden" }}>
          {isFetching && !isLoading && (
            <LinearProgress sx={{ position: "absolute", top: 0, left: 0, right: 0 }} />
          )}
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  {COLUMNS.map((col) => (
                    <TableCell
                      key={col.id}
                      sortDirection={ordering.replace("-", "") === col.id ? (ordering.startsWith("-") ? "desc" : "asc") : false}
                      sx={col.hideOnMobile ? { display: { xs: "none", md: "table-cell" } } : undefined}
                    >
                      {col.sortable ? (
                        <TableSortLabel
                          active={ordering.replace("-", "") === col.id}
                          direction={ordering === `-${col.id}` ? "desc" : "asc"}
                          onClick={() => onSort(col.id)}
                        >
                          {col.label}
                        </TableSortLabel>
                      ) : col.label}
                    </TableCell>
                  ))}
                  <TableCell align="right"><Box component="span" sx={visuallyHidden}>Actions</Box></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading && Array.from({ length: 5 }, (_, i) => (
                  <TableRow key={i}>
                    {COLUMNS.map((col) => (
                      <TableCell key={col.id} sx={col.hideOnMobile ? { display: { xs: "none", md: "table-cell" } } : undefined}>
                        <Skeleton />
                      </TableCell>
                    ))}
                    <TableCell />
                  </TableRow>
                ))}

                {!isLoading && rows.map((a) => (
                  <TableRow
                    key={a.id}
                    hover
                    onClick={() => navigate(`/applications/${a.id}`, { state: { listSearch: location.search } })}
                    sx={{ cursor: "pointer" }}
                  >
                    <TableCell sx={{ fontWeight: 500 }}>{a.position}</TableCell>
                    <TableCell>{a.company}</TableCell>
                    <TableCell><StatusSelect application={a} /></TableCell>
                    <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>{formatDate(a.applied_at)}</TableCell>
                    <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>{formatDate(a.created_at)}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="Supprimer">
                        <IconButton
                          aria-label={`Supprimer ${a.position} chez ${a.company}`}
                          onClick={(e) => { e.stopPropagation(); setToDelete(a); }}
                        >
                          <DeleteOutlinedIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {!isLoading && rows.length === 0 && (
            <Stack spacing={1.5} sx={{ alignItems: "center", py: 6, px: 2, textAlign: "center" }}>
              <WorkOutlinedIcon sx={{ fontSize: 48, color: "text.disabled" }} />
              {hasFilters ? (
                <>
                  <Typography variant="h6">Aucun résultat</Typography>
                  <Typography color="text.secondary">Aucune candidature ne correspond à ces filtres.</Typography>
                  <Button onClick={resetFilters}>Effacer les filtres</Button>
                </>
              ) : (
                <>
                  <Typography variant="h6">Aucune candidature pour l'instant</Typography>
                  <Typography color="text.secondary">Ajoutez la première offre à laquelle vous voulez postuler.</Typography>
                  <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setFormOpen(true)}>
                    Ajouter une candidature
                  </Button>
                </>
              )}
            </Stack>
          )}

          {(data?.count ?? 0) > 0 && (
            <TablePagination
              component="div"
              count={data.count}
              page={page - 1}
              rowsPerPage={PAGE_SIZE}
              rowsPerPageOptions={[]}
              onPageChange={(_, p) => updateParams({ page: p > 0 ? p + 1 : null })}
            />
          )}
        </Paper>
      )}

      <ApplicationFormDialog open={formOpen} onClose={() => setFormOpen(false)} />
      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Supprimer la candidature ?"
        message={toDelete && `« ${toDelete.position} » chez ${toDelete.company} sera définitivement supprimée.`}
        confirmLabel="Supprimer"
        loading={remove.isPending}
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
      />
    </Stack>
  );
}

const visuallyHidden = {
  position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap",
};

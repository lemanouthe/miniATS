export const STATUSES = [
  { value: "to_apply", label: "À postuler", color: "default" },
  { value: "applied", label: "Postulé", color: "info" },
  { value: "interview", label: "Entretien", color: "warning" },
  { value: "offer", label: "Offre", color: "success" },
  { value: "rejected", label: "Refusé", color: "error" },
];

export const STATUS_BY_VALUE = Object.fromEntries(STATUSES.map((s) => [s.value, s]));

// = PAGE_SIZE côté Django
export const PAGE_SIZE = 10;

export const formatDate = (iso) =>
  iso ? new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("fr-FR") : "—";

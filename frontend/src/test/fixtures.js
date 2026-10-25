// Données de test partagées par tous les tests du front.
// Pour les changer, c'est le seul fichier à modifier : les tests lisent ces valeurs au lieu de les recopier.

export const ME = {
  id: 1,
  email: "demo@example.com",
  first_name: "Camille",
  last_name: "Demo",
  full_name: "Camille Demo",
  avatar: null,
  job_title: "Développeuse full stack",
  phone: "",
  location: "Paris",
  linkedin_url: "",
  bio: "",
};

export const AVATAR_URL = "http://localhost:8000/media/avatars/1/photo.png";

// La première candidature est complète (notes, lien, date), la seconde a ses champs optionnels vides.
export const APPLICATIONS = [
  {
    id: 1,
    company: "Zenith",
    position: "Dev full stack",
    status: "interview",
    job_url: "https://example.com/zenith",
    notes: "Entretien jeudi",
    applied_at: "2026-10-20",
    created_at: "2026-10-18T10:00:00Z",
    updated_at: "2026-10-21T10:00:00Z",
  },
  {
    id: 2,
    company: "Doctolib",
    position: "Dev React",
    status: "applied",
    job_url: "",
    notes: "",
    applied_at: null,
    created_at: "2026-10-17T10:00:00Z",
    updated_at: "2026-10-17T10:00:00Z",
  },
];

export const TOKENS = { access: "access-token", refresh: "refresh-token" };

// Réponse paginée telle que la renvoie DRF.
export const listPage = (results = APPLICATIONS) => ({ count: results.length, results });

// Erreur axios avec la réponse du serveur.
export const apiError = (status, data = {}) =>
  Object.assign(new Error(String(status)), { response: { status, data } });

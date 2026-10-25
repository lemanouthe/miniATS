import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { tokenStorage } from "./api/client";
import * as api from "./api/applications";
import * as authApi from "./api/auth";
import { STATUS_BY_VALUE } from "./features/applications/constants";
import { APPLICATIONS, AVATAR_URL, ME, TOKENS, apiError, listPage } from "./test/fixtures";
import { renderApp } from "./test/renderApp";

vi.mock("./api/applications");
vi.mock("./api/auth");

const [complete, minimal] = APPLICATIONS;
const rowLabel = (a) => `${a.position} chez ${a.company}`;

describe("parcours applicatif", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    tokenStorage.set(TOKENS);
    authApi.getMe.mockResolvedValue(ME);
    api.listApplications.mockResolvedValue(listPage());
    api.getApplication.mockImplementation((id) => Promise.resolve(APPLICATIONS.find((a) => a.id === Number(id))));
  });

  it("redirige vers la connexion sans token", async () => {
    tokenStorage.clear();
    renderApp();
    expect(await screen.findByRole("button", { name: "Se connecter" })).toBeInTheDocument();
  });

  it("affiche la liste puis transmet le filtre de statut à l'API", async () => {
    renderApp();
    expect(await screen.findByText(complete.position)).toBeInTheDocument();
    expect(screen.getByText(`${APPLICATIONS.length} candidatures`)).toBeInTheDocument();
    expect(await screen.findByText(ME.full_name)).toBeInTheDocument();
    expect(api.listApplications).toHaveBeenCalledWith(expect.objectContaining({ page: 1, ordering: "-created_at" }));

    await userEvent.click(screen.getByRole("combobox", { name: "Statut" }));
    await userEvent.click(await screen.findByRole("option", { name: STATUS_BY_VALUE.offer.label }));

    await waitFor(() =>
      expect(api.listApplications).toHaveBeenLastCalledWith(expect.objectContaining({ status: "offer", page: 1 }))
    );
  });

  it("affiche « Tous » dans le filtre de statut par défaut", async () => {
    renderApp();
    expect(await screen.findByRole("combobox", { name: "Statut" })).toHaveTextContent("Tous");
  });

  it("réinitialise recherche et filtres", async () => {
    renderApp();
    const reset = await screen.findByRole("button", { name: "Réinitialiser" });
    expect(reset).toBeDisabled();

    await userEvent.type(screen.getByRole("textbox", { name: "Rechercher" }), complete.company);
    await userEvent.click(screen.getByRole("combobox", { name: "Statut" }));
    await userEvent.click(await screen.findByRole("option", { name: STATUS_BY_VALUE.offer.label }));
    await waitFor(() =>
      expect(api.listApplications).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: "offer", search: complete.company })
      )
    );

    await userEvent.click(reset);

    await waitFor(() =>
      expect(api.listApplications).toHaveBeenLastCalledWith({ ordering: "-created_at", page: 1 })
    );
    expect(screen.getByRole("textbox", { name: "Rechercher" })).toHaveValue("");
    expect(screen.getByRole("combobox", { name: "Statut" })).toHaveTextContent("Tous");
    expect(reset).toBeDisabled();
  });

  it("affiche un état vide avec appel à l'action", async () => {
    api.listApplications.mockResolvedValue(listPage([]));
    renderApp();
    expect(await screen.findByText("Aucune candidature pour l'instant")).toBeInTheDocument();
  });

  it("affiche une erreur avec un bouton Réessayer", async () => {
    api.listApplications.mockRejectedValue(new Error("réseau"));
    renderApp();
    expect(await screen.findByText("Impossible de charger les candidatures.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Réessayer" })).toBeInTheDocument();
  });

  it("change le statut depuis la ligne de façon optimiste", async () => {
    let resolve;
    api.updateApplication.mockImplementation(() => new Promise((r) => { resolve = r; }));
    renderApp();

    await userEvent.click(await screen.findByRole("combobox", { name: `Statut de ${rowLabel(minimal)}` }));
    await userEvent.click(await screen.findByRole("option", { name: STATUS_BY_VALUE.offer.label }));

    // Mis à jour avant même la réponse du serveur.
    const row = screen.getByText(minimal.position).closest("tr");
    expect(within(row).getByText(STATUS_BY_VALUE.offer.label)).toBeInTheDocument();
    expect(api.updateApplication.mock.calls[0][0]).toEqual({ id: minimal.id, status: "offer" });
    resolve({ ...minimal, status: "offer" });
  });

  it("supprime après confirmation", async () => {
    api.deleteApplication.mockResolvedValue({});
    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: `Supprimer ${rowLabel(minimal)}` }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Supprimer" }));

    await waitFor(() => expect(api.deleteApplication.mock.calls[0]?.[0]).toBe(minimal.id));
    expect(await screen.findByText(/supprimée/)).toBeInTheDocument();
  });

  it("ouvre le détail au clic sur une ligne", async () => {
    renderApp();
    await userEvent.click(await screen.findByText(complete.position));
    expect(await screen.findByRole("heading", { name: complete.position })).toBeInTheDocument();
    expect(screen.getByText(complete.notes)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Voir l'offre/ })).toHaveAttribute("href", complete.job_url);
  });

  it("affiche « introuvable » pour une candidature inexistante", async () => {
    api.getApplication.mockRejectedValue(apiError(404));
    renderApp("/applications/999");
    expect(await screen.findByText("Cette candidature n'existe pas ou a été supprimée.")).toBeInTheDocument();
  });
});

describe("profil", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    tokenStorage.set(TOKENS);
    authApi.getMe.mockResolvedValue(ME);
    api.listApplications.mockResolvedValue(listPage());
  });

  it("modifie le profil depuis le menu du compte", async () => {
    const newCity = `${ME.location} (modifié)`;
    authApi.updateMe.mockImplementation((data) => Promise.resolve({ ...ME, ...data }));
    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "Menu du compte" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Mon profil" }));

    const city = await screen.findByLabelText("Ville");
    expect(city).toHaveValue(ME.location);
    await userEvent.clear(city);
    await userEvent.type(city, newCity);
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() =>
      expect(authApi.updateMe.mock.calls[0]?.[0]).toMatchObject({ location: newCity, first_name: ME.first_name })
    );
    expect(await screen.findByText("Profil mis à jour.")).toBeInTheDocument();
  });

  it("envoie la photo choisie et refuse un fichier trop lourd", async () => {
    authApi.uploadAvatar.mockResolvedValue({ ...ME, avatar: AVATAR_URL });
    renderApp("/profile");
    const input = await screen.findByTestId("avatar-input");

    const big = new File([new Uint8Array(3 * 1024 * 1024)], "big.png", { type: "image/png" });
    await userEvent.upload(input, big);
    expect(await screen.findByText("La photo ne doit pas dépasser 2 Mo.")).toBeInTheDocument();
    expect(authApi.uploadAvatar).not.toHaveBeenCalled();

    const photo = new File(["png"], "moi.png", { type: "image/png" });
    await userEvent.upload(input, photo);
    await waitFor(() => expect(authApi.uploadAvatar.mock.calls[0]?.[0]).toBe(photo));
    expect(await screen.findByRole("button", { name: "Changer la photo" })).toBeInTheDocument();
  });

  it("revient à l'accueil depuis la page de profil", async () => {
    renderApp("/profile");
    await userEvent.click(await screen.findByRole("link", { name: "Retour à l'accueil" }));
    expect(await screen.findByRole("heading", { name: "Candidatures" })).toBeInTheDocument();
  });
});

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ApplicationForm from "./ApplicationForm";
import { APPLICATIONS, apiError } from "../../test/fixtures";

const [complete] = APPLICATIONS;

describe("ApplicationForm", () => {
  it("bloque l'envoi si les champs obligatoires sont vides", async () => {
    const onSubmit = vi.fn();
    render(<ApplicationForm onSubmit={onSubmit} />);

    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(await screen.findAllByText("Champ obligatoire")).toHaveLength(2);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("envoie applied_at à null quand la date est vide", async () => {
    const onSubmit = vi.fn().mockResolvedValue();
    render(<ApplicationForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText(/Entreprise/), complete.company);
    await userEvent.type(screen.getByLabelText(/Poste/), complete.position);
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ company: complete.company, position: complete.position, status: "to_apply", applied_at: null })
    );
  });

  it("accepte les null renvoyés par l'API dans les valeurs initiales", () => {
    render(
      <ApplicationForm
        defaultValues={{ ...complete, applied_at: null, notes: null }}
        onSubmit={vi.fn()}
      />
    );
    expect(screen.getByLabelText(/Entreprise/)).toHaveValue(complete.company);
    expect(screen.getByLabelText(/Notes/)).toHaveValue("");
  });

  it("affiche les erreurs de validation renvoyées par le serveur", async () => {
    const onSubmit = vi.fn().mockRejectedValue(
      apiError(400, { job_url: ["Saisissez une URL valide."], non_field_errors: ["Doublon détecté."] })
    );
    render(<ApplicationForm defaultValues={complete} onSubmit={onSubmit} />);

    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(await screen.findByText("Saisissez une URL valide.")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Doublon détecté.");
  });
});

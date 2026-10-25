import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../../api/auth";

// La réponse du PATCH est le profil à jour : on remplace directement le cache ["me"].
function useMeMutation(mutationFn) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (user) => qc.setQueryData(["me"], user),
  });
}

export const useUpdateMe = () => useMeMutation(api.updateMe);
export const useUploadAvatar = () => useMeMutation(api.uploadAvatar);
export const useRemoveAvatar = () => useMeMutation(api.removeAvatar);

import { api } from "./client";

export const obtainToken = (email, password) =>
  api.post("/auth/token/", { email, password }).then((r) => r.data);
export const getMe = () => api.get("/auth/me/").then((r) => r.data);
export const updateMe = (data) => api.patch("/auth/me/", data).then((r) => r.data);

export const uploadAvatar = (file) => {
  const body = new FormData();
  body.append("avatar", file);
  return api.patch("/auth/me/", body).then((r) => r.data);
};
export const removeAvatar = () => updateMe({ avatar: null });

type AccountContext = { kind: string };

export const redirectToDashboard = (context: AccountContext): void => {
  window.location.assign(context.kind === "terapeuta" ? "/terapeuta" : "/user");
};

export const redirectToLogin = (area: "user" | "terapeuta" = "user"): void => {
  window.location.assign(`/${area}/login`);
};

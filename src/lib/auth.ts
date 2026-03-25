const AUTH_KEY = "b2b_auth_token";

export const login = () => {
  localStorage.setItem(AUTH_KEY, "true");
};

export const logout = () => {
  localStorage.removeItem(AUTH_KEY);
};

export const isAuthenticated = () => {
  return localStorage.getItem(AUTH_KEY) === "true";
};

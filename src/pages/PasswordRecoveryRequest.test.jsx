import React from "react";
import {fireEvent, render, screen} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {LanguageProvider} from "../language";
import LoginRegister from "./LoginRegister";

test.each([
  ["en", "Forgot password?", "Registered email", "Send reset link", /If an account matches/],
  ["bg", "Забравена парола?", "Имейл за регистрация", "Изпрати връзка за смяна", /Ако има акаунт с този имейл/],
])("shows a generic recovery confirmation in %s", async (language, open, label, submit, confirmation) => {
  const originalFetch = global.fetch;
  global.fetch = jest.fn()
    .mockResolvedValueOnce({ok: true, json: async () => ({enabled: true})})
    .mockResolvedValueOnce({status: 202});
  try {
    localStorage.setItem("colonize-mars-language", language);
    render(<LanguageProvider>
      <MemoryRouter future={{v7_startTransition: true, v7_relativeSplatPath: true}}>
        <LoginRegister />
      </MemoryRouter>
    </LanguageProvider>);
    fireEvent.click(await screen.findByRole("button", {name: open}));
    fireEvent.change(screen.getByLabelText(label), {target: {value: "synthetic@example.test"}});
    fireEvent.click(screen.getByRole("button", {name: submit}));
    expect(await screen.findByText(confirmation)).toBeTruthy();
    expect(global.fetch).toHaveBeenLastCalledWith("/password-reset/request", expect.objectContaining({
      method: "POST", body: JSON.stringify({email: "synthetic@example.test"}),
    }));
  } finally {
    global.fetch = originalFetch;
    localStorage.removeItem("colonize-mars-language");
  }
});

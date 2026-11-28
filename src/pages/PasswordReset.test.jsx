import React from "react";
import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import {MemoryRouter, useLocation} from "react-router-dom";
import {LanguageProvider} from "../language";
import PasswordReset from "./PasswordReset";

function CurrentUrl() {
  const {search} = useLocation();
  return <output data-testid="search">{search}</output>;
}

test.each([
  ["en", "New password", "Confirm password", "Save new password", "Password updated. Log in with your new password."],
  ["bg", "Нова парола", "Потвърди паролата", "Запази новата парола", "Паролата е променена. Влез с новата си парола."],
])("submits the private link in %s and removes the token from the address", async (language, password, confirmation, submit, success) => {
  const token = "a".repeat(64);
  const originalFetch = global.fetch;
  global.fetch = jest.fn().mockResolvedValue({status: 204});
  try {
    localStorage.setItem("colonize-mars-language", language);
    render(<LanguageProvider>
      <MemoryRouter initialEntries={["/password-reset?token=" + token]} future={{v7_startTransition: true, v7_relativeSplatPath: true}}>
        <PasswordReset />
        <CurrentUrl />
      </MemoryRouter>
    </LanguageProvider>);
    await waitFor(() => expect(screen.getByTestId("search").textContent).toBe(""));
    for (const label of [password, confirmation]) {
      fireEvent.change(screen.getByLabelText(label), {target: {value: "fixture-new-password"}});
    }
    fireEvent.click(screen.getByRole("button", {name: submit}));
    expect(await screen.findByText(success)).toBeTruthy();
    expect(global.fetch).toHaveBeenCalledWith("/password-reset", expect.objectContaining({
      method: "POST", body: JSON.stringify({token, password: "fixture-new-password"}),
    }));
    expect(screen.queryByLabelText(password)).toBeNull();
  } finally {
    global.fetch = originalFetch;
    localStorage.clear();
  }
});

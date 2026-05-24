import React from "react";
import { render, screen } from "@testing-library/react";
import Login from "./pages/Login";

jest.mock("./lib/auth", () => ({
  getCurrentUser: jest.fn().mockResolvedValue(null),
  signIn: jest.fn(),
  signUp: jest.fn(),
  signOut: jest.fn()
}));

jest.mock("./contexts/AuthContext", () => ({
  useAuth: () => ({
    refreshUser: jest.fn()
  })
}));

test("renders the login screen", () => {
  render(<Login />);

  expect(screen.getByText("Kostenlos AI")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Show password" })).toBeInTheDocument();
  expect(screen.getByText("Your Free Multi-AI Assistant")).toBeInTheDocument();
});

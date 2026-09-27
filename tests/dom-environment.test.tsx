// @vitest-environment happy-dom

// Proves the DOM test environment works: React can render, happy-dom backs
// the DOM, jest-dom assertions run, and this file is picked up by `npm test`.
// It renders a trivial inline element and imports no application code —
// no triage components exist yet.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

function Toggle() {
  const [clicked, setClicked] = useState(false);
  return <button onClick={() => setClicked(true)}>{clicked ? "Clicked" : "Hello, TriageDesk"}</button>;
}

describe("DOM test environment", () => {
  it("renders, reacts to a user click, and supports jest-dom assertions", async () => {
    const user = userEvent.setup();
    render(<Toggle />);

    const button = screen.getByRole("button", { name: "Hello, TriageDesk" });
    expect(button).toBeInTheDocument();

    await user.click(button);

    expect(screen.getByRole("button", { name: "Clicked" })).toHaveTextContent("Clicked");
  });
});

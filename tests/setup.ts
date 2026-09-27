// Registers @testing-library/jest-dom's matchers (toBeInTheDocument, etc.) on
// Vitest's `expect`. Loaded for every test file; it only extends `expect` and
// touches no DOM globals, so it is inert for the existing node-environment
// backend tests.
import "@testing-library/jest-dom/vitest";

// This project does not use Vitest's `globals: true`, so React Testing
// Library cannot auto-detect a test framework to register its cleanup with.
// Registering it explicitly unmounts rendered components after each test so
// DOM-environment test files don't leak markup between tests. Importing
// `cleanup` does not touch the DOM at import time, so this is inert for the
// existing node-environment backend tests too.
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(cleanup);

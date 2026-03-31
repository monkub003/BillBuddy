import fc from "fast-check";
import {
  successResponse,
  errorResponse,
  mapErrorToStatus,
} from "../../src/middleware/responseHelper";

// Feature: billbuddy-mvp, Property 25: API response envelope conformance
describe("Property 25: API response envelope conformance", () => {
  /**
   * **Validates: Requirements 13.1, 13.2, 13.3**
   *
   * For any API response from the Backend, the response body SHALL conform to
   * { data, error } where on success data is non-null and error is null, and
   * on failure data is null and error is a non-empty string.
   */
  it("success responses have non-null data and null error", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.string({ minLength: 1 }),
          fc.integer(),
          fc.record({ id: fc.string(), value: fc.integer() }),
          fc.array(fc.integer())
        ),
        (payload) => {
          const response = successResponse(payload);
          expect(response).toHaveProperty("data");
          expect(response).toHaveProperty("error");
          expect(response.data).not.toBeNull();
          expect(response.error).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it("error responses have null data and non-empty error string", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        (errorMsg) => {
          const response = errorResponse(errorMsg);
          expect(response).toHaveProperty("data");
          expect(response).toHaveProperty("error");
          expect(response.data).toBeNull();
          expect(response.error).toBe(errorMsg);
          expect(typeof response.error).toBe("string");
          expect(response.error!.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: billbuddy-mvp, Property 26: HTTP status codes match error types
describe("Property 26: HTTP status codes match error types", () => {
  /**
   * **Validates: Requirements 13.4**
   *
   * For any API response, the HTTP status code SHALL be 200 for successful
   * requests, 400 for validation errors, 401 for authentication errors,
   * 403 for authorization errors, and 500 for internal server errors.
   */
  const validationErrors = [
    "amount must be positive",
    "invalid category",
    "invalid due date",
    "invalid email",
    "password too short",
    "email already registered",
    "income must be positive",
  ];

  const authenticationErrors = ["invalid credentials", "unauthorized"];

  const authorizationErrors = ["access denied"];

  it("validation errors map to 400", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...validationErrors),
        (error) => {
          expect(mapErrorToStatus(error)).toBe(400);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("authentication errors map to 401", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...authenticationErrors),
        (error) => {
          expect(mapErrorToStatus(error)).toBe(401);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("authorization errors map to 403", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...authorizationErrors),
        (error) => {
          expect(mapErrorToStatus(error)).toBe(403);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("unknown errors map to 500", () => {
    const knownErrors = new Set([
      ...validationErrors,
      ...authenticationErrors,
      ...authorizationErrors,
    ]);

    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((s) => !knownErrors.has(s)),
        (error) => {
          expect(mapErrorToStatus(error)).toBe(500);
        }
      ),
      { numRuns: 100 }
    );
  });
});

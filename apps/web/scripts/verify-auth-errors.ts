/**
 * Auth bridge error model verification (#29 Definition of Done).
 * Run via: pnpm exec tsx scripts/verify-auth-errors.ts
 */
import {
  conflictResponse,
  forbiddenResponse,
  notFoundResponse,
  parseApiErrorBody,
  unauthorizedResponse,
  validationErrorResponse,
  type ApiErrorCode,
} from "../src/lib/auth/api-error";

const cases: Array<{
  name: string;
  response: Response;
  expectedStatus: number;
  expectedCode: ApiErrorCode;
}> = [
  {
    name: "401 unauthorized",
    response: unauthorizedResponse(),
    expectedStatus: 401,
    expectedCode: "unauthorized",
  },
  {
    name: "403 forbidden",
    response: forbiddenResponse(),
    expectedStatus: 403,
    expectedCode: "forbidden",
  },
  {
    name: "404 not_found",
    response: notFoundResponse(),
    expectedStatus: 404,
    expectedCode: "not_found",
  },
  {
    name: "409 conflict",
    response: conflictResponse(),
    expectedStatus: 409,
    expectedCode: "conflict",
  },
  {
    name: "400 validation",
    response: validationErrorResponse("Invalid request body"),
    expectedStatus: 400,
    expectedCode: "validation",
  },
];

async function main() {
  for (const testCase of cases) {
    if (testCase.response.status !== testCase.expectedStatus) {
      throw new Error(
        `${testCase.name}: expected status ${testCase.expectedStatus}, got ${testCase.response.status}`,
      );
    }

    const body = await parseApiErrorBody(testCase.response.clone());
    if (!body) {
      throw new Error(`${testCase.name}: response is not OpenAPI ErrorBody shape`);
    }
    if (body.error.code !== testCase.expectedCode) {
      throw new Error(
        `${testCase.name}: expected code ${testCase.expectedCode}, got ${body.error.code}`,
      );
    }
    if (!body.error.message) {
      throw new Error(`${testCase.name}: message must be non-empty`);
    }
  }

  console.log("PASS: auth error model matches OpenAPI ErrorBody");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

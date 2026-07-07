// Augments Node.js Error to carry HTTP status codes — used throughout the app
// in place of a custom error class (e.g. `err.statusCode = 404; throw err`).
interface Error {
  statusCode?: number;
  code?: string;
}

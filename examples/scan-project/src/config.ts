// Fixture source file used by scan tests.
// Uses multiple access patterns that the scanner should detect.

export const config = {
  databaseUrl: process.env.DATABASE_URL,
  apiKey: process.env["API_KEY"],
  port: Number(process.env.PORT),
  debug: process?.env?.DEBUG === "true",

  // Intentional typo — should be suggested as DATABASE_URL
  dbUrlTypo: process.env.DATABSE_URL,

  // Used but undefined — no contract entry for this one
  unknownKey: process.env.SOMETHING_UNDEFINED,
};

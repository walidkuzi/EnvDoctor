import type { ValueType } from "../types.js";

export function validateNumber(value: string): boolean {
  if (value === "") return false;
  return !Number.isNaN(Number(value)) && value.trim() === value;
}

export function validateBoolean(value: string): boolean {
  return ["true", "false", "1", "0", "yes", "no"].includes(value.toLowerCase());
}

const VALID_URL_PROTOCOLS = new Set([
  "http:", "https:",
  "postgres:", "postgresql:",
  "mysql:", "mongodb:", "mongodb+srv:",
  "redis:", "rediss:",
  "amqp:", "amqps:",
  "sqlite:",
]);

export function validateUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return VALID_URL_PROTOCOLS.has(url.protocol);
  } catch {
    return false;
  }
}

export function validatePort(value: string): boolean {
  if (!validateNumber(value)) return false;
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 65535;
}

export function validateEmail(value: string): boolean {
  // Simple but practical check — not RFC 5322 complete
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function validateEnum(value: string, allowed: string[]): boolean {
  return allowed.includes(value);
}

export function validateType(value: string, type: ValueType, enumValues?: string[]): boolean {
  switch (type) {
    case "string":
      return value.length > 0;
    case "number":
      return validateNumber(value);
    case "boolean":
      return validateBoolean(value);
    case "url":
      return validateUrl(value);
    case "port":
      return validatePort(value);
    case "email":
      return validateEmail(value);
    case "enum":
      return enumValues ? validateEnum(value, enumValues) : value.length > 0;
  }
}

export function typeExample(type: ValueType, enumValues?: string[]): string {
  switch (type) {
    case "number":
      return "42";
    case "boolean":
      return "true";
    case "url":
      return "https://example.com";
    case "port":
      return "3000";
    case "email":
      return "user@example.com";
    case "enum":
      return enumValues ? enumValues[0] : "value";
    case "string":
      return "your_value_here";
  }
}

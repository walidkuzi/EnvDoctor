import type { ValueType } from "../types.js";

export function validateNumber(value: string): boolean {
  if (value === "") return false;
  return !Number.isNaN(Number(value)) && value.trim() === value;
}

export function validateBoolean(value: string): boolean {
  return ["true", "false", "1", "0", "yes", "no"].includes(value.toLowerCase());
}

export function validateUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateType(value: string, type: ValueType): boolean {
  switch (type) {
    case "string":
      return value.length > 0;
    case "number":
      return validateNumber(value);
    case "boolean":
      return validateBoolean(value);
    case "url":
      return validateUrl(value);
  }
}

export function inferType(value: string): ValueType {
  if (validateBoolean(value)) return "boolean";
  if (validateNumber(value) && !/^https?:\/\//.test(value)) return "number";
  if (validateUrl(value)) return "url";
  return "string";
}

export function typeExample(type: ValueType): string {
  switch (type) {
    case "number":
      return "3000";
    case "boolean":
      return "true";
    case "url":
      return "https://example.com";
    case "string":
      return "your_value_here";
  }
}

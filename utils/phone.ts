function normalizeSwedishPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (value.trimStart().startsWith("+")) return value;
  if (digits.startsWith("0") && digits.length >= 8) {
    return "+46" + digits.slice(1);
  }
  return value;
}

function isValidInternationalPhone(value: string): boolean {
  return /^\+\d{7,15}$/.test(value.replace(/[\s\-.()]/g, ""));
}

export function phonePromptField(
  key: string,
  label: string,
  defaultValue: string,
) {
  return {
    key,
    label,
    defaultValue,
    canBeEmpty: true,
    validate: (value: string) =>
      !value || isValidInternationalPhone(normalizeSwedishPhone(value)),
    propagateChanges: (value: string): { [key: string]: string } => {
      const digits = value.replace(/\D/g, "");
      if (
        !value.trimStart().startsWith("+") &&
        digits.startsWith("0") &&
        digits.length >= 8
      ) {
        return { [key]: "+46" + digits.slice(1) };
      }
      return {};
    },
    transform: (value: string) => normalizeSwedishPhone(value),
  };
}

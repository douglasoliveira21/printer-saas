export type PersonType = "INDIVIDUAL" | "COMPANY";

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

/** Formats as CPF (000.000.000-00) or CNPJ (00.000.000/0000-00) while typing, based on person type. */
export function formatCpfCnpj(value: string, personType: PersonType): string {
  const digits = onlyDigits(value).slice(0, personType === "INDIVIDUAL" ? 11 : 14);

  if (personType === "INDIVIDUAL") {
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }

  return digits
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

/** Formats as CEP (00000-000) while typing. */
export function formatCep(value: string): string {
  const digits = onlyDigits(value).slice(0, 8);
  return digits.replace(/(\d{5})(\d)/, "$1-$2");
}

export function isValidCpf(value: string): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const digits = cpf.split("").map(Number);
  const checkDigit = (length: number) => {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += digits[i] * (length + 1 - i);
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };

  return checkDigit(9) === digits[9] && checkDigit(10) === digits[10];
}

export function isValidCnpj(value: string): boolean {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;

  const digits = cnpj.split("").map(Number);
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const checkDigit = (nums: number[], weights: number[]) => {
    const sum = nums.reduce((acc, n, i) => acc + n * weights[i], 0);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };

  return checkDigit(digits.slice(0, 12), weights1) === digits[12] && checkDigit(digits.slice(0, 13), weights2) === digits[13];
}

export function isValidCpfOrCnpj(value: string, personType: PersonType): boolean {
  return personType === "INDIVIDUAL" ? isValidCpf(value) : isValidCnpj(value);
}

export function digitsOnly(value: string): string {
  return onlyDigits(value);
}

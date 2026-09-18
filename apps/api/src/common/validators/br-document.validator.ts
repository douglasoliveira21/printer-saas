import { registerDecorator, type ValidationOptions } from 'class-validator';

function onlyDigits(value: string) {
  return value.replace(/\D/g, '');
}

/** Standard CPF check-digit algorithm. */
export function isValidCpf(value: string): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const digits = cpf.split('').map(Number);
  const checkDigit = (length: number) => {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += digits[i] * (length + 1 - i);
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };

  return checkDigit(9) === digits[9] && checkDigit(10) === digits[10];
}

/** Standard CNPJ check-digit algorithm. */
export function isValidCnpj(value: string): boolean {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;

  const digits = cnpj.split('').map(Number);
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const checkDigit = (nums: number[], weights: number[]) => {
    const sum = nums.reduce((acc, n, i) => acc + n * weights[i], 0);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };

  return checkDigit(digits.slice(0, 12), weights1) === digits[12] && checkDigit(digits.slice(0, 13), weights2) === digits[13];
}

/**
 * Validates a document as CPF (11 digits) or CNPJ (14 digits) based on
 * check-digit algorithms — never applied to an empty/undefined value (the
 * field itself stays optional, this only rejects a filled-in bad value).
 */
export function IsCpfOrCnpj(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isCpfOrCnpj',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string' || value.trim() === '') return true;
          const digits = onlyDigits(value);
          if (digits.length === 11) return isValidCpf(value);
          if (digits.length === 14) return isValidCnpj(value);
          return false;
        },
        defaultMessage() {
          return 'CPF/CNPJ inválido';
        },
      },
    });
  };
}

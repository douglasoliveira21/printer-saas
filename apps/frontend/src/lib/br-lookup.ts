import { digitsOnly } from "./br-document";

export interface CnpjLookupResult {
  legalName: string;
  tradeName: string | null;
  email: string | null;
  phone: string | null;
  zipCode: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
}

/** BrasilAPI is a free, public, CORS-enabled Brazilian gov-data proxy — no key needed. Returns null on any failure so callers can silently fall back to manual entry. */
export async function lookupCnpj(cnpj: string): Promise<CnpjLookupResult | null> {
  const digits = digitsOnly(cnpj);
  if (digits.length !== 14) return null;

  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      legalName: data.razao_social ?? "",
      tradeName: data.nome_fantasia || null,
      email: data.email || null,
      phone: data.ddd_telefone_1 || null,
      zipCode: data.cep || null,
      street: data.logradouro || null,
      number: data.numero || null,
      complement: data.complemento || null,
      neighborhood: data.bairro || null,
      city: data.municipio || null,
      state: data.uf || null,
    };
  } catch {
    return null;
  }
}

export interface CepLookupResult {
  street: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
}

/** ViaCEP is a free, public, CORS-enabled Brazilian postal-code lookup — no key needed. */
export async function lookupCep(cep: string): Promise<CepLookupResult | null> {
  const digits = digitsOnly(cep);
  if (digits.length !== 8) return null;

  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.erro) return null;
    return {
      street: data.logradouro || null,
      neighborhood: data.bairro || null,
      city: data.localidade || null,
      state: data.uf || null,
    };
  } catch {
    return null;
  }
}

"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { digitsOnly, formatCep, formatCpfCnpj, type PersonType } from "@/lib/br-document";
import { lookupCep, lookupCnpj } from "@/lib/br-lookup";
import type { CustomerStatus } from "@/lib/types";

export interface CustomerFormValue {
  personType: PersonType;
  legalName: string;
  tradeName: string;
  document: string;
  stateRegistration: string;
  municipalRegistration: string;
  status: CustomerStatus;
  email: string;
  phone: string;
  whatsapp: string;
  financialEmail: string;
  supportEmail: string;
  contactName: string;
  contactRole: string;
  zipCode: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  country: string;
}

export const EMPTY_CUSTOMER_FORM: CustomerFormValue = {
  personType: "COMPANY",
  legalName: "",
  tradeName: "",
  document: "",
  stateRegistration: "",
  municipalRegistration: "",
  status: "ACTIVE",
  email: "",
  phone: "",
  whatsapp: "",
  financialEmail: "",
  supportEmail: "",
  contactName: "",
  contactRole: "",
  zipCode: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  country: "Brasil",
};

const STATUS_OPTIONS: { value: CustomerStatus; label: string }[] = [
  { value: "ACTIVE", label: "Ativo" },
  { value: "INACTIVE", label: "Inativo" },
  { value: "BLOCKED", label: "Bloqueado" },
];

export function CustomerFormFields({
  value,
  onChange,
  showStatus,
}: {
  value: CustomerFormValue;
  onChange: (patch: Partial<CustomerFormValue>) => void;
  showStatus?: boolean;
}) {
  const [lookingUpDocument, setLookingUpDocument] = useState(false);
  const [lookingUpCep, setLookingUpCep] = useState(false);

  async function handleDocumentChange(raw: string) {
    const formatted = formatCpfCnpj(raw, value.personType);
    onChange({ document: formatted });

    if (value.personType !== "COMPANY" || digitsOnly(formatted).length !== 14) return;
    setLookingUpDocument(true);
    try {
      const result = await lookupCnpj(formatted);
      if (!result) return;
      onChange({
        legalName: value.legalName || result.legalName,
        tradeName: value.tradeName || result.tradeName || "",
        email: value.email || result.email || "",
        phone: value.phone || result.phone || "",
        zipCode: value.zipCode || (result.zipCode ? formatCep(result.zipCode) : ""),
        street: value.street || result.street || "",
        number: value.number || result.number || "",
        complement: value.complement || result.complement || "",
        neighborhood: value.neighborhood || result.neighborhood || "",
        city: value.city || result.city || "",
        state: value.state || result.state || "",
      });
    } finally {
      setLookingUpDocument(false);
    }
  }

  async function handleZipCodeChange(raw: string) {
    const formatted = formatCep(raw);
    onChange({ zipCode: formatted });

    if (digitsOnly(formatted).length !== 8) return;
    setLookingUpCep(true);
    try {
      const result = await lookupCep(formatted);
      if (!result) return;
      onChange({
        street: value.street || result.street || "",
        neighborhood: value.neighborhood || result.neighborhood || "",
        city: value.city || result.city || "",
        state: value.state || result.state || "",
      });
    } finally {
      setLookingUpCep(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground">Pessoa/Empresa</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select
              value={value.personType}
              onValueChange={(v) => {
                const personType = (v ?? "COMPANY") as PersonType;
                onChange({ personType, document: formatCpfCnpj(value.document, personType) });
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue>{(v: PersonType) => (v === "INDIVIDUAL" ? "Pessoa Física" : "Pessoa Jurídica")}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="COMPANY">Pessoa Jurídica</SelectItem>
                <SelectItem value="INDIVIDUAL">Pessoa Física</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {showStatus && (
            <div className="space-y-2">
              <Label>Situação</Label>
              <Select value={value.status} onValueChange={(v) => onChange({ status: (v ?? "ACTIVE") as CustomerStatus })}>
                <SelectTrigger className="w-full">
                  <SelectValue>{(v: CustomerStatus) => STATUS_OPTIONS.find((o) => o.value === v)?.label ?? v}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="legalName">{value.personType === "INDIVIDUAL" ? "Nome *" : "Razão social *"}</Label>
          <Input id="legalName" required value={value.legalName} onChange={(e) => onChange({ legalName: e.target.value })} />
        </div>
        {value.personType === "COMPANY" && (
          <div className="space-y-2">
            <Label htmlFor="tradeName">Nome fantasia</Label>
            <Input id="tradeName" value={value.tradeName} onChange={(e) => onChange({ tradeName: e.target.value })} />
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="document">{value.personType === "INDIVIDUAL" ? "CPF" : "CNPJ"}</Label>
            <Input
              id="document"
              value={value.document}
              onChange={(e) => handleDocumentChange(e.target.value)}
              placeholder={lookingUpDocument ? "Buscando dados..." : undefined}
            />
          </div>
          {value.personType === "COMPANY" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="stateRegistration">Inscrição Estadual</Label>
                <Input id="stateRegistration" value={value.stateRegistration} onChange={(e) => onChange({ stateRegistration: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="municipalRegistration">Inscrição Municipal</Label>
                <Input
                  id="municipalRegistration"
                  value={value.municipalRegistration}
                  onChange={(e) => onChange({ municipalRegistration: e.target.value })}
                />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground">Contato</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="contactName">Nome do responsável</Label>
            <Input id="contactName" value={value.contactName} onChange={(e) => onChange({ contactName: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contactRole">Cargo/setor</Label>
            <Input id="contactRole" value={value.contactRole} onChange={(e) => onChange({ contactRole: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail principal</Label>
            <Input id="email" type="email" value={value.email} onChange={(e) => onChange({ email: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Telefone</Label>
            <Input id="phone" value={value.phone} onChange={(e) => onChange({ phone: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="whatsapp">WhatsApp</Label>
            <Input id="whatsapp" value={value.whatsapp} onChange={(e) => onChange({ whatsapp: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="financialEmail">E-mail financeiro</Label>
            <Input id="financialEmail" type="email" value={value.financialEmail} onChange={(e) => onChange({ financialEmail: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="supportEmail">E-mail para suporte</Label>
            <Input id="supportEmail" type="email" value={value.supportEmail} onChange={(e) => onChange({ supportEmail: e.target.value })} />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground">Endereço</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="zipCode">CEP</Label>
            <Input
              id="zipCode"
              value={value.zipCode}
              onChange={(e) => handleZipCodeChange(e.target.value)}
              placeholder={lookingUpCep ? "Buscando endereço..." : undefined}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="street">Rua/Avenida</Label>
            <Input id="street" value={value.street} onChange={(e) => onChange({ street: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="number">Número</Label>
            <Input id="number" value={value.number} onChange={(e) => onChange({ number: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="complement">Complemento</Label>
            <Input id="complement" value={value.complement} onChange={(e) => onChange({ complement: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="neighborhood">Bairro</Label>
            <Input id="neighborhood" value={value.neighborhood} onChange={(e) => onChange({ neighborhood: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">Cidade</Label>
            <Input id="city" value={value.city} onChange={(e) => onChange({ city: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="state">Estado</Label>
            <Input id="state" value={value.state} onChange={(e) => onChange({ state: e.target.value })} maxLength={2} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="country">País</Label>
            <Input id="country" value={value.country} onChange={(e) => onChange({ country: e.target.value })} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function customerFormToInput(value: CustomerFormValue) {
  return {
    personType: value.personType,
    legalName: value.legalName,
    tradeName: value.tradeName || undefined,
    document: value.document || undefined,
    stateRegistration: value.stateRegistration || undefined,
    municipalRegistration: value.municipalRegistration || undefined,
    email: value.email || undefined,
    phone: value.phone || undefined,
    whatsapp: value.whatsapp || undefined,
    financialEmail: value.financialEmail || undefined,
    supportEmail: value.supportEmail || undefined,
    contactName: value.contactName || undefined,
    contactRole: value.contactRole || undefined,
    zipCode: value.zipCode || undefined,
    street: value.street || undefined,
    number: value.number || undefined,
    complement: value.complement || undefined,
    neighborhood: value.neighborhood || undefined,
    city: value.city || undefined,
    state: value.state || undefined,
    country: value.country || undefined,
  };
}

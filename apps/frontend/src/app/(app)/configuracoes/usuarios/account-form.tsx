"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCustomers } from "@/hooks/use-customers";
import type { AccountType, TenantUser, UserAccountInput } from "@/hooks/use-users";
import {
  CUSTOMER_NOTIFICATIONS,
  CUSTOMER_PERMISSIONS,
  STAFF_NOTIFICATIONS,
  STAFF_PERMISSIONS,
  allStaffKeys,
} from "./permission-checklists";

export interface AccountFormValue extends UserAccountInput {}

function initialFromUser(user?: TenantUser): AccountFormValue {
  if (!user) {
    return {
      name: "",
      email: "",
      password: "",
      accountType: "STAFF",
      viewAllCustomers: true,
      visibleCustomerIds: [],
      permissionKeys: [],
      notifyTicketAssigned: false,
      notifyTicketSlaExpiring: false,
      notifyTicketSlaBreached: false,
      notifyTicketClosed: false,
      notifyTicketCommented: false,
    };
  }
  return {
    name: user.name,
    email: user.email,
    password: "",
    accountType: user.accountType,
    customerId: user.customerId ?? undefined,
    viewAllCustomers: user.viewAllCustomers,
    visibleCustomerIds: user.visibleCustomers.map((v) => v.customer.id),
    permissionKeys: user.directPermissions.map((p) => p.permission.key),
    notifyTicketAssigned: user.notifyTicketAssigned,
    notifyTicketSlaExpiring: user.notifyTicketSlaExpiring,
    notifyTicketSlaBreached: user.notifyTicketSlaBreached,
    notifyTicketClosed: user.notifyTicketClosed,
    notifyTicketCommented: user.notifyTicketCommented,
  };
}

export function AccountForm({
  mode,
  user,
  onSubmit,
  submitting,
  submitLabel,
}: {
  mode: "create" | "edit";
  user?: TenantUser;
  onSubmit: (value: AccountFormValue) => Promise<void>;
  submitting: boolean;
  submitLabel: string;
}) {
  const [value, setValue] = useState<AccountFormValue>(() => initialFromUser(user));
  const { data: customers } = useCustomers();

  useEffect(() => {
    setValue(initialFromUser(user));
  }, [user]);

  const permissionList = value.accountType === "STAFF" ? STAFF_PERMISSIONS : CUSTOMER_PERMISSIONS;
  const notificationList = value.accountType === "STAFF" ? STAFF_NOTIFICATIONS : CUSTOMER_NOTIFICATIONS;
  const selectedKeys = new Set(value.permissionKeys ?? []);
  const isAdmin = value.accountType === "STAFF" && allStaffKeys().every((k) => selectedKeys.has(k)) && allStaffKeys().length > 0;

  function setAccountType(accountType: AccountType) {
    setValue((prev) => ({ ...prev, accountType, permissionKeys: [], customerId: undefined }));
  }

  function toggleAdmin(checked: boolean) {
    setValue((prev) => ({ ...prev, permissionKeys: checked ? allStaffKeys() : [] }));
  }

  function togglePermission(keys: string[], checked: boolean) {
    setValue((prev) => {
      const set = new Set(prev.permissionKeys ?? []);
      for (const k of keys) (checked ? set.add(k) : set.delete(k));
      return { ...prev, permissionKeys: [...set] };
    });
  }

  function toggleVisibleCustomer(customerId: string, checked: boolean) {
    setValue((prev) => {
      const set = new Set(prev.visibleCustomerIds ?? []);
      checked ? set.add(customerId) : set.delete(customerId);
      return { ...prev, visibleCustomerIds: [...set] };
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const payload: AccountFormValue = { ...value };
    if (mode === "edit" && !payload.password) delete payload.password;
    await onSubmit(payload);
  }

  const canSubmit =
    value.name.trim() &&
    value.email.trim() &&
    (mode === "create" ? (value.password ?? "").length >= 8 : true) &&
    (value.accountType === "STAFF" || !!value.customerId);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground">Tipo de conta</h3>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="accountType" checked={value.accountType === "STAFF"} onChange={() => setAccountType("STAFF")} disabled={mode === "edit"} />
            Conta de colaborador
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="accountType" checked={value.accountType === "CUSTOMER"} onChange={() => setAccountType("CUSTOMER")} disabled={mode === "edit"} />
            Conta de cliente
          </label>
        </div>

        {value.accountType === "CUSTOMER" && (
          <div className="space-y-2">
            <Label>Cliente *</Label>
            <Select value={value.customerId ?? ""} onValueChange={(v) => setValue((prev) => ({ ...prev, customerId: v ?? undefined }))}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione o cliente">
                  {(v: string) => (v ? customers?.data.find((c) => c.id === v)?.tradeName || customers?.data.find((c) => c.id === v)?.legalName || v : "Selecione o cliente")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {customers?.data.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.tradeName || c.legalName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 border-t border-border pt-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nome *</Label>
          <Input id="name" required value={value.name} onChange={(e) => setValue((prev) => ({ ...prev, name: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">E-mail *</Label>
          <Input id="email" type="email" required disabled={mode === "edit"} value={value.email} onChange={(e) => setValue((prev) => ({ ...prev, email: e.target.value }))} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="password">{mode === "create" ? "Senha *" : "Nova senha (deixe em branco para manter)"}</Label>
          <Input
            id="password"
            type="password"
            minLength={8}
            required={mode === "create"}
            value={value.password ?? ""}
            onChange={(e) => setValue((prev) => ({ ...prev, password: e.target.value }))}
          />
        </div>
      </div>

      <div className="space-y-3 border-t border-border pt-4">
        <h3 className="text-sm font-semibold text-muted-foreground">Permissões</h3>
        {value.accountType === "STAFF" && (
          <label className="flex items-center gap-2 text-sm font-medium">
            <Checkbox checked={isAdmin} onCheckedChange={(v) => toggleAdmin(v === true)} />
            Administrador
          </label>
        )}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {permissionList.map((item) => (
            <label key={item.label} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={item.keys.every((k) => selectedKeys.has(k))}
                disabled={isAdmin}
                onCheckedChange={(v) => togglePermission(item.keys, v === true)}
              />
              {item.label}
            </label>
          ))}
        </div>
      </div>

      {value.accountType === "STAFF" && (
        <div className="space-y-3 border-t border-border pt-4">
          <h3 className="text-sm font-semibold text-muted-foreground">Visibilidade de clientes</h3>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={value.viewAllCustomers}
              onCheckedChange={(v) => setValue((prev) => ({ ...prev, viewAllCustomers: v === true }))}
            />
            Permitir visualizar todos os clientes da sua empresa
          </label>
          {!value.viewAllCustomers && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 rounded-md border border-border p-3">
              {customers?.data.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={(value.visibleCustomerIds ?? []).includes(c.id)}
                    onCheckedChange={(v) => toggleVisibleCustomer(c.id, v === true)}
                  />
                  {c.tradeName || c.legalName}
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="space-y-3 border-t border-border pt-4">
        <h3 className="text-sm font-semibold text-muted-foreground">Notificações</h3>
        <p className="text-sm text-muted-foreground">Esta conta deve receber notificações por e-mail quando:</p>
        <div className="space-y-2">
          {notificationList.map((item) => (
            <label key={item.field} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={!!value[item.field]}
                onCheckedChange={(v) => setValue((prev) => ({ ...prev, [item.field]: v === true }))}
              />
              {item.label}
            </label>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={!canSubmit || submitting}>
          {submitting ? "Salvando..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}

"use client";

import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getApiErrorMessage } from "@/lib/api-client";
import {
  SNMP_V3_AUTH_PROTOCOLS,
  SNMP_V3_PRIV_PROTOCOLS,
  useCreateSnmpCredential,
  useUpdateSnmpCredential,
  type SnmpCredential,
  type SnmpCredentialInput,
  type SnmpV3SecurityLevel,
} from "@/hooks/use-snmp-credentials";

const SECURITY_LEVEL_LABEL: Record<SnmpV3SecurityLevel, string> = {
  noAuthNoPriv: "Sem autenticação / sem privacidade",
  authNoPriv: "Autenticação apenas",
  authPriv: "Autenticação + privacidade (recomendado)",
};

const EMPTY: SnmpCredentialInput = {
  name: "",
  userName: "",
  securityLevel: "authPriv",
  authenticationProtocol: "SHA256",
  authenticationPassword: "",
  privacyProtocol: "AES128",
  privacyPassword: "",
  contextName: "",
};

export function SnmpCredentialDialog({
  credential,
  open,
  onOpenChange,
}: {
  credential: SnmpCredential | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [form, setForm] = useState<SnmpCredentialInput>(EMPTY);
  const createCredential = useCreateSnmpCredential();
  const updateCredential = useUpdateSnmpCredential();
  const isEditing = !!credential;
  const pending = createCredential.isPending || updateCredential.isPending;

  useEffect(() => {
    if (!open) return;
    if (credential) {
      setForm({
        name: credential.name,
        userName: credential.userName,
        securityLevel: credential.securityLevel,
        authenticationProtocol: credential.authenticationProtocol ?? "SHA256",
        authenticationPassword: "",
        privacyProtocol: credential.privacyProtocol ?? "AES128",
        privacyPassword: "",
        contextName: credential.contextName ?? "",
      });
    } else {
      setForm(EMPTY);
    }
  }, [open, credential]);

  function patch(update: Partial<SnmpCredentialInput>) {
    setForm((prev) => ({ ...prev, ...update }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      // Only send a password field if the user actually typed something —
      // an empty string on update would otherwise be indistinguishable from
      // "leave it as is" vs "I want to blank it", and the API treats an
      // omitted field as "keep what's stored" (see UpdateSnmpCredentialDto).
      const payload: Partial<SnmpCredentialInput> = { ...form };
      if (!payload.authenticationPassword) delete payload.authenticationPassword;
      if (!payload.privacyPassword) delete payload.privacyPassword;
      if (payload.securityLevel === "noAuthNoPriv") {
        delete payload.authenticationProtocol;
        delete payload.privacyProtocol;
      } else if (payload.securityLevel === "authNoPriv") {
        delete payload.privacyProtocol;
        delete payload.privacyPassword;
      }

      if (isEditing) {
        await updateCredential.mutateAsync({ id: credential!.id, ...payload });
        toast.success("Credencial SNMP v3 atualizada");
      } else {
        await createCredential.mutateAsync(payload as SnmpCredentialInput);
        toast.success("Credencial SNMP v3 cadastrada");
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao salvar credencial"));
    }
  }

  const needsAuth = form.securityLevel !== "noAuthNoPriv";
  const needsPriv = form.securityLevel === "authPriv";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditing ? "Editar credencial SNMP v3" : "Nova credencial SNMP v3"}</DialogTitle>
            <DialogDescription>
              Essa credencial pode ser atribuída a impressoras específicas ou definida como padrão de um Agent.
              {isEditing && " Deixe as senhas em branco para manter as já cadastradas."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                required
                placeholder="Ex.: Credencial padrão HQ"
                value={form.name}
                onChange={(e) => patch({ name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Usuário (Security Name) *</Label>
              <Input required value={form.userName} onChange={(e) => patch({ userName: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label>Nível de segurança *</Label>
              <Select value={form.securityLevel} onValueChange={(v) => v && patch({ securityLevel: v as SnmpV3SecurityLevel })}>
                <SelectTrigger className="w-full">
                  <SelectValue>{(v: string) => SECURITY_LEVEL_LABEL[v as SnmpV3SecurityLevel]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="noAuthNoPriv">{SECURITY_LEVEL_LABEL.noAuthNoPriv}</SelectItem>
                  <SelectItem value="authNoPriv">{SECURITY_LEVEL_LABEL.authNoPriv}</SelectItem>
                  <SelectItem value="authPriv">{SECURITY_LEVEL_LABEL.authPriv}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {needsAuth && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Protocolo de autenticação *</Label>
                  <Select value={form.authenticationProtocol} onValueChange={(v) => v && patch({ authenticationProtocol: v as SnmpCredentialInput["authenticationProtocol"] })}>
                    <SelectTrigger className="w-full">
                      <SelectValue>{(v: string) => v}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {SNMP_V3_AUTH_PROTOCOLS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Senha de autenticação {isEditing ? "" : "*"}</Label>
                  <Input
                    type="password"
                    required={!isEditing}
                    placeholder={isEditing && credential?.hasAuthenticationPassword ? "•••••••• (mantida se em branco)" : undefined}
                    value={form.authenticationPassword}
                    onChange={(e) => patch({ authenticationPassword: e.target.value })}
                  />
                </div>
              </div>
            )}

            {needsPriv && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Protocolo de privacidade *</Label>
                  <Select value={form.privacyProtocol} onValueChange={(v) => v && patch({ privacyProtocol: v as SnmpCredentialInput["privacyProtocol"] })}>
                    <SelectTrigger className="w-full">
                      <SelectValue>{(v: string) => v}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {SNMP_V3_PRIV_PROTOCOLS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Senha de privacidade {isEditing ? "" : "*"}</Label>
                  <Input
                    type="password"
                    required={!isEditing}
                    placeholder={isEditing && credential?.hasPrivacyPassword ? "•••••••• (mantida se em branco)" : undefined}
                    value={form.privacyPassword}
                    onChange={(e) => patch({ privacyPassword: e.target.value })}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Context name (opcional)</Label>
              <Input value={form.contextName ?? ""} onChange={(e) => patch({ contextName: e.target.value || "" })} />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

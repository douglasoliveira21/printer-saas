import { Badge } from "@/components/ui/badge";
import type { Printer } from "@/lib/types";

const STATUS_LABEL: Record<Printer["status"], string> = {
  DISCOVERED: "Descoberta",
  MONITORED: "Monitorada",
  IGNORED: "Ignorada",
  DECOMMISSIONED: "Desativada",
};

const DEVICE_TYPE_LABEL: Partial<Record<Printer["deviceType"], string>> = {
  MFP: "Multifuncional",
  PLOTTER: "Plotter",
};

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString("pt-BR") : "Não disponível";
}

export function PrinterInfoGrid({ printer }: { printer: Printer }) {
  const rows: { label: string; value: React.ReactNode }[] = [
    { label: "Fabricante", value: printer.manufacturer || "Não disponível" },
    { label: "Modelo", value: printer.model || "Não disponível" },
    ...(DEVICE_TYPE_LABEL[printer.deviceType]
      ? [{ label: "Tipo de equipamento", value: DEVICE_TYPE_LABEL[printer.deviceType]! }]
      : []),
    {
      label: "Homologação",
      value: printer.catalogModel ? (
        <Badge variant="default">Homologada — {printer.catalogModel.manufacturer} {printer.catalogModel.model}</Badge>
      ) : (
        <Badge variant="outline">Não homologada</Badge>
      ),
    },
    { label: "Tipo de conexão", value: printer.collectionMethod === "MANUAL" ? "Manual" : "Rede (SNMP)" },
    {
      label: "Credencial SNMP v3",
      value: printer.snmpV3Credential ? (
        <Badge variant="secondary">{printer.snmpV3Credential.name}</Badge>
      ) : (
        <span className="text-muted-foreground">Sem override (v1/v2c ou padrão do Agent)</span>
      ),
    },
    { label: "Endereço IP", value: printer.ip || "Não disponível" },
    { label: "Endereço MAC", value: printer.mac || "Não disponível" },
    { label: "Número de série", value: printer.serial || "Não disponível" },
    { label: "Monitorada desde", value: formatDate(printer.monitoredAt) },
    { label: "Status atual", value: <Badge variant={printer.status === "MONITORED" ? "default" : "outline"}>{STATUS_LABEL[printer.status]}</Badge> },
    { label: "Última comunicação", value: formatDate(printer.lastSeenAt) },
    { label: "Ponto de instalação", value: printer.agent?.hostname || "Não disponível" },
  ];

  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center justify-between gap-3 border-b border-border py-1.5 text-sm">
          <span className="text-muted-foreground">{row.label}</span>
          <span className="font-medium">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

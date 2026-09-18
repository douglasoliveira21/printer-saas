import type { ServiceOrderBillingType, ServiceOrderPriority, ServiceOrderStatus, ServiceOrderType } from "@/lib/types";

export const SERVICE_TYPE_LABEL: Record<ServiceOrderType, string> = {
  CORRECTIVE_MAINTENANCE: "Manutenção corretiva",
  PREVENTIVE_MAINTENANCE: "Manutenção preventiva",
  INSTALLATION: "Instalação",
  EQUIPMENT_REPLACEMENT: "Troca de equipamento",
  DELIVERY_PICKUP: "Entrega/retirada",
  PRINT_ISSUE: "Problema de impressão",
  CONFIGURATION: "Configuração",
  TECHNICAL_SUPPORT: "Suporte técnico",
  OTHER: "Outro",
};

export const PRIORITY_LABEL: Record<ServiceOrderPriority, string> = {
  LOW: "Baixa",
  MEDIUM: "Normal",
  HIGH: "Alta",
  URGENT: "Urgente",
};

export const STATUS_LABEL: Record<ServiceOrderStatus, string> = {
  OPEN: "Aberta",
  SCHEDULED: "Aguardando atendimento",
  IN_PROGRESS: "Em atendimento",
  WAITING_PART: "Aguardando peça",
  WAITING_CUSTOMER: "Aguardando cliente",
  DONE: "Resolvida",
  CANCELLED: "Cancelada",
};

export const BILLING_TYPE_LABEL: Record<ServiceOrderBillingType, string> = {
  CONTRACT: "Incluso no contrato",
  CHARGE_CUSTOMER: "Cobrar cliente",
  WARRANTY: "Garantia",
  COURTESY: "Cortesia",
};

export const SYMPTOM_OPTIONS = [
  "Não imprime",
  "Impressão falhada",
  "Papel atolando",
  "Mancha",
  "Impressão lenta",
  "Não conecta",
  "Erro no painel",
  "Toner baixo",
  "Outro",
];

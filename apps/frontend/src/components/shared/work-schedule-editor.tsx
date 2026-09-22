"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { WorkingHourEntry } from "@/lib/types";

const DAY_LABEL = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

/** Segunda–Sexta 08:00–18:00 — the default starting point whenever an editor needs to be pre-populated. */
export const DEFAULT_WORK_SCHEDULE: WorkingHourEntry[] = [1, 2, 3, 4, 5].map((dayOfWeek) => ({
  dayOfWeek,
  startTime: "08:00",
  endTime: "18:00",
}));

/** Reusable day/start/end editor — used for both a customer's own working hours and the tenant's ("minha empresa"). */
export function WorkScheduleEditor({
  value,
  onChange,
}: {
  value: WorkingHourEntry[];
  onChange: (next: WorkingHourEntry[]) => void;
}) {
  function updateRow(index: number, patch: Partial<WorkingHourEntry>) {
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeRow(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function addRow() {
    onChange([...value, { dayOfWeek: 1, startTime: "08:00", endTime: "18:00" }]);
  }

  return (
    <div className="space-y-2">
      {value.length === 0 && <p className="text-sm text-muted-foreground">Nenhum horário definido.</p>}
      {value.map((row, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <Select value={String(row.dayOfWeek)} onValueChange={(v) => v && updateRow(i, { dayOfWeek: Number(v) })}>
            <SelectTrigger className="w-36">
              <SelectValue>{() => DAY_LABEL[row.dayOfWeek]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {DAY_LABEL.map((label, day) => (
                <SelectItem key={day} value={String(day)}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="time"
            className="w-28"
            value={row.startTime}
            onChange={(e) => updateRow(i, { startTime: e.target.value })}
          />
          <span className="text-sm text-muted-foreground">às</span>
          <Input type="time" className="w-28" value={row.endTime} onChange={(e) => updateRow(i, { endTime: e.target.value })} />
          <Button type="button" variant="ghost" size="icon" className="text-red-600" onClick={() => removeRow(i)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addRow}>
        <Plus className="mr-2 h-4 w-4" />
        Adicionar horário
      </Button>
    </div>
  );
}

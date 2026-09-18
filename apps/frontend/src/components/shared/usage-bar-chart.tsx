"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CHART_COLORS } from "@/lib/chart-colors";
import type { PageUsagePeriod } from "@/lib/types";

export function UsageBarChart({ title, data, isLoading }: { title: string; data: PageUsagePeriod[] | undefined; isLoading?: boolean }) {
  const hasData = (data ?? []).some((d) => d.blackWhite > 0 || d.color > 0 || d.copies > 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : !hasData ? (
          <p className="text-xs text-muted-foreground">Sem dados suficientes ainda.</p>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                <XAxis dataKey="period" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip formatter={(value) => Number(value).toLocaleString("pt-BR")} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="blackWhite" name="P&B" fill={CHART_COLORS[0]} radius={[3, 3, 0, 0]} />
                <Bar dataKey="color" name="Colorida" fill={CHART_COLORS[2]} radius={[3, 3, 0, 0]} />
                <Bar dataKey="copies" name="Digitalizações" fill={CHART_COLORS[1]} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

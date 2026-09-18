"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CHART_COLORS } from "@/lib/chart-colors";

export interface PieSlice {
  label: string;
  value: number;
}

export function PieStatCard({
  title,
  total,
  slices,
  isLoading,
}: {
  title: string;
  /** Big number shown above the chart; defaults to the sum of all slices. */
  total?: number;
  slices: PieSlice[];
  isLoading?: boolean;
}) {
  const totalValue = total ?? slices.reduce((sum, s) => sum + s.value, 0);
  const hasData = slices.some((s) => s.value > 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <>
            <div className="text-2xl font-bold">{totalValue}</div>
            {hasData ? (
              <div className="mt-2 flex items-center gap-4">
                <div className="h-32 w-32 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={slices} dataKey="value" nameKey="label" innerRadius={30} outerRadius={55} paddingAngle={2}>
                        {slices.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => Number(value).toLocaleString("pt-BR")} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="min-w-0 flex-1 space-y-1 text-sm">
                  {slices.map((s, i) => (
                    <li key={s.label} className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5 truncate text-muted-foreground">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <span className="truncate">{s.label}</span>
                      </span>
                      <span className="font-medium">{s.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">Sem dados ainda.</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

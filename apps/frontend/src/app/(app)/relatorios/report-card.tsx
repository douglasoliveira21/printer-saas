"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { downloadReportCsv, useReport } from "@/hooks/use-reports";
import { getApiErrorMessage } from "@/lib/api-client";

export interface ReportColumn {
  key: string;
  header: string;
  format?: (value: unknown) => string;
}

export function ReportCard({
  title,
  path,
  filename,
  columns,
  params,
}: {
  title: string;
  path: string;
  filename: string;
  columns: ReportColumn[];
  params?: Record<string, string | undefined>;
}) {
  const { data, isLoading } = useReport(path, params);
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      await downloadReportCsv(path, filename, params);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao exportar relatório"));
    } finally {
      setDownloading(false);
    }
  }

  const rows = data?.slice(0, 5) ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{title}</CardTitle>
        <Button size="sm" variant="outline" onClick={handleDownload} disabled={downloading}>
          <Download className="mr-2 h-4 w-4" />
          CSV
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-sm text-neutral-400">Carregando...</p>}
        {!isLoading && rows.length === 0 && <p className="text-sm text-neutral-400">Sem dados no período.</p>}
        {rows.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((col) => (
                  <TableHead key={col.key}>{col.header}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow key={i}>
                  {columns.map((col) => (
                    <TableCell key={col.key}>
                      {col.format ? col.format(row[col.key]) : String(row[col.key] ?? "—")}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {data && data.length > 5 && (
          <p className="mt-2 text-xs text-neutral-400">Mostrando 5 de {data.length} — baixe o CSV para ver tudo.</p>
        )}
      </CardContent>
    </Card>
  );
}

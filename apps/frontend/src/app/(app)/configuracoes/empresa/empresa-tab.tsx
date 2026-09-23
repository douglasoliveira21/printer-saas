"use client";

import { CompanyInfoCard } from "./company-info-card";
import { DepartmentsCard } from "./departments-card";
import { CompanyWorkingHoursCard } from "../company-working-hours-card";
import { ClosingTogglesCard } from "./closing-toggles-card";

export function EmpresaTab() {
  return (
    <div className="space-y-6">
      <CompanyInfoCard />
      <DepartmentsCard />
      <CompanyWorkingHoursCard />
      <ClosingTogglesCard />
    </div>
  );
}

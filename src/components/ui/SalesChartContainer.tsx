import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { SalesChart } from "../../components/ui/SalesChart";
import type { AppData } from "../../types";

interface SalesChartContainerProps {
  data: AppData;
}

export function SalesChartContainer({ data }: SalesChartContainerProps) {
  const years = useMemo(() => {
    const allYears = data.sales.map((s) => new Date(s.date).getFullYear());
    return Array.from(new Set(allYears)).sort();
  }, [data.sales]);

  const [view, setView] = useState<"day" | "month" | "year">("day");
  const [selectedMonth, setSelectedMonth] = useState(() =>
    dayjs().format("YYYY-MM"),
  );
  const [selectedYear, setSelectedYear] = useState(() => {
    const currentYear = new Date().getFullYear();
    return years.includes(currentYear)
      ? currentYear
      : (years[0] ?? currentYear);
  });

  useEffect(() => {
    if (years.length > 0 && !years.includes(selectedYear)) {
      setSelectedYear(years[0]);
    }
  }, [years, selectedYear]);

  const chartData = useMemo(() => {
    if (view === "day") {
      const dayMap: Record<string, { sales: number; paid: number }> = {};
      data.sales.forEach((s) => {
        const date = s.date.slice(0, 10);
        if (!dayMap[date]) dayMap[date] = { sales: 0, paid: 0 };
        dayMap[date].sales += s.total;
        dayMap[date].paid += s.paidAmount;
      });
      return Object.entries(dayMap)
        .map(([date, values]) => ({ date, ...values }))
        .sort((a, b) => a.date.localeCompare(b.date));
    }

    if (view === "month") {
      const dayMap: Record<string, { sales: number; paid: number }> = {};

      data.sales.forEach((s) => {
        if (!s.date.startsWith(selectedMonth)) return;
        const day = String(Number(s.date.slice(8, 10)));
        if (!dayMap[day]) dayMap[day] = { sales: 0, paid: 0 };
        dayMap[day].sales += s.total;
        dayMap[day].paid += s.paidAmount;
      });

      const daysInMonth = dayjs(selectedMonth).daysInMonth();
      return Array.from({ length: daysInMonth }, (_, i) => {
        const day = String(i + 1);
        return {
          date: day,
          sales: dayMap[day]?.sales ?? 0,
          paid: dayMap[day]?.paid ?? 0,
        };
      });
    }

    // year view
    const monthMap: Record<string, { sales: number; paid: number }> = {};

    data.sales.forEach((s) => {
      const d = new Date(s.date);
      if (d.getFullYear() !== selectedYear) return;
      const monthName = d.toLocaleString("en-US", { month: "short" });
      if (!monthMap[monthName]) monthMap[monthName] = { sales: 0, paid: 0 };
      monthMap[monthName].sales += s.total;
      monthMap[monthName].paid += s.paidAmount;
    });

    const allMonths = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    return allMonths.map((month) => ({
      date: month,
      sales: monthMap[month]?.sales ?? 0,
      paid: monthMap[month]?.paid ?? 0,
    }));
  }, [data.sales, view, selectedMonth, selectedYear]);

  return (
    <SalesChart
      data={chartData}
      view={view}
      onViewChange={setView}
      selectedMonth={selectedMonth}
      onSelectedMonthChange={setSelectedMonth}
      selectedYear={selectedYear}
      onSelectedYearChange={setSelectedYear}
      availableYears={years}
    />
  );
}

import React from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Cell,
} from "recharts";
import {
  Paper,
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  useTheme,
} from "@mui/material";

export interface SalesDataPoint {
  date: string;
  sales: number;
  paid: number;
}

export interface SalesChartProps {
  data: SalesDataPoint[];
  view: "day" | "month" | "year";
  onViewChange: (view: "day" | "month" | "year") => void;
  selectedMonth: string;
  onSelectedMonthChange: (month: string) => void;
  selectedYear: number;
  onSelectedYearChange: (year: number) => void;
  availableYears: number[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const item = payload.find((p: any) => p.dataKey === "paid");
    return (
      <Paper elevation={3} sx={{ px: 2, py: 1, borderRadius: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          {label}
        </Typography>
        {item && (
          <Typography variant="body2" color="text.secondary">
            Sales: ₹{Number(item.value).toLocaleString("en-IN")}
          </Typography>
        )}
      </Paper>
    );
  }
  return null;
};

export const SalesChart: React.FC<SalesChartProps> = ({
  data,
  view,
  onViewChange,
  selectedMonth,
  onSelectedMonthChange,
  selectedYear,
  onSelectedYearChange,
  availableYears,
}) => {
  const theme = useTheme();

  const barColor = theme.palette.primary.main;
  const lineColor = theme.palette.secondary.main;

  return (
    <Paper
      elevation={2}
      sx={{
        p: 3,
        borderRadius: 3,
        background: theme.palette.background.paper,
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 2,
          mb: 2,
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            flexWrap: "wrap",
          }}
        >
          {view === "month" && (
            <TextField
              type="month"
              label="Month"
              size="small"
              value={selectedMonth}
              onChange={(e) => onSelectedMonthChange(e.target.value)}
              sx={{ minWidth: 160 }}
            />
          )}
          {view === "year" && (
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel id="year-select-label">Year</InputLabel>
              <Select
                labelId="year-select-label"
                value={selectedYear}
                label="Year"
                onChange={(e) =>
                  onSelectedYearChange(Number(e.target.value))
                }
              >
                {availableYears.map((y) => (
                  <MenuItem key={y} value={y}>
                    {y}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          {view === "day" && (
            <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 500 }}>
              All daily sales
            </Typography>
          )}
        </Box>

        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel id="view-select-label">View</InputLabel>
          <Select
            labelId="view-select-label"
            value={view}
            label="View"
            onChange={(e) =>
              onViewChange(e.target.value as "day" | "month" | "year")
            }
          >
            <MenuItem value="day">Day</MenuItem>
            <MenuItem value="month">Month</MenuItem>
            <MenuItem value="year">Year</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <ResponsiveContainer width="100%" height={380}>
        <ComposedChart
          data={data}
          margin={{ top: 16, right: 16, left: 8, bottom: 16 }}
        >
          <defs>
            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={barColor} stopOpacity={0.9} />
              <stop offset="100%" stopColor={barColor} stopOpacity={0.4} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="4 4"
            stroke={theme.palette.divider}
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
            axisLine={{ stroke: theme.palette.divider }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value: number) =>
              `₹${value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}`
            }
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: 8 }}
            formatter={(value: string) => (
              <span style={{ color: theme.palette.text.primary, fontWeight: 500 }}>
                {value}
              </span>
            )}
          />
          <Bar
            dataKey="paid"
            barSize={view === "year" ? 40 : view === "month" ? 22 : 16}
            fill="url(#barGradient)"
            name="Sales"
            radius={[6, 6, 0, 0]}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fillOpacity={entry.paid === 0 ? 0.15 : 1}
              />
            ))}
          </Bar>
          <Line
            type="monotone"
            dataKey="paid"
            stroke={lineColor}
            strokeWidth={2.5}
            dot={false}
            name="Trend"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </Paper>
  );
};


"use client";

/**
 * P7.2 — dashboard time-series chart (deposits vs withdrawals vs net).
 * recharts is heavy, so the page dynamic-imports this with ssr:false to keep
 * the route's first-load JS under the 200KB budget (P6.3).
 */
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { SeriesPoint } from "@/lib/admin-dashboard";

interface DashboardChartProps {
  points: SeriesPoint[];
  currency: string;
}

export default function DashboardChart({ points, currency }: DashboardChartProps) {
  const moneyTick = (v: number) =>
    new Intl.NumberFormat("id-ID", { notation: "compact" }).format(v);

  return (
    <div style={{ width: "100%", height: 300 }} dir="ltr">
      <ResponsiveContainer>
        <AreaChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
          <defs>
            <linearGradient id="gradDeposits" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00acac" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#00acac" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="gradWithdrawals" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59c1a" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#f59c1a" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" opacity={0.35} vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11 }}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={moneyTick}
            width={64}
          />
          <Tooltip
            formatter={(value, name) => [
              `${new Intl.NumberFormat("id-ID").format(Number(value))} ${currency}`,
              name === "net" ? "Net" : name === "deposits" ? "Deposits" : "Withdrawals",
            ]}
          />
          <Legend />
          <Area
            type="monotone"
            dataKey="deposits"
            name="Deposits"
            stroke="#00acac"
            fill="url(#gradDeposits)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="withdrawals"
            name="Withdrawals"
            stroke="#f59c1a"
            fill="url(#gradWithdrawals)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="net"
            name="Net"
            stroke="#348fe2"
            fill="none"
            strokeWidth={2}
            strokeDasharray="5 3"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

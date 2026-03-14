"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
  trend?: string;
}

export function StatsCard({
  title,
  value,
  description,
  icon: Icon,
  className,
  trend,
}: StatsCardProps) {
  return (
    <Card className={cn("rounded-2xl shadow-sm", className)}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {Icon && (
          <div className="rounded-xl bg-primary/10 p-2">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {(description || trend) && (
          <p className="mt-1 text-xs text-muted-foreground">
            {trend && <span className="text-primary font-medium">{trend} </span>}
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

"use client";

import * as React from "react";
import { GraduationCap, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";

interface InstructorStats {
  course_count: number;
}

export default function InstructorDashboard() {
  const [stats, setStats] = React.useState<InstructorStats | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [name, setName] = React.useState("");

  React.useEffect(() => {
    const user = getCurrentUser();
    if (user) {
      setName(user.sub.split("@")[0]);
    }
    apiFetch<InstructorStats>("/api/instructor/dashboard")
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const cards = [
    {
      title: "My Courses",
      value: stats?.course_count ?? "-",
      icon: GraduationCap,
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <h1 className="text-3xl font-bold mb-1">
        Welcome{name ? `, ${name}` : ""}
      </h1>
      <p className="text-muted-foreground mb-8">
        Here is an overview of your courses.
      </p>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <Card key={card.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
                <card.icon className="h-5 w-5 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{card.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Trash2, Users, Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { apiFetch, ApiError } from "@/lib/api";

interface University {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  status: string;
  created_at: string;
  admin_count: number;
}

export default function UniversitiesPage() {
  const [universities, setUniversities] = React.useState<University[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editUni, setEditUni] = React.useState<University | null>(null);

  const fetchUniversities = React.useCallback(async () => {
    try {
      const data = await apiFetch<University[]>(
        "/api/super-admin/universities",
      );
      setUniversities(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchUniversities();
  }, [fetchUniversities]);

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/api/super-admin/universities/${id}`, {
        method: "DELETE",
      });
      await fetchUniversities();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Universities</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Manage all universities on the platform.
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add University
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create University</DialogTitle>
              <DialogDescription>
                Add a new university to the platform.
              </DialogDescription>
            </DialogHeader>
            <CreateUniversityForm
              onSuccess={() => {
                setCreateOpen(false);
                fetchUniversities();
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : universities.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">
          No universities yet. Create one to get started.
        </p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {universities.map((uni) => (
            <Card key={uni.id}>
              <CardHeader className="flex flex-row items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{uni.name}</CardTitle>
                  <CardDescription className="font-mono text-xs">
                    {uni.slug}
                  </CardDescription>
                </div>
                <Badge
                  variant={uni.status === "active" ? "default" : "secondary"}
                >
                  {uni.status}
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <Users className="h-4 w-4" />
                  <span>
                    {uni.admin_count} admin{uni.admin_count !== 1 ? "s" : ""}
                  </span>
                </div>
                {uni.primary_color && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                    <div
                      className="h-4 w-4 rounded-full border"
                      style={{ backgroundColor: uni.primary_color }}
                    />
                    <span>{uni.primary_color}</span>
                  </div>
                )}
                {!uni.primary_color && (
                  <p className="text-xs text-muted-foreground/60 mb-4">No theme color set</p>
                )}
                <div className="flex gap-2">
                  <Button asChild variant="outline" size="sm" className="flex-1">
                    <Link href={`/super-admin/universities/${uni.id}`}>
                      Manage
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="px-3"
                    onClick={() => setEditUni(uni)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm" className="px-3">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Deactivate &quot;{uni.name}&quot;?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          This will set the university to inactive. Users will no
                          longer be able to log in.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(uni.id)}>
                          Deactivate
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit University Dialog */}
      <Dialog open={!!editUni} onOpenChange={(open) => !open && setEditUni(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit University</DialogTitle>
            <DialogDescription>
              Update branding and details for {editUni?.name}.
            </DialogDescription>
          </DialogHeader>
          {editUni && (
            <EditUniversityForm
              university={editUni}
              onSuccess={() => {
                setEditUni(null);
                fetchUniversities();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditUniversityForm({
  university,
  onSuccess,
}: {
  university: University;
  onSuccess: () => void;
}) {
  const [name, setName] = React.useState(university.name);
  const [domain, setDomain] = React.useState(university.domain || "");
  const [logoUrl, setLogoUrl] = React.useState(university.logo_url || "");
  const [primaryColor, setPrimaryColor] = React.useState(university.primary_color || "#000000");
  const [secondaryColor, setSecondaryColor] = React.useState(university.secondary_color || "#000000");
  const [error, setError] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await apiFetch(`/api/super-admin/universities/${university.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name,
          domain: domain || null,
          logo_url: logoUrl || null,
          primary_color: primaryColor,
          secondary_color: secondaryColor || null,
        }),
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-col gap-2">
        <Label htmlFor="edit-name">Name</Label>
        <input
          id="edit-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="edit-domain">Domain</Label>
        <input
          id="edit-domain"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="brocku.ca"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="edit-logo">Logo URL</Label>
        <input
          id="edit-logo"
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          placeholder="https://example.com/logo.png"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="edit-primary">Primary Color</Label>
          <div className="flex gap-2 items-center">
            <input
              id="edit-primary"
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="h-10 w-12 rounded border border-input cursor-pointer"
            />
            <input
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="edit-secondary">Secondary Color</Label>
          <div className="flex gap-2 items-center">
            <input
              id="edit-secondary"
              type="color"
              value={secondaryColor}
              onChange={(e) => setSecondaryColor(e.target.value)}
              className="h-10 w-12 rounded border border-input cursor-pointer"
            />
            <input
              value={secondaryColor}
              onChange={(e) => setSecondaryColor(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>
      </div>
      <Button type="submit" disabled={submitting} className="mt-2">
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save Changes
      </Button>
    </form>
  );
}

function CreateUniversityForm({ onSuccess }: { onSuccess: () => void }) {
  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [domain, setDomain] = React.useState("");
  const [primaryColor, setPrimaryColor] = React.useState("#cc0000");
  const [secondaryColor, setSecondaryColor] = React.useState("#000000");
  const [error, setError] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await apiFetch("/api/super-admin/universities", {
        method: "POST",
        body: JSON.stringify({
          name,
          slug,
          domain: domain || null,
          primary_color: primaryColor,
          secondary_color: secondaryColor || null,
        }),
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor="uni-name">Name</Label>
        <input
          id="uni-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Brock University"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="uni-slug">Slug</Label>
        <input
          id="uni-slug"
          required
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
          placeholder="brock"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="uni-domain">Domain (optional)</Label>
        <input
          id="uni-domain"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="brocku.ca"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="create-primary">Primary Color</Label>
          <div className="flex gap-2 items-center">
            <input
              id="create-primary"
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="h-10 w-12 rounded border border-input cursor-pointer"
            />
            <input
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="create-secondary">Secondary Color</Label>
          <div className="flex gap-2 items-center">
            <input
              id="create-secondary"
              type="color"
              value={secondaryColor}
              onChange={(e) => setSecondaryColor(e.target.value)}
              className="h-10 w-12 rounded border border-input cursor-pointer"
            />
            <input
              value={secondaryColor}
              onChange={(e) => setSecondaryColor(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>
      </div>
      <Button type="submit" disabled={submitting} className="mt-2">
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Create University
      </Button>
    </form>
  );
}

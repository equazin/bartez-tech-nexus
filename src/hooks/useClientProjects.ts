import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export interface ClientProject {
  id: number;
  client_id: string;
  name: string;
  description?: string;
  color: string;
  item_count: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface UseClientProjectsResult {
  projects: ClientProject[];
  loading: boolean;
  createProject: (name: string, color?: string) => Promise<void>;
  deleteProject: (id: number) => Promise<void>;
}

export function useClientProjects(clientId: string): UseClientProjectsResult {
  const [projects, setProjects] = useState<ClientProject[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    if (!clientId) {
      setProjects([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("client_projects")
      .select("*")
      .eq("client_id", clientId)
      .eq("active", true)
      .order("created_at", { ascending: false });

    if (!error) {
      setProjects((data ?? []) as ClientProject[]);
    }
    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const createProject = useCallback(async (name: string, color = "blue") => {
    const { error } = await supabase.from("client_projects").insert({
      client_id: clientId,
      name,
      color,
      active: true,
    });
    if (error) throw new Error(error.message);
    await fetchProjects();
  }, [clientId, fetchProjects]);

  const deleteProject = useCallback(async (id: number) => {
    const { error } = await supabase
      .from("client_projects")
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);
    setProjects(prev => prev.filter(p => p.id !== id));
  }, []);

  return { projects, loading, createProject, deleteProject };
}

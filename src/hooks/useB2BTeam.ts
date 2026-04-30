import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface B2BTeamMember {
  id: string;
  email: string;
  contact_name: string;
  b2b_role: "buyer" | "manager";
  approval_threshold: number;
  active: boolean;
  created_at: string;
}

export interface PendingInvitation {
  id: number;
  invited_email: string;
  role: string;
  approval_threshold: number;
  expires_at: string;
  created_at: string;
}

interface UseB2BTeamReturn {
  members: B2BTeamMember[];
  invitations: PendingInvitation[];
  loading: boolean;
  invite: (email: string, role: string, threshold: number) => Promise<boolean>;
  remove: (profileId: string) => Promise<boolean>;
  update: (profileId: string, role: string, threshold: number) => Promise<boolean>;
  refresh: () => void;
}

export function useB2BTeam(): UseB2BTeamReturn {
  const { toast } = useToast();
  const [members, setMembers] = useState<B2BTeamMember[]>([]);
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [membersRes, invitationsRes] = await Promise.all([
      supabase.rpc("get_my_b2b_team"),
      supabase.rpc("get_my_pending_invitations"),
    ]);
    if (!membersRes.error) setMembers((membersRes.data as B2BTeamMember[]) ?? []);
    if (!invitationsRes.error) setInvitations((invitationsRes.data as PendingInvitation[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const invite = useCallback(async (email: string, role: string, threshold: number) => {
    const { error } = await supabase.rpc("invite_b2b_user", {
      p_email: email,
      p_role: role,
      p_threshold: threshold,
    });
    if (error) {
      toast({ title: "Error al invitar", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: "Invitación enviada", description: `Se invitó a ${email}` });
    await load();
    return true;
  }, [load, toast]);

  const remove = useCallback(async (profileId: string) => {
    const { error } = await supabase.rpc("remove_b2b_user", { p_profile_id: profileId });
    if (error) {
      toast({ title: "Error al remover", description: error.message, variant: "destructive" });
      return false;
    }
    setMembers((prev) => prev.filter((m) => m.id !== profileId));
    toast({ title: "Usuario removido" });
    return true;
  }, [toast]);

  const update = useCallback(async (profileId: string, role: string, threshold: number) => {
    const { error } = await supabase.rpc("update_b2b_user", {
      p_profile_id: profileId,
      p_role: role,
      p_threshold: threshold,
    });
    if (error) {
      toast({ title: "Error al actualizar", description: error.message, variant: "destructive" });
      return false;
    }
    setMembers((prev) =>
      prev.map((m) =>
        m.id === profileId
          ? { ...m, b2b_role: role as B2BTeamMember["b2b_role"], approval_threshold: threshold }
          : m
      )
    );
    toast({ title: "Usuario actualizado" });
    return true;
  }, [toast]);

  return { members, invitations, loading, invite, remove, update, refresh: load };
}

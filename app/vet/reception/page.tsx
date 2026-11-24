"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  Building2,
  LogOut,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Stethoscope,
} from "lucide-react";
import ReceptionSearchAndAdmit from "@/components/vet/ReceptionSearchAndAdmit";
import ReceptionLiveQueue, {
  BranchVet,
  WaitingRoomItem,
} from "@/components/vet/ReceptionLiveQueue";

function extractUid(cards: any): string {
  if (Array.isArray(cards) && cards.length > 0) return cards[0]?.uid || "Sin chip";
  if (cards?.uid) return cards.uid;
  return "Sin chip";
}

function extractFirst(val: any) {
  if (Array.isArray(val)) return val[0] || null;
  return val || null;
}

export default function VetReceptionPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string>("");
  const [userRole, setUserRole] = useState<string>("");
  const [staffName, setStaffName] = useState<string>("");
  const [branchId, setBranchId] = useState<string>("");
  const [branchLabel, setBranchLabel] = useState<string>("");
  const [branchVets, setBranchVets] = useState<BranchVet[]>([]);

  const [queue, setQueue] = useState<WaitingRoomItem[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const loadQueue = useCallback(async (activeBranchId: string) => {
    const { data, error } = await supabase
      .from("waiting_room")
      .select(
        `
        id,
        pet_id,
        assigned_vet_id,
        visit_type,
        priority,
        reception_notes,
        status,
        created_at,
        pets (
          id,
          name,
          species,
          breed,
          avatar_url,
          emergency_notes,
          profiles (full_name),
          cards (uid)
        )
      `
      )
      .eq("branch_id", activeBranchId)
      .in("status", ["waiting", "in_consultation"])
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error cargando sala de espera:", error);
      return;
    }

    if (data) {
      const mapped: WaitingRoomItem[] = data
        .filter((row: any) => row.pets !== null)
        .map((row: any) => {
          const pet = extractFirst(row.pets);
          const owner = extractFirst(pet?.profiles);
          return {
            id: row.id,
            pet_id: row.pet_id,
            assigned_vet_id: row.assigned_vet_id,
            visit_type: row.visit_type,
            priority: row.priority,
            reception_notes: row.reception_notes,
            status: row.status,
            created_at: row.created_at,
            petName: pet?.name || "Sin nombre",
            petSpecies: pet?.species || "",
            petBreed: pet?.breed || "",
            petAvatar: pet?.avatar_url || null,
            emergencyNotes: pet?.emergency_notes || null,
            ownerName: owner?.full_name || "Sin tutor",
            uid: extractUid(pet?.cards),
          };
        });
      setQueue(mapped);
    }
  }, []);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function initReception() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/vet/login");
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("id, full_name, role, branch_id")
          .eq("id", user.id)
          .single();

        if (profileError || !profile) {
          router.push("/vet/login");
          return;
        }

        const allowedRoles = ["reception", "clinic_admin", "vet", "owner"];
        if (!allowedRoles.includes(profile.role)) {
          router.push("/vet/login");
          return;
        }

        let resolvedBranchId = profile.branch_id;

        if (profile.role === "vet") {
          const { data: vetData } = await supabase
            .from("vet_profiles")
            .select("status, branch_id")
            .eq("id", user.id)
            .single();

          if (!vetData || vetData.status !== "approved") {
            router.push("/vet/login");
            return;
          }
          resolvedBranchId = vetData.branch_id || resolvedBranchId;
        }

        if (!resolvedBranchId) {
          setFeedback({
            type: "error",
            text: "Tu cuenta no tiene una sucursal clínica asignada.",
          });
          setLoading(false);
          return;
        }

        setUserId(user.id);
        setUserRole(profile.role);
        setStaffName(profile.full_name || "Recepción");
        setBranchId(resolvedBranchId);

        const { data: branchData } = await supabase
          .from("clinic_branches")
          .select("id, name, city, clinics(name)")
          .eq("id", resolvedBranchId)
          .single();

        if (branchData) {
          const clinicObj = extractFirst((branchData as any).clinics);
          const clinicName = clinicObj?.name ? `${clinicObj.name} • ` : "";
          setBranchLabel(`${clinicName}${branchData.name}`);
        }

        const { data: vetBranchRows, error: vbError } = await supabase
          .from("vet_branches")
          .select("vet_id")
          .eq("branch_id", resolvedBranchId);

        if (vbError) {
          console.error("Error leyendo vet_branches:", vbError);
        }

        const candidateVetIds = new Set<string>(
          (vetBranchRows || []).map((r: any) => r.vet_id).filter(Boolean)
        );

        const { data: directVets } = await supabase
          .from("vet_profiles")
          .select("id")
          .eq("branch_id", resolvedBranchId)
          .eq("status", "approved");

        (directVets || []).forEach((v: any) => {
          if (v.id) candidateVetIds.add(v.id);
        });

        const vetIdsArray = Array.from(candidateVetIds);

        if (vetIdsArray.length > 0) {
          const [{ data: approvedVetProfiles }, { data: vetUserProfiles }] =
            await Promise.all([
              supabase
                .from("vet_profiles")
                .select("id, license_number, status")
                .in("id", vetIdsArray)
                .eq("status", "approved"),
              supabase
                .from("profiles")
                .select("id, full_name")
                .in("id", vetIdsArray),
            ]);

          const nameById = new Map<string, string>(
            (vetUserProfiles || []).map((p: any) => [
              p.id,
              p.full_name || "Veterinario",
            ])
          );

          const mappedVets: BranchVet[] = (approvedVetProfiles || []).map(
            (vp: any) => ({
              id: vp.id,
              full_name: nameById.get(vp.id) || "Veterinario",
              license_number: vp.license_number || "",
            })
          );

          setBranchVets(mappedVets);
        } else {
          setBranchVets([]);
        }

        await loadQueue(resolvedBranchId);

        channel = supabase
          .channel(`reception-waiting-room-${resolvedBranchId}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "waiting_room",
              filter: `branch_id=eq.${resolvedBranchId}`,
            },
            () => {
              loadQueue(resolvedBranchId);
            }
          )
          .subscribe();
      } catch (error) {
        console.error("Error inicializando mesa de entrada:", error);
      } finally {
        setLoading(false);
      }
    }

    initReception();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [router, loadQueue]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/vet/login");
  };

  const handleAdmitted = async (admittedName: string) => {
    setFeedback({
      type: "success",
      text: `${admittedName} pasó a Sala de Espera y se notificó al equipo veterinario.`,
    });
    if (branchId) {
      await loadQueue(branchId);
    }
  };

  const handleUpdateQueueStatus = async (
    id: string,
    newStatus: "completed" | "cancelled"
  ) => {
    setUpdatingId(id);
    try {
      const { error } = await supabase
        .from("waiting_room")
        .update({ status: newStatus })
        .eq("id", id);

      if (error) throw error;
      if (branchId) {
        await loadQueue(branchId);
      }
    } catch (err) {
      console.error("Error actualizando turno:", err);
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-petlight flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-petgreen" />
      </div>
    );
  }

  const waitingCount = queue.filter((q) => q.status === "waiting").length;
  const waitingPetIds = queue
    .filter((q) => q.status === "waiting")
    .map((q) => q.pet_id);

  return (
    <main className="min-h-screen bg-petlight pb-12 overflow-x-hidden">
      <nav className="bg-petblue text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center border border-white/10">
              <Building2 className="w-5 h-5 text-petgreen" />
            </div>
            <div>
              <span className="font-bold tracking-wide text-base block">
                Mesa de Entrada • Mostrador
              </span>
              <span className="text-xs text-slate-300">
                {staffName} {branchLabel ? `• ${branchLabel}` : ""}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {(userRole === "vet" || userRole === "owner") && (
              <Link
                href="/vet/dashboard"
                className="flex items-center min-h-[44px] gap-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold py-2 px-4 rounded-xl border border-white/15 transition-all"
              >
                <Stethoscope className="w-4 h-4 text-petgreen" />
                <span>Panel Veterinario</span>
              </Link>
            )}
            <span className="text-xs bg-emerald-500/20 text-petgreen px-3 py-2 min-h-[44px] flex items-center rounded-xl border border-emerald-500/30 font-semibold whitespace-nowrap">
              ● Sala Activa ({waitingCount})
            </span>
            <button
              onClick={handleLogout}
              className="flex items-center min-h-[44px] gap-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-200 text-xs font-bold py-2 px-4 rounded-xl border border-red-500/30 transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Salir</span>
            </button>
          </div>
        </div>
      </nav>

      <div className="w-[92%] sm:max-w-7xl mx-auto mt-6 space-y-6">
        {feedback && (
          <div
            className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-sm font-semibold shadow-sm ${
              feedback.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-red-50 border-red-200 text-red-700"
            }`}
          >
            <div className="flex items-center gap-2.5">
              {feedback.type === "success" ? (
                <CheckCircle2 className="w-5 h-5 text-petgreen shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
              )}
              <span>{feedback.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-xs opacity-70 hover:opacity-100 font-bold"
            >
              Cerrar
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <ReceptionSearchAndAdmit
            branchId={branchId}
            userId={userId}
            branchVets={branchVets}
            waitingPetIds={waitingPetIds}
            onAdmitted={handleAdmitted}
            onError={(msg) => setFeedback({ type: "error", text: msg })}
            onClearFeedback={() => setFeedback(null)}
          />

          <ReceptionLiveQueue
            queue={queue}
            branchVets={branchVets}
            updatingId={updatingId}
            onRefresh={() => branchId && loadQueue(branchId)}
            onUpdateStatus={handleUpdateQueueStatus}
          />
        </div>
      </div>
    </main>
  );
}
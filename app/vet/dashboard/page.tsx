"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Stethoscope, LogOut, Loader2, Building2 } from "lucide-react";
import WaitingRoomSection, {
  BranchOption,
} from "@/components/vet/WaitingRoomSection";
import VetPatientRosterSection, {
  PatientRecord,
} from "@/components/vet/VetPatientRosterSection";

function extractUid(cards: any): string {
  if (Array.isArray(cards) && cards.length > 0) {
    return cards[0]?.uid || "Sin chip vinculado";
  }
  return cards?.uid || "Sin chip vinculado";
}

function extractFirst(val: any) {
  if (Array.isArray(val)) return val[0] || null;
  return val || null;
}

export default function VetDashboardPage() {
  const router = useRouter();
  const audioCtxRef = useRef<AudioContext | null>(null);
  const soundEnabledRef = useRef<boolean>(false);

  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [availableBranches, setAvailableBranches] = useState<BranchOption[]>(
    []
  );
  const [activeBranchId, setActiveBranchId] = useState<string>("");
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [vetProfile, setVetProfile] = useState<any>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);

  const playNotificationSound = useCallback((isUrgent: boolean) => {
    try {
      const AudioCtx =
        window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const playTone = (freq: number, startOffset: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = isUrgent ? "triangle" : "sine";
        osc.frequency.setValueAtTime(freq, ctx.currentTime + startOffset);
        gain.gain.setValueAtTime(0.001, ctx.currentTime + startOffset);
        gain.gain.exponentialRampToValueAtTime(
          0.18,
          ctx.currentTime + startOffset + 0.02
        );
        gain.gain.exponentialRampToValueAtTime(
          0.001,
          ctx.currentTime + startOffset + duration
        );
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + startOffset);
        osc.stop(ctx.currentTime + startOffset + duration);
      };

      if (isUrgent) {
        playTone(880, 0, 0.18);
        playTone(1046.5, 0.2, 0.22);
        playTone(880, 0.45, 0.18);
        playTone(1046.5, 0.65, 0.28);
      } else {
        playTone(659.25, 0, 0.18);
        playTone(880, 0.18, 0.28);
      }
    } catch (e) {
      console.error("No se pudo reproducir el sonido de alerta:", e);
    }
  }, []);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundEnabledRef.current = next;
    if (next) {
      playNotificationSound(false);
    }
  };

  useEffect(() => {
    async function loadVetDashboard() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          router.push("/vet/login");
          return;
        }

        setCurrentUserId(user.id);

        const { data: profile } = await supabase
          .from("profiles")
          .select(
            "full_name, role, branch_id, vet_profiles(license_number, branch_id, status)"
          )
          .eq("id", user.id)
          .single();

        if (!profile) {
          router.push("/vet/login");
          return;
        }

        if (profile.role === "reception") {
          router.push("/vet/reception");
          return;
        }

        const vetDetail = extractFirst(profile.vet_profiles);
        if (profile.role === "vet" && vetDetail?.status !== "approved") {
          router.push("/vet/login");
          return;
        }

        setVetProfile({
          ...profile,
          license_number: vetDetail?.license_number || "Matrícula Verificada",
        });

        // Cargar sucursales asociadas en vet_branches (con fallback a branch_id)
        const { data: vetBranchesData } = await supabase
          .from("vet_branches")
          .select("branch_id, clinic_branches(id, name, city, clinics(name))")
          .eq("vet_id", user.id);

        const branchMap = new Map<string, BranchOption>();

        if (vetBranchesData) {
          for (const row of vetBranchesData as any[]) {
            const b = extractFirst(row.clinic_branches);
            const bId = b?.id || row.branch_id;
            if (!bId) continue;
            const clinicObj = extractFirst(b?.clinics);
            const baseName = b?.name || "Sucursal";
            const label = clinicObj?.name
              ? `${clinicObj.name} • ${baseName}`
              : baseName;
            branchMap.set(bId, { id: bId, label });
          }
        }

        const fallbackBranchId = vetDetail?.branch_id || profile.branch_id || "";
        if (fallbackBranchId && !branchMap.has(fallbackBranchId)) {
          const { data: singleBranch } = await supabase
            .from("clinic_branches")
            .select("id, name, city, clinics(name)")
            .eq("id", fallbackBranchId)
            .single();

          if (singleBranch) {
            const clinicObj = extractFirst((singleBranch as any).clinics);
            branchMap.set(fallbackBranchId, {
              id: fallbackBranchId,
              label: clinicObj?.name
                ? `${clinicObj.name} • ${singleBranch.name}`
                : singleBranch.name,
            });
          } else {
            branchMap.set(fallbackBranchId, {
              id: fallbackBranchId,
              label: "Sucursal Asignada",
            });
          }
        }

        const branchList = Array.from(branchMap.values());
        setAvailableBranches(branchList);

        const initialBranchId =
          fallbackBranchId && branchMap.has(fallbackBranchId)
            ? fallbackBranchId
            : branchList[0]?.id || "";
        setActiveBranchId(initialBranchId);

        const { data: vetPatients, error } = await supabase
          .from("vet_patients")
          .select(
            `
            pet_id,
            first_scanned_at,
            pets (
              id,
              name,
              species,
              breed,
              emergency_notes,
              created_at,
              profiles (full_name),
              cards (uid)
            )
          `
          )
          .eq("vet_id", user.id)
          .order("first_scanned_at", { ascending: false });

        if (error) throw error;

        if (vetPatients) {
          const formattedPatients: PatientRecord[] = vetPatients
            .filter((vp: any) => vp.pets !== null)
            .map((vp: any) => {
              const pet = extractFirst(vp.pets);
              const owner = extractFirst(pet.profiles);
              return {
                id: pet.id,
                name: pet.name,
                species: pet.species,
                breed: pet.breed,
                ownerName: owner?.full_name || "Desconocido",
                uid: extractUid(pet.cards),
                lastVisit: new Date(vp.first_scanned_at).toLocaleDateString(
                  "es-AR"
                ),
                status: pet.emergency_notes
                  ? "Con Condición Médica"
                  : "Estable",
              };
            });
          setPatients(formattedPatients);
        }
      } catch (error) {
        console.error("Error cargando dashboard clínico:", error);
      } finally {
        setLoading(false);
      }
    }

    loadVetDashboard();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/vet/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-petlight flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-petgreen" />
      </div>
    );
  }

  const activeBranchLabel =
    availableBranches.find((b) => b.id === activeBranchId)?.label || "";

  return (
    <main className="min-h-screen bg-petlight pb-12 overflow-x-hidden">
      <nav className="bg-petblue text-white shadow-md">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center border border-white/10">
              <Stethoscope className="w-5 h-5 text-petgreen" />
            </div>
            <div>
              <span className="font-bold tracking-wide text-base block">
                Portal Clínico{" "}
                {activeBranchLabel ? `• ${activeBranchLabel}` : ""}
              </span>
              <span className="text-xs text-slate-300">
                {vetProfile?.full_name || "Veterinario"} •{" "}
                {vetProfile?.license_number || "Matrícula Verificada"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/vet/reception"
              className="flex items-center min-h-[44px] gap-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold py-2 px-3.5 rounded-xl border border-white/15 transition-all"
            >
              <Building2 className="w-4 h-4 text-petgreen" />
              <span>Mostrador</span>
            </Link>

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

      <div className="w-[90%] sm:max-w-6xl mx-auto mt-8 space-y-6">
        <WaitingRoomSection
          currentUserId={currentUserId}
          availableBranches={availableBranches}
          activeBranchId={activeBranchId}
          onBranchChange={setActiveBranchId}
          soundEnabled={soundEnabled}
          onToggleSound={toggleSound}
          soundEnabledRef={soundEnabledRef}
          playNotificationSound={playNotificationSound}
        />

        <VetPatientRosterSection patients={patients} />
      </div>
    </main>
  );
}
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  BellRing,
  AlertTriangle,
  Volume2,
  VolumeX,
  Clock,
  ArrowUpRight,
  X,
  UserCheck,
  Users,
  Loader2,
  Building2,
} from "lucide-react";

export interface BranchOption {
  id: string;
  label: string;
}

export interface WaitingPatient {
  id: string;
  branch_id: string;
  pet_id: string;
  assigned_vet_id: string | null;
  visit_type: string;
  priority: "normal" | "urgent";
  reception_notes: string | null;
  status: "waiting" | "in_consultation" | "completed" | "cancelled";
  created_at: string;
  petName: string;
  species: string;
  breed: string;
  avatarUrl: string | null;
  emergencyNotes: string | null;
  ownerName: string;
  uid: string;
}

interface BranchVet {
  id: string;
  full_name: string;
}

interface WaitingRoomSectionProps {
  currentUserId: string;
  availableBranches: BranchOption[];
  activeBranchId: string;
  onBranchChange: (newBranchId: string) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  soundEnabledRef: React.MutableRefObject<boolean>;
  playNotificationSound: (isUrgent: boolean) => void;
}

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

function formatElapsed(createdAt: string, nowMs: number) {
  if (!nowMs) return "En espera";
  const mins = Math.max(
    0,
    Math.floor((nowMs - new Date(createdAt).getTime()) / 60000)
  );
  if (mins < 1) return "Recién llegado";
  if (mins < 60) return `Hace ${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `Hace ${h}h ${m}m`;
}

export default function WaitingRoomSection({
  currentUserId,
  availableBranches,
  activeBranchId,
  onBranchChange,
  soundEnabled,
  onToggleSound,
  soundEnabledRef,
  playNotificationSound,
}: WaitingRoomSectionProps) {
  const router = useRouter();

  const [waitingQueue, setWaitingQueue] = useState<WaitingPatient[]>([]);
  const [branchVets, setBranchVets] = useState<BranchVet[]>([]);
  const [queueFilter, setQueueFilter] = useState<"all" | "mine">("all");
  const [incomingAlert, setIncomingAlert] = useState<WaitingPatient | null>(
    null
  );
  const [attendingId, setAttendingId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number>(0);

  const mapWaitingRow = useCallback((row: any): WaitingPatient | null => {
    const pet = extractFirst(row.pets);
    if (!pet) return null;
    const owner = extractFirst(pet.profiles);
    return {
      id: row.id,
      branch_id: row.branch_id,
      pet_id: row.pet_id,
      assigned_vet_id: row.assigned_vet_id,
      visit_type: row.visit_type,
      priority: row.priority,
      reception_notes: row.reception_notes,
      status: row.status,
      created_at: row.created_at,
      petName: pet.name || "Paciente",
      species: pet.species || "",
      breed: pet.breed || "",
      avatarUrl: pet.avatar_url || null,
      emergencyNotes: pet.emergency_notes || null,
      ownerName: owner?.full_name || "Desconocido",
      uid: extractUid(pet.cards),
    };
  }, []);

  const loadWaitingRoom = useCallback(
    async (branchToLoad: string) => {
      const { data, error } = await supabase
        .from("waiting_room")
        .select(
          `
          id,
          branch_id,
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
        .eq("branch_id", branchToLoad)
        .in("status", ["waiting", "in_consultation"])
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error cargando sala de espera:", error);
        return;
      }

      if (data) {
        const mapped = data
          .map(mapWaitingRow)
          .filter((item): item is WaitingPatient => item !== null)
          .sort((a, b) => {
            const aScore =
              (a.status === "waiting" ? 0 : 10) +
              (a.priority === "urgent" || a.emergencyNotes ? 0 : 2);
            const bScore =
              (b.status === "waiting" ? 0 : 10) +
              (b.priority === "urgent" || b.emergencyNotes ? 0 : 2);
            if (aScore !== bScore) return aScore - bScore;
            return (
              new Date(a.created_at).getTime() -
              new Date(b.created_at).getTime()
            );
          });
        setWaitingQueue(mapped);
      }
    },
    [mapWaitingRow]
  );

  const fetchSingleWaitingRecord = useCallback(
    async (recordId: string): Promise<WaitingPatient | null> => {
      const { data, error } = await supabase
        .from("waiting_room")
        .select(
          `
          id,
          branch_id,
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
        .eq("id", recordId)
        .single();

      if (error || !data) return null;
      return mapWaitingRow(data);
    },
    [mapWaitingRow]
  );

  useEffect(() => {
    setNowMs(Date.now());
    const interval = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!activeBranchId) {
      setWaitingQueue([]);
      setBranchVets([]);
      return;
    }

    let isCancelled = false;
    setIncomingAlert(null);

    async function loadBranchContext() {
      const { data: vetBranchesRows } = await supabase
        .from("vet_branches")
        .select("vet_id, vet_profiles(id, status, profiles(full_name))")
        .eq("branch_id", activeBranchId);

      if (!isCancelled && vetBranchesRows) {
        const mappedVets: BranchVet[] = vetBranchesRows
          .map((row: any) => {
            const vp = extractFirst(row.vet_profiles);
            if (!vp || vp.status !== "approved") return null;
            const prof = extractFirst(vp.profiles);
            return {
              id: row.vet_id,
              full_name: prof?.full_name || "Veterinario",
            };
          })
          .filter((v): v is BranchVet => v !== null);
        setBranchVets(mappedVets);
      }

      if (!isCancelled) {
        await loadWaitingRoom(activeBranchId);
      }
    }

    loadBranchContext();

    const channel = supabase
      .channel(`vet-waiting-room-${activeBranchId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "waiting_room",
          filter: `branch_id=eq.${activeBranchId}`,
        },
        async (payload) => {
          if (isCancelled) return;
          await loadWaitingRoom(activeBranchId);
          const newRow = payload.new as any;
          if (newRow?.status === "waiting" && newRow?.id) {
            const fullEntry = await fetchSingleWaitingRecord(newRow.id);
            if (fullEntry && !isCancelled) {
              setIncomingAlert(fullEntry);
              if (soundEnabledRef.current) {
                const urgent =
                  fullEntry.priority === "urgent" ||
                  Boolean(fullEntry.emergencyNotes);
                playNotificationSound(urgent);
              }
            }
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "waiting_room",
          filter: `branch_id=eq.${activeBranchId}`,
        },
        async (payload) => {
          if (isCancelled) return;
          await loadWaitingRoom(activeBranchId);
          const updatedRow = payload.new as any;
          if (updatedRow?.id && updatedRow?.status !== "waiting") {
            setIncomingAlert((prev) =>
              prev && prev.id === updatedRow.id ? null : prev
            );
          }
        }
      )
      .subscribe();

    return () => {
      isCancelled = true;
      supabase.removeChannel(channel);
    };
  }, [
    activeBranchId,
    loadWaitingRoom,
    fetchSingleWaitingRecord,
    playNotificationSound,
    soundEnabledRef,
  ]);

  const handleAttendPatient = async (item: WaitingPatient) => {
    if (!currentUserId) return;
    setAttendingId(item.id);

    try {
      const { error: updateError } = await supabase
        .from("waiting_room")
        .update({
          status: "in_consultation",
          assigned_vet_id: currentUserId,
        })
        .eq("id", item.id);

      if (updateError) throw updateError;

      const { error: linkError } = await supabase
        .from("vet_patients")
        .insert([{ vet_id: currentUserId, pet_id: item.pet_id }]);

      if (linkError && linkError.code !== "23505") {
        throw linkError;
      }

      setIncomingAlert(null);
      router.push(`/vet/patient/${item.pet_id}`);
    } catch (err) {
      console.error("Error al tomar paciente de sala de espera:", err);
      setAttendingId(null);
    }
  };

  const getVetName = (vetId: string | null) => {
    if (!vetId) return "Cualquier disponible";
    if (vetId === currentUserId) return "Asignado a mí";
    const found = branchVets.find((v) => v.id === vetId);
    return found ? found.full_name : "Otro profesional";
  };

  const waitingOnly = waitingQueue.filter((item) => item.status === "waiting");
  const visibleWaitingQueue = waitingQueue.filter((item) => {
    if (queueFilter === "mine") {
      return item.assigned_vet_id === currentUserId;
    }
    return true;
  });

  const isAlertUrgent =
    incomingAlert !== null &&
    (incomingAlert.priority === "urgent" ||
      Boolean(incomingAlert.emergencyNotes));

  return (
    <>
      {incomingAlert && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[94%] max-w-2xl animate-in fade-in slide-in-from-top-4 duration-300">
          <div
            className={`rounded-2xl p-5 shadow-2xl border-2 text-white ${
              isAlertUrgent
                ? "bg-red-600 border-red-300 shadow-red-600/40"
                : "bg-petblue border-petgreen shadow-petblue/40"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                    isAlertUrgent
                      ? "bg-white/20 animate-bounce"
                      : "bg-petgreen/20 animate-pulse"
                  }`}
                >
                  {isAlertUrgent ? (
                    <AlertTriangle className="w-7 h-7 text-white" />
                  ) : (
                    <BellRing className="w-7 h-7 text-petgreen" />
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-white/20">
                      {isAlertUrgent
                        ? "Ingreso Urgente / Alerta Médica"
                        : "Nuevo Paciente en Sala de Espera"}
                    </span>
                    <span className="text-xs font-bold text-white/90">
                      {incomingAlert.visit_type}
                    </span>
                  </div>

                  <h3 className="text-lg font-extrabold leading-tight">
                    {incomingAlert.petName}{" "}
                    <span className="text-sm font-medium text-white/80">
                      ({incomingAlert.species} • {incomingAlert.breed})
                    </span>
                  </h3>

                  <p className="text-xs text-white/90">
                    Tutor: <strong>{incomingAlert.ownerName}</strong>
                  </p>

                  {incomingAlert.emergencyNotes && (
                    <p className="text-xs font-bold bg-black/25 px-3 py-1.5 rounded-lg mt-1.5">
                      Alerta Crítica: {incomingAlert.emergencyNotes}
                    </p>
                  )}

                  {incomingAlert.reception_notes && (
                    <p className="text-xs text-white/90 italic mt-1">
                      Nota de mostrador: "{incomingAlert.reception_notes}
                      "
                    </p>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIncomingAlert(null)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
                aria-label="Cerrar alerta"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIncomingAlert(null)}
                className="min-h-[42px] px-4 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-bold transition-colors cursor-pointer"
              >
                Ver después
              </button>
              <button
                type="button"
                disabled={attendingId === incomingAlert.id}
                onClick={() => handleAttendPatient(incomingAlert)}
                className={`min-h-[42px] px-5 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer ${
                  isAlertUrgent
                    ? "bg-white text-red-700 hover:bg-red-50"
                    : "bg-petgreen text-white hover:bg-emerald-500"
                }`}
              >
                {attendingId === incomingAlert.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Atender Ahora</span>
                    <ArrowUpRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-100 bg-slate-50/70 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h2 className="text-lg font-bold text-petblue flex items-center gap-2 flex-wrap">
              <BellRing className="w-5 h-5 text-petgreen" />
              <span>Sala de Espera Activa</span>
              <span className="text-xs bg-petgreen text-white px-2.5 py-0.5 rounded-full font-extrabold">
                {waitingOnly.length} esperando
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Pacientes ingresados desde recepción en tu sucursal en tiempo
              real.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            {availableBranches.length > 0 && (
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
                <Building2 className="w-4 h-4 text-petgreen shrink-0" />
                <select
                  aria-label="Sucursal activa"
                  value={activeBranchId}
                  onChange={(e) => onBranchChange(e.target.value)}
                  className="text-xs font-bold text-petblue bg-transparent focus:outline-none cursor-pointer"
                >
                  {availableBranches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={onToggleSound}
              className={`flex items-center min-h-[38px] gap-1.5 text-xs font-bold py-1.5 px-3 rounded-xl border transition-all cursor-pointer ${
                soundEnabled
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
              }`}
            >
              {soundEnabled ? (
                <>
                  <Volume2 className="w-4 h-4 text-petgreen" />
                  <span>Sonido Activo</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-4 h-4" />
                  <span>Activar Sonido</span>
                </>
              )}
            </button>

            <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setQueueFilter("all")}
                className={`min-h-[34px] px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  queueFilter === "all"
                    ? "bg-petblue text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Todos ({waitingQueue.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setQueueFilter("mine")}
                className={`min-h-[34px] px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  queueFilter === "mine"
                    ? "bg-petblue text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>
                  Míos (
                  {
                    waitingQueue.filter(
                      (q) => q.assigned_vet_id === currentUserId
                    ).length
                  }
                  )
                </span>
              </button>
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-6">
          {!activeBranchId ? (
            <div className="text-center py-6 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl">
              Tu perfil todavía no tiene una sucursal asignada para mostrar la
              sala de espera compartida.
            </div>
          ) : visibleWaitingQueue.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm bg-slate-50 rounded-xl border border-dashed border-slate-200">
              No hay pacientes en sala de espera para este filtro en esta
              sucursal.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {visibleWaitingQueue.map((item) => {
                const isUrgent =
                  item.priority === "urgent" || Boolean(item.emergencyNotes);
                const isInConsultation = item.status === "in_consultation";

                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl p-4 border-2 flex flex-col justify-between gap-4 transition-all ${
                      isUrgent && !isInConsultation
                        ? "bg-red-50/70 border-red-300 shadow-sm"
                        : isInConsultation
                        ? "bg-emerald-50/50 border-emerald-200"
                        : "bg-petlight/50 border-slate-200 hover:border-petgreen/60"
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={
                              item.avatarUrl ||
                              "https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&q=80"
                            }
                            alt={item.petName}
                            className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-petblue text-base">
                                {item.petName}
                              </span>
                              {item.priority === "urgent" && (
                                <span className="text-[10px] font-extrabold uppercase bg-red-600 text-white px-2 py-0.5 rounded-full">
                                  Urgente
                                </span>
                              )}
                              {isInConsultation && (
                                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                                  En Consulta
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 truncate">
                              {item.species} • {item.breed} — Tutor:{" "}
                              <strong className="text-slate-700">
                                {item.ownerName}
                              </strong>
                            </p>
                          </div>
                        </div>

                        <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1 whitespace-nowrap">
                          <Clock className="w-3.5 h-3.5 text-petgreen" />
                          {formatElapsed(item.created_at, nowMs)}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="bg-petblue text-white px-2.5 py-1 rounded-lg font-bold">
                          {item.visit_type}
                        </span>
                        <span className="bg-white text-slate-600 px-2.5 py-1 rounded-lg border border-slate-200 font-semibold">
                          {getVetName(item.assigned_vet_id)}
                        </span>
                      </div>

                      {item.emergencyNotes && (
                        <div className="bg-red-100 border border-red-200 rounded-xl p-2.5 text-xs font-bold text-red-900 flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                          <span>{item.emergencyNotes}</span>
                        </div>
                      )}

                      {item.reception_notes && (
                        <p className="text-xs text-slate-700 bg-white px-3 py-2 rounded-xl border border-slate-200">
                          <strong className="text-slate-500">Mostrador:</strong>{" "}
                          {item.reception_notes}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={attendingId === item.id}
                      onClick={() => handleAttendPatient(item)}
                      className={`w-full min-h-[44px] rounded-xl font-bold text-xs text-white flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-60 ${
                        isUrgent && !isInConsultation
                          ? "bg-red-600 hover:bg-red-700"
                          : "bg-petgreen hover:bg-emerald-600"
                      }`}
                    >
                      {attendingId === item.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <span>
                            {isInConsultation
                              ? "Continuar Atención"
                              : "Atender Ahora"}
                          </span>
                          <ArrowUpRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
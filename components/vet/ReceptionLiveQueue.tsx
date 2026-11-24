"use client";

import React, { useState, useEffect } from "react";
import {
  AlertTriangle,
  Clock,
  XCircle,
  Check,
  RefreshCw,
} from "lucide-react";

export interface BranchVet {
  id: string;
  full_name: string;
  license_number: string;
}

export interface WaitingRoomItem {
  id: string;
  pet_id: string;
  assigned_vet_id: string | null;
  visit_type: string;
  priority: "normal" | "urgent";
  reception_notes: string | null;
  status: "waiting" | "in_consultation" | "completed" | "cancelled";
  created_at: string;
  petName: string;
  petSpecies: string;
  petBreed: string;
  petAvatar: string | null;
  emergencyNotes: string | null;
  ownerName: string;
  uid: string;
}

interface ReceptionLiveQueueProps {
  queue: WaitingRoomItem[];
  branchVets: BranchVet[];
  updatingId: string | null;
  onRefresh: () => void;
  onUpdateStatus: (id: string, newStatus: "completed" | "cancelled") => void;
}

function formatElapsedMinutes(createdAt: string, nowMs: number) {
  if (!nowMs) return "En espera";
  const diffMin = Math.max(
    0,
    Math.floor((nowMs - new Date(createdAt).getTime()) / 60000)
  );
  if (diffMin < 1) return "Recién llegado";
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const hours = Math.floor(diffMin / 60);
  const mins = diffMin % 60;
  return `Hace ${hours}h ${mins}m`;
}

export default function ReceptionLiveQueue({
  queue,
  branchVets,
  updatingId,
  onRefresh,
  onUpdateStatus,
}: ReceptionLiveQueueProps) {
  const [nowMs, setNowMs] = useState<number>(0);

  useEffect(() => {
    setNowMs(Date.now());
    const timer = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const getVetName = (vetId: string | null) => {
    if (!vetId) return "Cualquier disponible";
    const found = branchVets.find((v) => v.id === vetId);
    return found ? found.full_name : "Veterinario asignado";
  };

  return (
    <div className="lg:col-span-5 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-petblue flex items-center gap-2">
            <Clock className="w-5 h-5 text-petgreen" />
            <span>Cola en Vivo de Sucursal</span>
          </h2>
          <p className="text-xs text-slate-500">
            Actualización automática en tiempo real
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-petblue hover:bg-slate-100 transition-colors cursor-pointer"
          title="Actualizar cola"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="divide-y divide-slate-100 max-h-[680px] overflow-y-auto">
        {queue.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">
            No hay pacientes esperando en este momento.
          </div>
        ) : (
          queue.map((item) => {
            const isUrgent =
              item.priority === "urgent" || Boolean(item.emergencyNotes);
            const isInConsultation = item.status === "in_consultation";

            return (
              <div
                key={item.id}
                className={`p-4 space-y-3 transition-colors ${
                  isUrgent && !isInConsultation
                    ? "bg-red-50/50 border-l-4 border-l-red-500"
                    : isInConsultation
                    ? "bg-emerald-50/40 border-l-4 border-l-petgreen"
                    : "hover:bg-slate-50/80"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={
                        item.petAvatar ||
                        "https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&q=80"
                      }
                      alt={item.petName}
                      className="w-11 h-11 rounded-xl object-cover border border-slate-200 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-petblue text-sm">
                          {item.petName}
                        </span>
                        {item.priority === "urgent" && (
                          <span className="text-[10px] font-extrabold uppercase bg-red-600 text-white px-2 py-0.5 rounded-full">
                            Urgente
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isInConsultation
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {isInConsultation ? "En Consulta" : "Esperando"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 truncate">
                        Tutor: {item.ownerName} •{" "}
                        <span className="font-semibold text-petblue">
                          {item.visit_type}
                        </span>
                      </p>
                    </div>
                  </div>

                  <span className="text-[11px] font-semibold text-slate-500 whitespace-nowrap shrink-0 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-petgreen" />
                    {formatElapsedMinutes(item.created_at, nowMs)}
                  </span>
                </div>

                <div className="text-xs text-slate-600 space-y-1">
                  <p>
                    <span className="font-semibold text-slate-500">
                      Profesional:
                    </span>{" "}
                    {getVetName(item.assigned_vet_id)}
                  </p>
                  {item.reception_notes && (
                    <p className="bg-white/80 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700">
                      Nota: {item.reception_notes}
                    </p>
                  )}
                  {item.emergencyNotes && (
                    <p className="bg-red-100/80 border border-red-200 rounded-lg px-2.5 py-1.5 text-red-900 font-semibold flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-red-600" />
                      <span>{item.emergencyNotes}</span>
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={updatingId === item.id}
                    onClick={() => onUpdateStatus(item.id, "completed")}
                    className="flex-1 min-h-[38px] bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Finalizar</span>
                  </button>
                  <button
                    type="button"
                    disabled={updatingId === item.id}
                    onClick={() => onUpdateStatus(item.id, "cancelled")}
                    className="flex-1 min-h-[38px] bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-700 border border-slate-200 hover:border-red-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Cancelar</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
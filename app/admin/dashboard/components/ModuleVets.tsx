"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Building2,
} from "lucide-react";

function extractFirst<T>(val: T | T[] | null | undefined): T | null {
  if (Array.isArray(val)) return val[0] || null;
  return val || null;
}

export default function ModuleVets() {
  const [pendingVets, setPendingVets] = useState<any[]>([]);
  const [isLoadingVets, setIsLoadingVets] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  const fetchPendingVets = useCallback(async () => {
    setIsLoadingVets(true);
    setFeedback(null);
    try {
      const { data, error } = await supabase
        .from("vet_profiles")
        .select(`
          id,
          license_number,
          status,
          branch_id,
          profiles (full_name, phone, dni),
          vet_branches (
            branch_id,
            clinic_branches (name, city, clinics(name))
          )
        `)
        .eq("status", "pending");

      if (error) throw error;
      setPendingVets(data || []);
    } catch (error: any) {
      console.error("Error obteniendo veterinarios pendientes:", error);
      setFeedback({
        text:
          error?.message ||
          "No se pudieron cargar los veterinarios pendientes. Verificá las políticas RLS en Supabase.",
        type: "error",
      });
    } finally {
      setIsLoadingVets(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingVets();
  }, [fetchPendingVets]);

  const handleUpdateVetStatus = async (
    id: string,
    newStatus: "approved" | "rejected",
    vetName: string
  ) => {
    setProcessingId(id);
    setFeedback(null);
    try {
      const { error } = await supabase
        .from("vet_profiles")
        .update({ status: newStatus })
        .eq("id", id);

      if (error) throw error;

      setPendingVets((prev) => prev.filter((vet) => vet.id !== id));
      setFeedback({
        text:
          newStatus === "approved"
            ? `${vetName} aprobado correctamente. Ya puede acceder al panel veterinario.`
            : `Solicitud de ${vetName} rechazada.`,
        type: "success",
      });
    } catch (error: any) {
      console.error("Error actualizando estado:", error);
      setFeedback({
        text:
          error?.message || "No se pudo actualizar el estado del veterinario.",
        type: "error",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const formatBranches = (vet: any) => {
    const rows = Array.isArray(vet.vet_branches) ? vet.vet_branches : [];
    if (rows.length === 0) return "Sin sucursal asignada";

    return rows
      .map((r: any) => {
        const branch = extractFirst<any>(r.clinic_branches);
        if (!branch) return null;
        const clinic = extractFirst<any>(branch.clinics);
        return clinic?.name ? `${clinic.name} (${branch.name})` : branch.name;
      })
      .filter(Boolean)
      .join(", ");
  };

  return (
    <div className="p-6 sm:p-8 animate-in fade-in duration-300 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-slate-800">
            Auditoría Médica Antifraude
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Revisá y aprobá las credenciales de los profesionales que solicitan
            acceso.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchPendingVets}
          disabled={isLoadingVets}
          className="inline-flex items-center gap-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2 rounded-xl border border-slate-200 transition-colors cursor-pointer disabled:opacity-60"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${isLoadingVets ? "animate-spin" : ""}`}
          />
          <span>Actualizar</span>
        </button>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl text-sm font-semibold flex items-start gap-2 ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          ) : (
            <XCircle className="w-5 h-5 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {isLoadingVets ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      ) : pendingVets.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
          <h3 className="font-bold text-slate-700">
            No hay solicitudes pendientes
          </h3>
          <p className="text-sm text-slate-500">
            Todos los profesionales han sido auditados.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-2xl">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] font-bold">
              <tr>
                <th className="py-3 px-4 border-b border-slate-200">
                  Profesional
                </th>
                <th className="py-3 px-4 border-b border-slate-200">
                  Matrícula
                </th>
                <th className="py-3 px-4 border-b border-slate-200">
                  Sucursales
                </th>
                <th className="py-3 px-4 border-b border-slate-200">
                  Contacto
                </th>
                <th className="py-3 px-4 border-b border-slate-200 text-right">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {pendingVets.map((vet) => {
                const prof = extractFirst<any>(vet.profiles);
                const vetName = prof?.full_name || "Desconocido";
                const isBusy = processingId === vet.id;

                return (
                  <tr key={vet.id} className="hover:bg-slate-50/50">
                    <td className="py-4 px-4">
                      <div className="font-bold text-slate-800">{vetName}</div>
                      {prof?.dni && (
                        <div className="text-[11px] text-slate-500 font-mono">
                          DNI: {prof.dni}
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-4 font-mono text-xs">
                      {vet.license_number}
                    </td>
                    <td className="py-4 px-4 text-xs">
                      <span className="inline-flex items-center gap-1.5 text-slate-600">
                        <Building2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span>{formatBranches(vet)}</span>
                      </span>
                    </td>
                    <td className="py-4 px-4 text-xs">
                      {prof?.phone || "Sin teléfono"}
                    </td>
                    <td className="py-4 px-4 flex justify-end gap-2">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          handleUpdateVetStatus(vet.id, "approved", vetName)
                        }
                        className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                      >
                        {isBusy ? "..." : "Aprobar"}
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          handleUpdateVetStatus(vet.id, "rejected", vetName)
                        }
                        className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                      >
                        Rechazar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}